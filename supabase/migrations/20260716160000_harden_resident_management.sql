begin;

create or replace function private.can_manage_condominium(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or private.has_staff_role(
      p_condominium_id,
      array['admin', 'syndic', 'deputy_syndic']::public.staff_role[]
    );
$$;

create or replace function public.approve_resident_membership(p_membership_id uuid)
returns public.unit_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.unit_memberships;
begin
  select * into membership
  from public.unit_memberships um
  where um.id = p_membership_id
  for update;

  if membership.id is null then
    raise exception 'membership_not_found' using errcode = 'no_data_found';
  end if;
  if not private.can_manage_condominium(membership.condominium_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if membership.status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = 'check_violation';
  end if;

  update public.unit_memberships
  set status = 'active',
      approved_at = now(),
      approved_by = (select auth.uid()),
      status_reason = null
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()),
    'resident_membership_approved', 'unit_membership', membership.id,
    jsonb_build_object('unit_id', membership.unit_id, 'user_id', membership.user_id)
  );

  return membership;
end;
$$;

create or replace function public.deactivate_resident_membership(
  p_membership_id uuid,
  p_reason text
)
returns public.unit_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.unit_memberships;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = 'check_violation';
  end if;

  select * into membership
  from public.unit_memberships um
  where um.id = p_membership_id
  for update;

  if membership.id is null then
    raise exception 'membership_not_found' using errcode = 'no_data_found';
  end if;
  if not private.can_manage_condominium(membership.condominium_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if membership.status <> 'active' then
    raise exception 'membership_not_active' using errcode = 'check_violation';
  end if;

  update public.unit_memberships
  set status = 'inactive',
      deactivated_at = now(),
      deactivated_by = (select auth.uid()),
      status_reason = left(trim(p_reason), 500)
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()),
    'resident_membership_deactivated', 'unit_membership', membership.id,
    jsonb_build_object(
      'unit_id', membership.unit_id,
      'user_id', membership.user_id,
      'reason', membership.status_reason
    )
  );

  return membership;
end;
$$;

create or replace function public.reactivate_resident_membership(p_membership_id uuid)
returns public.unit_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.unit_memberships;
begin
  select * into membership
  from public.unit_memberships um
  where um.id = p_membership_id
  for update;

  if membership.id is null then
    raise exception 'membership_not_found' using errcode = 'no_data_found';
  end if;
  if not private.can_manage_condominium(membership.condominium_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if membership.status <> 'inactive' then
    raise exception 'membership_not_inactive' using errcode = 'check_violation';
  end if;

  update public.unit_memberships
  set status = 'active',
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, (select auth.uid())),
      deactivated_at = null,
      deactivated_by = null,
      status_reason = null
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()),
    'resident_membership_reactivated', 'unit_membership', membership.id,
    jsonb_build_object('unit_id', membership.unit_id, 'user_id', membership.user_id)
  );

  return membership;
end;
$$;

revoke execute on function private.can_manage_condominium(uuid)
  from public, anon;
grant execute on function private.can_manage_condominium(uuid)
  to authenticated;

commit;
