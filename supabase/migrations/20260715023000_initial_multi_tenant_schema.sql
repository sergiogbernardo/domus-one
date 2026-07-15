begin;

create schema if not exists private;

create type public.condominium_status as enum ('active', 'suspended', 'archived');
create type public.staff_role as enum ('admin', 'doorman');
create type public.membership_status as enum ('invited', 'pending', 'active', 'inactive', 'rejected');
create type public.unit_status as enum ('active', 'inactive');
create type public.package_status as enum ('waiting', 'collected', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 160),
  phone text check (phone is null or char_length(phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.condominiums (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  registration_code text not null unique check (char_length(registration_code) between 6 and 32),
  legal_name text check (legal_name is null or char_length(legal_name) <= 180),
  document_number text check (document_number is null or char_length(document_number) <= 32),
  address_line text check (address_line is null or char_length(address_line) <= 240),
  city text check (city is null or char_length(city) <= 120),
  state text check (state is null or char_length(state) <= 40),
  postal_code text check (postal_code is null or char_length(postal_code) <= 16),
  contact_name text check (contact_name is null or char_length(contact_name) <= 160),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  status public.condominium_status not null default 'active',
  staff_limit smallint not null default 10 check (staff_limit between 1 and 100),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  code text not null check (char_length(code) between 1 and 32),
  floors smallint check (floors is null or floors between 1 and 300),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (condominium_id, code),
  unique (id, condominium_id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  building_id uuid not null,
  unit_number text not null check (char_length(unit_number) between 1 and 32),
  floor_label text check (floor_label is null or char_length(floor_label) <= 32),
  status public.unit_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (building_id, condominium_id)
    references public.buildings (id, condominium_id) on delete restrict,
  unique (building_id, unit_number),
  unique (id, condominium_id)
);

create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  user_id uuid references auth.users (id) on delete restrict,
  invited_email text check (invited_email is null or char_length(invited_email) <= 254),
  role public.staff_role not null default 'doorman',
  is_owner boolean not null default false,
  status public.membership_status not null default 'invited'
    check (status in ('invited', 'active', 'inactive')),
  created_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or invited_email is not null),
  check (not is_owner or (role = 'admin' and user_id is not null)),
  unique (condominium_id, user_id)
);

create unique index staff_memberships_one_owner_key
  on public.staff_memberships (condominium_id)
  where is_owner;

create unique index staff_memberships_pending_email_key
  on public.staff_memberships (condominium_id, lower(invited_email))
  where user_id is null and status = 'invited';

create table public.unit_memberships (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  unit_id uuid not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  status public.membership_status not null default 'pending'
    check (status in ('pending', 'active', 'inactive', 'rejected')),
  is_owner boolean not null default false,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users (id) on delete set null,
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, condominium_id)
    references public.units (id, condominium_id) on delete restrict
);

create unique index unit_memberships_open_membership_key
  on public.unit_memberships (unit_id, user_id)
  where status in ('pending', 'active');

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  unit_id uuid not null,
  recipient_name text not null check (char_length(recipient_name) between 2 and 160),
  carrier text not null check (char_length(carrier) between 2 and 100),
  description text check (description is null or char_length(description) <= 500),
  status public.package_status not null default 'waiting',
  received_by uuid not null references auth.users (id) on delete restrict,
  received_at timestamptz not null default now(),
  collected_by uuid references auth.users (id) on delete restrict,
  collected_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, condominium_id)
    references public.units (id, condominium_id) on delete restrict,
  check (
    (status = 'waiting' and collected_by is null and collected_at is null and cancelled_by is null and cancelled_at is null)
    or (status = 'collected' and collected_by is not null and collected_at is not null and cancelled_by is null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_by is not null and cancelled_at is not null and collected_by is null and collected_at is null)
  )
);

create table public.package_events (
  id bigint generated always as identity primary key,
  package_id uuid not null references public.packages (id) on delete restrict,
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  event_type text not null check (event_type in ('received', 'collected', 'cancelled', 'corrected')),
  actor_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  condominium_id uuid references public.condominiums (id) on delete restrict,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index staff_memberships_user_active_idx
  on public.staff_memberships (user_id, condominium_id)
  where status = 'active';
create index unit_memberships_user_active_idx
  on public.unit_memberships (user_id, condominium_id, unit_id)
  where status = 'active';
create index unit_memberships_condominium_status_idx
  on public.unit_memberships (condominium_id, status);
create index packages_condominium_status_received_idx
  on public.packages (condominium_id, status, received_at desc);
create index packages_unit_status_received_idx
  on public.packages (unit_id, status, received_at desc);
create index package_events_package_created_idx
  on public.package_events (package_id, created_at desc);
create index audit_events_condominium_created_idx
  on public.audit_events (condominium_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger condominiums_set_updated_at before update on public.condominiums
  for each row execute function private.set_updated_at();
create trigger buildings_set_updated_at before update on public.buildings
  for each row execute function private.set_updated_at();
create trigger units_set_updated_at before update on public.units
  for each row execute function private.set_updated_at();
create trigger staff_memberships_set_updated_at before update on public.staff_memberships
  for each row execute function private.set_updated_at();
create trigger unit_memberships_set_updated_at before update on public.unit_memberships
  for each row execute function private.set_updated_at();
create trigger packages_set_updated_at before update on public.packages
  for each row execute function private.set_updated_at();

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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_staff_role(
  p_condominium_id uuid,
  p_roles public.staff_role[] default array['admin', 'doorman']::public.staff_role[]
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

create or replace function private.is_condominium_member(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.staff_memberships sm
      where sm.condominium_id = p_condominium_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
    )
    or exists (
      select 1 from public.unit_memberships um
      where um.condominium_id = p_condominium_id
        and um.user_id = (select auth.uid())
        and um.status = 'active'
    );
$$;

create or replace function private.can_access_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.units u
    where u.id = p_unit_id
      and (
        private.is_platform_admin()
        or private.has_staff_role(u.condominium_id)
        or exists (
          select 1 from public.unit_memberships um
          where um.unit_id = u.id
            and um.user_id = (select auth.uid())
            and um.status = 'active'
        )
      )
  );
$$;

create or replace function private.shares_condominium_with_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.staff_memberships mine
      join public.staff_memberships theirs
        on theirs.condominium_id = mine.condominium_id
      where mine.user_id = (select auth.uid()) and mine.status = 'active'
        and theirs.user_id = p_user_id and theirs.status = 'active'
    )
    or exists (
      select 1
      from public.staff_memberships mine
      join public.unit_memberships theirs
        on theirs.condominium_id = mine.condominium_id
      where mine.user_id = (select auth.uid()) and mine.status = 'active'
        and theirs.user_id = p_user_id and theirs.status in ('pending', 'active')
    )
    or exists (
      select 1
      from public.unit_memberships mine
      join public.unit_memberships theirs on theirs.unit_id = mine.unit_id
      where mine.user_id = (select auth.uid()) and mine.status = 'active'
        and theirs.user_id = p_user_id and theirs.status = 'active'
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
  if new.status not in ('invited', 'active') or new.is_owner then
    return new;
  end if;

  select c.staff_limit into allowed_count
  from public.condominiums c
  where c.id = new.condominium_id
  for update;

  select count(*) into current_count
  from public.staff_memberships sm
  where sm.condominium_id = new.condominium_id
    and sm.status in ('invited', 'active')
    and not sm.is_owner
    and (tg_op = 'INSERT' or sm.id <> new.id);

  if current_count >= allowed_count then
    raise exception 'staff_limit_reached'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger enforce_staff_limit_before_write
  before insert or update of status, condominium_id
  on public.staff_memberships
  for each row execute function private.enforce_staff_limit();

create or replace function private.record_package_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.package_events (
    package_id, condominium_id, event_type, actor_id, metadata
  ) values (
    new.id, new.condominium_id, 'received', new.received_by,
    jsonb_build_object('unit_id', new.unit_id, 'carrier', new.carrier)
  );
  return new;
end;
$$;

create trigger package_received_event_after_insert
  after insert on public.packages
  for each row execute function private.record_package_received();

create or replace function public.lookup_condominium(p_registration_code text)
returns table (id uuid, name text, slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.slug
  from public.condominiums c
  where c.registration_code = upper(trim(p_registration_code))
    and c.status = 'active';
$$;

create or replace function public.registration_directory(p_registration_code text)
returns table (
  condominium_id uuid,
  condominium_name text,
  building_id uuid,
  building_name text,
  unit_id uuid,
  unit_number text,
  floor_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, b.id, b.name, u.id, u.unit_number, u.floor_label
  from public.condominiums c
  join public.buildings b on b.condominium_id = c.id
  join public.units u on u.building_id = b.id and u.condominium_id = c.id
  where c.registration_code = upper(trim(p_registration_code))
    and c.status = 'active'
    and u.status = 'active'
  order by b.sort_order, b.name, u.unit_number;
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
  if not private.has_staff_role(membership.condominium_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if membership.status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = 'check_violation';
  end if;

  update public.unit_memberships
  set status = 'active', approved_at = now(), approved_by = (select auth.uid()),
      status_reason = null
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()), 'resident_membership_approved',
    'unit_membership', membership.id,
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
  if not private.has_staff_role(membership.condominium_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if membership.status <> 'active' then
    raise exception 'membership_not_active' using errcode = 'check_violation';
  end if;

  update public.unit_memberships
  set status = 'inactive', deactivated_at = now(), deactivated_by = (select auth.uid()),
      status_reason = left(trim(p_reason), 500)
  where id = p_membership_id
  returning * into membership;

  insert into public.audit_events (
    condominium_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    membership.condominium_id, (select auth.uid()), 'resident_membership_deactivated',
    'unit_membership', membership.id,
    jsonb_build_object('unit_id', membership.unit_id, 'user_id', membership.user_id, 'reason', membership.status_reason)
  );

  return membership;
end;
$$;

create or replace function public.confirm_package_pickup(p_package_id uuid)
returns public.packages
language plpgsql
security definer
set search_path = ''
as $$
declare
  package_row public.packages;
begin
  select * into package_row
  from public.packages p
  where p.id = p_package_id
  for update;

  if package_row.id is null then
    raise exception 'package_not_found' using errcode = 'no_data_found';
  end if;
  if package_row.status <> 'waiting' then
    raise exception 'package_not_waiting' using errcode = 'check_violation';
  end if;
  if not private.can_access_unit(package_row.unit_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.packages
  set status = 'collected', collected_by = (select auth.uid()), collected_at = now()
  where id = p_package_id
  returning * into package_row;

  insert into public.package_events (
    package_id, condominium_id, event_type, actor_id, metadata
  ) values (
    package_row.id, package_row.condominium_id, 'collected', (select auth.uid()),
    jsonb_build_object('unit_id', package_row.unit_id)
  );

  return package_row;
end;
$$;

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.condominiums enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.unit_memberships enable row level security;
alter table public.packages enable row level security;
alter table public.package_events enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_related on public.profiles
  for select to authenticated
  using ((select private.shares_condominium_with_user(id)));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy platform_admins_select_self on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy condominiums_select_member on public.condominiums
  for select to authenticated
  using ((select private.is_condominium_member(id)));
create policy condominiums_insert_platform on public.condominiums
  for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy condominiums_update_admin on public.condominiums
  for update to authenticated
  using ((select private.is_platform_admin()) or (select private.has_staff_role(id, array['admin']::public.staff_role[])))
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(id, array['admin']::public.staff_role[])));

create policy buildings_select_member on public.buildings
  for select to authenticated
  using ((select private.is_condominium_member(condominium_id)));
create policy buildings_insert_admin on public.buildings
  for insert to authenticated
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])));
create policy buildings_update_admin on public.buildings
  for update to authenticated
  using ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])))
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])));

create policy units_select_member on public.units
  for select to authenticated
  using ((select private.is_condominium_member(condominium_id)));
create policy units_insert_admin on public.units
  for insert to authenticated
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])));
create policy units_update_admin on public.units
  for update to authenticated
  using ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])))
  with check ((select private.is_platform_admin()) or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])));

create policy staff_memberships_select_related on public.staff_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
    or (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[]))
  );

create policy unit_memberships_select_related on public.unit_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
    or (select private.has_staff_role(condominium_id))
  );
create policy unit_memberships_request_self on public.unit_memberships
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and approved_at is null and approved_by is null
    and deactivated_at is null and deactivated_by is null
  );

create policy packages_select_authorized on public.packages
  for select to authenticated
  using ((select private.can_access_unit(unit_id)));
create policy packages_insert_staff on public.packages
  for insert to authenticated
  with check (
    received_by = (select auth.uid())
    and status = 'waiting'
    and (select private.has_staff_role(condominium_id))
  );

create policy package_events_select_authorized on public.package_events
  for select to authenticated
  using (
    exists (
      select 1 from public.packages p
      where p.id = package_events.package_id
        and (select private.can_access_unit(p.unit_id))
    )
  );

create policy audit_events_select_admin on public.audit_events
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (condominium_id is not null and (select private.has_staff_role(condominium_id, array['admin']::public.staff_role[])))
  );

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_staff_role(uuid, public.staff_role[]) to authenticated;
grant execute on function private.is_condominium_member(uuid) to authenticated;
grant execute on function private.can_access_unit(uuid) to authenticated;
grant execute on function private.shares_condominium_with_user(uuid) to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.condominiums to authenticated;
grant insert on public.condominiums to authenticated;
grant update (name, legal_name, document_number, address_line, city, state, postal_code, contact_name, contact_email, settings)
  on public.condominiums to authenticated;
grant select, insert on public.buildings to authenticated;
grant update (name, code, floors, sort_order) on public.buildings to authenticated;
grant select, insert on public.units to authenticated;
grant update (unit_number, floor_label, status) on public.units to authenticated;
grant select on public.staff_memberships to authenticated;
grant select, insert on public.unit_memberships to authenticated;
grant select, insert on public.packages to authenticated;
grant select on public.package_events to authenticated;
grant select on public.audit_events to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.lookup_condominium(text) from public, anon;
revoke execute on function public.registration_directory(text) from public, anon;
revoke execute on function public.approve_resident_membership(uuid) from public, anon;
revoke execute on function public.deactivate_resident_membership(uuid, text) from public, anon;
revoke execute on function public.confirm_package_pickup(uuid) from public, anon;

grant execute on function public.lookup_condominium(text) to authenticated;
grant execute on function public.registration_directory(text) to authenticated;
grant execute on function public.approve_resident_membership(uuid) to authenticated;
grant execute on function public.deactivate_resident_membership(uuid, text) to authenticated;
grant execute on function public.confirm_package_pickup(uuid) to authenticated;

commit;
