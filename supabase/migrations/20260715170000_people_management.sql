begin;

alter table public.profiles
  add column if not exists email text
  check (email is null or char_length(email) <= 254);

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.email is distinct from lower(u.email);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 160),
    lower(new.email)
  )
  on conflict (id) do update set email = excluded.email;

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

create or replace function public.set_staff_member_status(
  p_membership_id uuid,
  p_active boolean
)
returns public.staff_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.staff_memberships;
begin
  select * into membership
  from public.staff_memberships sm
  where sm.id = p_membership_id
  for update;

  if membership.id is null then
    raise exception 'membership_not_found' using errcode = 'no_data_found';
  end if;
  if membership.role <> 'doorman' then
    raise exception 'only_doorman_status_allowed' using errcode = 'check_violation';
  end if;
  if not private.has_staff_role(membership.condominium_id, array['admin']::public.staff_role[]) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.staff_memberships
  set status = case
        when p_active and user_id is not null then 'active'::public.membership_status
        when p_active then 'invited'::public.membership_status
        else 'inactive'::public.membership_status
      end,
      activated_at = case when p_active and user_id is not null then coalesce(activated_at, now()) else activated_at end,
      deactivated_at = case when p_active then null else now() end
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()),
    case when p_active then 'staff_member_reactivated' else 'staff_member_deactivated' end,
    'staff_membership', membership.id,
    jsonb_build_object('role', membership.role, 'email', membership.invited_email)
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
  if not private.has_staff_role(membership.condominium_id, array['admin']::public.staff_role[]) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if membership.status <> 'inactive' then
    raise exception 'membership_not_inactive' using errcode = 'check_violation';
  end if;

  update public.unit_memberships
  set status = 'active', approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, (select auth.uid())),
      deactivated_at = null, deactivated_by = null, status_reason = null
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()), 'resident_membership_reactivated',
    'unit_membership', membership.id,
    jsonb_build_object('unit_id', membership.unit_id, 'user_id', membership.user_id)
  );

  return membership;
end;
$$;

revoke execute on function public.set_staff_member_status(uuid, boolean) from public, anon;
revoke execute on function public.reactivate_resident_membership(uuid) from public, anon;
grant execute on function public.set_staff_member_status(uuid, boolean) to authenticated;
grant execute on function public.reactivate_resident_membership(uuid) to authenticated;

commit;
