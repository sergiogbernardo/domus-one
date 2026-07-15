begin;

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.staff_memberships'::regclass
    and c.contype = 'c'
    and position('not is_owner' in lower(pg_get_constraintdef(c.oid))) > 0
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.staff_memberships drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.staff_memberships
  add constraint staff_memberships_owner_identity_check
  check (
    not is_owner
    or (role = 'admin' and (user_id is not null or invited_email is not null))
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 160)
  )
  on conflict (id) do nothing;

  update public.staff_memberships sm
  set user_id = new.id,
      is_owner = case
        when sm.role = 'admin' and not exists (
          select 1
          from public.staff_memberships owner_membership
          where owner_membership.condominium_id = sm.condominium_id
            and owner_membership.is_owner
        ) then true
        else sm.is_owner
      end
  where sm.user_id is null
    and sm.status = 'invited'
    and new.email is not null
    and lower(sm.invited_email) = lower(new.email);

  return new;
end;
$$;

create or replace function public.claim_staff_invites()
returns setof public.staff_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_email text;
begin
  select u.email into verified_email
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null;

  if verified_email is null then
    return;
  end if;

  update public.staff_memberships sm
  set user_id = (select auth.uid()),
      status = 'active',
      activated_at = coalesce(sm.activated_at, now()),
      is_owner = case
        when sm.role = 'admin' and not exists (
          select 1
          from public.staff_memberships owner_membership
          where owner_membership.condominium_id = sm.condominium_id
            and owner_membership.is_owner
            and owner_membership.id <> sm.id
        ) then true
        else sm.is_owner
      end
  where sm.status = 'invited'
    and (sm.user_id is null or sm.user_id = (select auth.uid()))
    and lower(sm.invited_email) = lower(verified_email);

  return query
    select sm.*
    from public.staff_memberships sm
    where sm.user_id = (select auth.uid())
      and sm.status = 'active';
end;
$$;

create or replace function public.create_condominium_with_admin_invite(
  p_name text,
  p_slug text,
  p_admin_email text,
  p_legal_name text default null,
  p_document_number text default null,
  p_address_line text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null,
  p_contact_name text default null,
  p_contact_email text default null
)
returns public.condominiums
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_condominium public.condominiums;
  normalized_email text := lower(trim(p_admin_email));
begin
  if not private.is_platform_admin() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'condominium_name_required' using errcode = 'check_violation';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = 'check_violation';
  end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_admin_email' using errcode = 'check_violation';
  end if;

  insert into public.condominiums (
    name, slug, registration_code, legal_name, document_number,
    address_line, city, state, postal_code, contact_name, contact_email,
    created_by
  ) values (
    trim(p_name), p_slug,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    nullif(trim(p_legal_name), ''), nullif(trim(p_document_number), ''),
    nullif(trim(p_address_line), ''), nullif(trim(p_city), ''),
    nullif(trim(p_state), ''), nullif(trim(p_postal_code), ''),
    nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''),
    (select auth.uid())
  )
  returning * into created_condominium;

  insert into public.staff_memberships (
    condominium_id, invited_email, role, is_owner, status, created_by
  ) values (
    created_condominium.id, normalized_email, 'admin', true, 'invited',
    (select auth.uid())
  );

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    created_condominium.id, (select auth.uid()), 'condominium_created',
    'condominium', created_condominium.id,
    jsonb_build_object('admin_email', normalized_email)
  );

  return created_condominium;
end;
$$;

create or replace function public.invite_staff_member(
  p_condominium_id uuid,
  p_email text,
  p_role public.staff_role default 'doorman'
)
returns public.staff_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.staff_memberships;
  normalized_email text := lower(trim(p_email));
begin
  if not private.is_platform_admin()
     and not private.has_staff_role(p_condominium_id, array['admin']::public.staff_role[]) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_role <> 'doorman' then
    raise exception 'invalid_operational_role' using errcode = 'check_violation';
  end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = 'check_violation';
  end if;

  insert into public.staff_memberships (
    condominium_id, invited_email, role, is_owner, status, created_by
  ) values (
    p_condominium_id, normalized_email, p_role, false, 'invited',
    (select auth.uid())
  )
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_condominium_id, (select auth.uid()), 'staff_member_invited',
    'staff_membership', membership.id,
    jsonb_build_object('email', normalized_email, 'role', p_role)
  );

  return membership;
end;
$$;

revoke execute on function public.claim_staff_invites() from public, anon;
revoke execute on function public.create_condominium_with_admin_invite(
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
revoke execute on function public.invite_staff_member(uuid, text, public.staff_role) from public, anon;

grant execute on function public.claim_staff_invites() to authenticated;
grant execute on function public.create_condominium_with_admin_invite(
  text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.invite_staff_member(uuid, text, public.staff_role) to authenticated;

commit;
