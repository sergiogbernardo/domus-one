begin;

create table public.internal_identities (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete restrict,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text not null,
  login_email text not null unique,
  must_change_password boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  password_reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (username = lower(username)),
  check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  check (char_length(login_email) <= 254),
  unique (condominium_id, username)
);

create index internal_identities_condominium_idx
  on public.internal_identities (condominium_id, username);

create trigger internal_identities_set_updated_at
  before update on public.internal_identities
  for each row execute function private.set_updated_at();

alter table public.internal_identities enable row level security;

create policy internal_identities_select_related
  on public.internal_identities
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
    or (select private.can_manage_condominium(condominium_id))
  );

revoke all on public.internal_identities from public, anon;
grant select on public.internal_identities to authenticated;

commit;
