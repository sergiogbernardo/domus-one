begin;

create or replace function private.has_staff_role(
  p_condominium_id uuid,
  p_roles public.staff_role[] default array['admin', 'syndic', 'deputy_syndic', 'caretaker', 'doorman']::public.staff_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships sm
    where sm.condominium_id = p_condominium_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and sm.role = any(p_roles)
  );
$$;

create or replace function private.enforce_staff_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  allowed_count integer;
begin
  if new.status not in ('invited', 'active') or new.role = 'admin' then
    return new;
  end if;

  if new.role = 'doorman' then
    select c.staff_limit into allowed_count
    from public.condominiums c
    where c.id = new.condominium_id
    for update;

    select count(*) into current_count
    from public.staff_memberships sm
    where sm.condominium_id = new.condominium_id
      and sm.role = 'doorman'
      and sm.status in ('invited', 'active')
      and (tg_op = 'INSERT' or sm.id <> new.id);

    if current_count >= allowed_count then
      raise exception 'staff_limit_reached' using errcode = 'check_violation';
    end if;
  else
    select count(*) into current_count
    from public.staff_memberships sm
    where sm.condominium_id = new.condominium_id
      and sm.role = new.role
      and sm.status in ('invited', 'active')
      and (tg_op = 'INSERT' or sm.id <> new.id);

    if current_count >= 1 then
      raise exception 'special_role_limit_reached' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_staff_limit_before_write on public.staff_memberships;
create trigger enforce_staff_limit_before_write
  before insert or update of status, condominium_id, role
  on public.staff_memberships
  for each row execute function private.enforce_staff_limit();

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
     and not private.has_staff_role(p_condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[]) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('syndic', 'deputy_syndic', 'caretaker', 'doorman') then
    raise exception 'invalid_operational_role' using errcode = 'check_violation';
  end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = 'check_violation';
  end if;

  insert into public.staff_memberships (
    condominium_id, invited_email, role, is_owner, status, created_by
  ) values (
    p_condominium_id, normalized_email, p_role, false, 'invited', (select auth.uid())
  ) returning * into membership;

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
  select * into membership from public.staff_memberships sm where sm.id = p_membership_id for update;
  if membership.id is null then
    raise exception 'membership_not_found' using errcode = 'no_data_found';
  end if;
  if membership.role = 'admin' then
    raise exception 'administrator_status_not_allowed' using errcode = 'check_violation';
  end if;
  if not private.has_staff_role(membership.condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[]) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.staff_memberships
  set status = case when p_active and user_id is not null then 'active'::public.membership_status when p_active then 'invited'::public.membership_status else 'inactive'::public.membership_status end,
      activated_at = case when p_active and user_id is not null then coalesce(activated_at, now()) else activated_at end,
      deactivated_at = case when p_active then null else now() end
  where id = p_membership_id returning * into membership;

  insert into public.audit_events (condominium_id, actor_id, action, entity_type, entity_id, metadata)
  values (membership.condominium_id, (select auth.uid()), case when p_active then 'staff_member_reactivated' else 'staff_member_deactivated' end, 'staff_membership', membership.id, jsonb_build_object('role', membership.role, 'email', membership.invited_email));
  return membership;
end;
$$;

drop policy if exists condominiums_update_admin on public.condominiums;
create policy condominiums_update_admin on public.condominiums for update to authenticated
  using ((select private.is_platform_admin()) or (select private.has_staff_role(id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])))
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])));

drop policy if exists buildings_insert_admin on public.buildings;
create policy buildings_insert_admin on public.buildings for insert to authenticated
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])));
drop policy if exists buildings_update_admin on public.buildings;
create policy buildings_update_admin on public.buildings for update to authenticated
  using ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])))
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])));

drop policy if exists units_insert_admin on public.units;
create policy units_insert_admin on public.units for insert to authenticated
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])));
drop policy if exists units_update_admin on public.units;
create policy units_update_admin on public.units for update to authenticated
  using ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])))
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])));

drop policy if exists staff_memberships_select_related on public.staff_memberships;
create policy staff_memberships_select_related on public.staff_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[])));

drop policy if exists audit_events_select_admin on public.audit_events;
create policy audit_events_select_admin on public.audit_events for select to authenticated
  using ((select private.is_platform_admin()) or (condominium_id is not null and (select private.has_staff_role(condominium_id, array['admin', 'syndic', 'deputy_syndic']::public.staff_role[]))));

commit;
