begin;

-- A platform operator governs every tenant and must never become a member of
-- one tenant. Repair invitations created before this invariant existed.
update public.staff_memberships sm
set status = 'inactive',
    is_owner = false,
    deactivated_at = coalesce(sm.deactivated_at, now())
where sm.status in ('invited', 'active')
  and (
    sm.user_id in (select pa.user_id from public.platform_admins pa)
    or exists (
      select 1
      from public.platform_admins pa
      join auth.users u on u.id = pa.user_id
      where sm.invited_email is not null
        and lower(u.email) = lower(sm.invited_email)
    )
  );

create or replace function private.prevent_platform_staff_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('invited', 'active') then
    return new;
  end if;

  if exists (
    select 1
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
    where (new.user_id is not null and pa.user_id = new.user_id)
       or (new.invited_email is not null and lower(u.email) = lower(new.invited_email))
  ) then
    raise exception 'platform_admin_cannot_join_condominium'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_platform_staff_overlap_before_write
  on public.staff_memberships;

create trigger prevent_platform_staff_overlap_before_write
  before insert or update of user_id, invited_email, status
  on public.staff_memberships
  for each row execute function private.prevent_platform_staff_overlap();

create or replace function private.prevent_staff_platform_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.staff_memberships sm
    join auth.users u on u.id = new.user_id
    where sm.status in ('invited', 'active')
      and (
        sm.user_id = new.user_id
        or (sm.invited_email is not null and lower(sm.invited_email) = lower(u.email))
      )
  ) then
    raise exception 'condominium_user_cannot_be_platform_admin'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_staff_platform_overlap_before_insert
  on public.platform_admins;

create trigger prevent_staff_platform_overlap_before_insert
  before insert on public.platform_admins
  for each row execute function private.prevent_staff_platform_overlap();

commit;
