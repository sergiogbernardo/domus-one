begin;

create or replace function public.update_condominium(
  p_condominium_id uuid,
  p_name text,
  p_legal_name text default null,
  p_document_number text default null,
  p_address_line text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_staff_limit smallint default 10
)
returns public.condominiums
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_condominium public.condominiums;
  active_staff_count integer;
begin
  if not private.is_platform_admin() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'condominium_name_required' using errcode = 'check_violation';
  end if;
  if p_staff_limit is null or p_staff_limit < 1 or p_staff_limit > 10 then
    raise exception 'invalid_staff_limit' using errcode = 'check_violation';
  end if;

  select count(*) into active_staff_count
  from public.staff_memberships sm
  where sm.condominium_id = p_condominium_id
    and sm.role = 'doorman'
    and sm.status in ('invited', 'active');
  if active_staff_count > p_staff_limit then
    raise exception 'staff_limit_reached' using errcode = 'check_violation';
  end if;

  update public.condominiums
  set name = trim(p_name),
      legal_name = nullif(trim(p_legal_name), ''),
      document_number = nullif(trim(p_document_number), ''),
      address_line = nullif(trim(p_address_line), ''),
      city = nullif(trim(p_city), ''),
      state = nullif(upper(trim(p_state)), ''),
      postal_code = nullif(trim(p_postal_code), ''),
      contact_name = nullif(trim(p_contact_name), ''),
      contact_email = nullif(lower(trim(p_contact_email)), ''),
      staff_limit = p_staff_limit
  where id = p_condominium_id
  returning * into updated_condominium;

  if updated_condominium.id is null then
    raise exception 'condominium_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_condominium_id, (select auth.uid()), 'condominium_updated',
    'condominium', p_condominium_id,
    jsonb_build_object('name', updated_condominium.name, 'staff_limit', updated_condominium.staff_limit)
  );

  return updated_condominium;
end;
$$;

create or replace function public.set_condominium_status(
  p_condominium_id uuid,
  p_status public.condominium_status
)
returns public.condominiums
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_condominium public.condominiums;
begin
  if not private.is_platform_admin() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.condominiums
  set status = p_status
  where id = p_condominium_id
  returning * into updated_condominium;

  if updated_condominium.id is null then
    raise exception 'condominium_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_condominium_id, (select auth.uid()), 'condominium_status_changed',
    'condominium', p_condominium_id, jsonb_build_object('status', p_status)
  );

  return updated_condominium;
end;
$$;

create or replace function public.assign_condominium_admin(
  p_condominium_id uuid,
  p_email text
)
returns public.staff_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  invited_user_id uuid;
  membership public.staff_memberships;
begin
  if not private.is_platform_admin() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_admin_email' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.condominiums where id = p_condominium_id) then
    raise exception 'condominium_not_found' using errcode = 'no_data_found';
  end if;

  perform 1 from public.condominiums where id = p_condominium_id for update;
  select u.id into invited_user_id from auth.users u where lower(u.email) = normalized_email limit 1;

  update public.staff_memberships
  set status = 'inactive', is_owner = false, deactivated_at = coalesce(deactivated_at, now())
  where condominium_id = p_condominium_id
    and role = 'admin'
    and status in ('invited', 'active');

  select sm.* into membership
  from public.staff_memberships sm
  where sm.condominium_id = p_condominium_id
    and ((invited_user_id is not null and sm.user_id = invited_user_id)
      or lower(sm.invited_email) = normalized_email)
  order by sm.created_at desc
  limit 1
  for update;

  if membership.id is null then
    insert into public.staff_memberships (
      condominium_id, user_id, invited_email, role, is_owner, status,
      created_by, activated_at
    ) values (
      p_condominium_id, invited_user_id, normalized_email, 'admin', true,
      case when invited_user_id is null then 'invited'::public.membership_status else 'active'::public.membership_status end,
      (select auth.uid()), case when invited_user_id is null then null else now() end
    ) returning * into membership;
  else
    update public.staff_memberships
    set user_id = coalesce(invited_user_id, user_id),
        invited_email = normalized_email,
        role = 'admin',
        is_owner = true,
        status = case when coalesce(invited_user_id, user_id) is null then 'invited'::public.membership_status else 'active'::public.membership_status end,
        activated_at = case when coalesce(invited_user_id, user_id) is null then activated_at else coalesce(activated_at, now()) end,
        deactivated_at = null
    where id = membership.id
    returning * into membership;
  end if;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_condominium_id, (select auth.uid()), 'condominium_admin_assigned',
    'staff_membership', membership.id, jsonb_build_object('email', normalized_email)
  );

  return membership;
end;
$$;

create or replace function public.deactivate_condominium_admin(p_membership_id uuid)
returns public.staff_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.staff_memberships;
begin
  if not private.is_platform_admin() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.staff_memberships
  set status = 'inactive', is_owner = false, deactivated_at = coalesce(deactivated_at, now())
  where id = p_membership_id and role = 'admin'
  returning * into membership;

  if membership.id is null then
    raise exception 'administrator_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()), 'condominium_admin_deactivated',
    'staff_membership', membership.id, jsonb_build_object('email', membership.invited_email)
  );

  return membership;
end;
$$;

revoke execute on function public.update_condominium(uuid, text, text, text, text, text, text, text, text, text, smallint) from public, anon;
revoke execute on function public.set_condominium_status(uuid, public.condominium_status) from public, anon;
revoke execute on function public.assign_condominium_admin(uuid, text) from public, anon;
revoke execute on function public.deactivate_condominium_admin(uuid) from public, anon;

grant execute on function public.update_condominium(uuid, text, text, text, text, text, text, text, text, text, smallint) to authenticated;
grant execute on function public.set_condominium_status(uuid, public.condominium_status) to authenticated;
grant execute on function public.assign_condominium_admin(uuid, text) to authenticated;
grant execute on function public.deactivate_condominium_admin(uuid) to authenticated;

commit;
