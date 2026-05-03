-- ══════════════════════════════════════════════════════════════════
-- gonzo workspace · Supabase Schema
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase
-- https://supabase.com → SQL Editor → New query → pega y ejecuta
-- ══════════════════════════════════════════════════════════════════

-- 1. PERFILES (extiende auth.users de Supabase)
create table if not exists profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text unique not null,
  name       text not null default '',
  role       text not null default 'client'
               check (role in ('admin','socio','editor','client')),
  workspaces text[]  default array['frame'],   -- para admin/socio/editor
  workspace  text    default null,             -- para clientes (un solo workspace)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists invitations (
  email      text primary key,
  role       text not null default 'client'
               check (role in ('admin','socio','editor','client')),
  workspaces text[] default array['frame'],
  workspace  text default null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: crea perfil automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2. CLIENTES / WORKSPACES
create table if not exists clients (
  slug            text primary key,
  name            text not null default '',
  tagline         text default '',
  sector          text default '',
  cover           text default 'linear-gradient(135deg,#1a1a2e,#0a1729)',
  since           text default '',
  plan            text default '',
  mrr             text default '',
  rate            integer default 0,
  emoji           text default '📁',
  voice           text default '',
  about           text default '',
  photos          jsonb default '[]',
  fonts           jsonb default '[]',
  palette         jsonb default '[]',
  goal_text       text default '',
  goals           jsonb default '[]',
  growth          jsonb default '[]',
  deliverables    jsonb default '[]',
  raw_files       jsonb default '[]',
  chat            jsonb default '[]',
  posts           jsonb default '[]',
  comments        jsonb default '[]',
  reply_templates jsonb default '[]',
  contact         jsonb default '[]',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Trigger: actualiza updated_at automáticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at
  before update on clients
  for each row execute procedure set_updated_at();

drop trigger if exists invitations_updated_at on invitations;
create trigger invitations_updated_at
  before update on invitations
  for each row execute procedure set_updated_at();

-- 3. TIME ENTRIES (registro de horas)
create table if not exists time_entries (
  id         text primary key default gen_random_uuid()::text,
  client     text references clients(slug) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,
  task       text not null default '',
  minutes    integer not null default 0,
  date       text default '',
  created_at timestamptz default now()
);

-- 4. CRM DEALS
create table if not exists deals (
  id          text primary key default gen_random_uuid()::text,
  company     text not null default '',
  contact     text default '',
  email       text default '',
  value       integer default 0,
  stage       text default 'lead'
                check (stage in ('lead','contacted','brief','proposal','won','lost')),
  source      text default '',
  note        text default '',
  next_action text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

drop trigger if exists deals_updated_at on deals;
create trigger deals_updated_at
  before update on deals
  for each row execute procedure set_updated_at();

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════

alter table profiles     enable row level security;
alter table invitations  enable row level security;
alter table clients      enable row level security;
alter table time_entries enable row level security;
alter table deals        enable row level security;

-- Helper: obtener rol del usuario actual
create or replace function current_user_role()
returns text language sql security definer
set search_path = public
stable as $$
  select role from profiles where id = auth.uid() limit 1
$$;

-- PROFILES
drop policy if exists "profiles_self_read" on profiles;
drop policy if exists "profiles_self_insert" on profiles;
drop policy if exists "profiles_self_update" on profiles;
drop policy if exists "profiles_admin_all" on profiles;

create policy "profiles_self_read"   on profiles for select using (id = auth.uid());
create policy "profiles_self_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_self_update" on profiles for update using (id = auth.uid());
create policy "profiles_admin_all"   on profiles for all    using (current_user_role() = 'admin');

drop policy if exists "profiles_self_email_read" on profiles;
drop policy if exists "profiles_self_email_update" on profiles;

create policy "profiles_self_email_read" on profiles for select
  using (lower(email) = lower(auth.jwt()->>'email'));

create policy "profiles_self_email_update" on profiles for update
  using (lower(email) = lower(auth.jwt()->>'email'))
  with check (lower(email) = lower(auth.jwt()->>'email'));

-- RPC segura para asegurar que el usuario autenticado tenga perfil.
-- Evita que el login dependa de inserts directos desde el cliente cuando RLS esta activo.
create or replace function ensure_my_profile()
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles;
  inv invitations;
  user_email text;
  user_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1))
    into user_email, user_name
  from auth.users
  where id = auth.uid();

  select * into inv
  from invitations
  where lower(email) = lower(user_email);

  select * into p
  from profiles
  where id = auth.uid();

  if p.id is not null then
    return p;
  end if;

  select * into p
  from profiles
  where lower(email) = lower(user_email);

  if p.id is not null then
    update profiles
    set id = auth.uid(),
        email = user_email,
        name = coalesce(nullif(profiles.name, ''), user_name),
        role = coalesce(inv.role, profiles.role, 'client'),
        workspaces = coalesce(inv.workspaces, profiles.workspaces, array['frame']),
        workspace = coalesce(inv.workspace, profiles.workspace),
        updated_at = now()
    where lower(profiles.email) = lower(user_email)
    returning * into p;

    return p;
  end if;

  insert into profiles (id, email, name, role, workspaces)
  values (
    auth.uid(),
    user_email,
    user_name,
    coalesce(inv.role, 'client'),
    coalesce(inv.workspaces, array['frame'])
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(profiles.name, ''), excluded.name),
        role = coalesce(inv.role, profiles.role),
        workspaces = coalesce(profiles.workspaces, excluded.workspaces),
        workspace = coalesce(inv.workspace, profiles.workspace),
        updated_at = now()
  returning * into p;

  return p;
end;
$$;

grant execute on function ensure_my_profile() to authenticated;

-- Permisos base de tabla (requerido para que RLS pueda evaluarse)
grant select, insert, update, delete on public.profiles     to authenticated;
grant select, insert, update, delete on public.invitations  to authenticated;
grant select, insert, update, delete on public.clients      to authenticated;
grant select, insert, update, delete on public.time_entries to authenticated;
grant select, insert, update, delete on public.deals        to authenticated;

create or replace function upsert_invitation(
  invite_email text,
  invite_role text,
  invite_workspace text default null,
  invite_workspaces text[] default null
)
returns invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations;
begin
  if current_user_role() <> 'admin' then
    raise exception 'only admins can manage invitations';
  end if;

  if invite_role not in ('admin','socio','editor','client') then
    raise exception 'invalid role';
  end if;

  insert into invitations (email, role, workspace, workspaces, invited_by)
  values (
    lower(trim(invite_email)),
    invite_role,
    case when invite_role = 'client' then invite_workspace else null end,
    case when invite_role = 'client' then null else coalesce(invite_workspaces, array['frame']) end,
    auth.uid()
  )
  on conflict (email) do update
    set role = excluded.role,
        workspace = excluded.workspace,
        workspaces = excluded.workspaces,
        invited_by = excluded.invited_by,
        updated_at = now()
  returning * into inv;

  return inv;
end;
$$;

grant execute on function upsert_invitation(text, text, text, text[]) to authenticated;

create or replace function create_client_workspace(
  client_slug text,
  client_name text,
  client_sector text default '',
  client_plan text default '',
  client_mrr text default '',
  client_rate integer default 0
)
returns clients
language plpgsql
security definer
set search_path = public
as $$
declare
  c clients;
  clean_slug text;
begin
  if current_user_role() not in ('admin','socio') then
    raise exception 'only admins and socios can create clients';
  end if;

  clean_slug := lower(trim(client_slug));
  if clean_slug = '' or client_name is null or trim(client_name) = '' then
    raise exception 'client slug and name are required';
  end if;

  insert into clients (slug, name, sector, plan, mrr, rate, emoji)
  values (clean_slug, trim(client_name), coalesce(client_sector, ''), coalesce(client_plan, ''), coalesce(client_mrr, ''), coalesce(client_rate, 0), '○')
  on conflict (slug) do update
    set name = excluded.name,
        sector = excluded.sector,
        plan = excluded.plan,
        mrr = excluded.mrr,
        rate = excluded.rate,
        updated_at = now()
  returning * into c;

  return c;
end;
$$;

grant execute on function create_client_workspace(text, text, text, text, text, integer) to authenticated;

-- INVITATIONS
drop policy if exists "invitations_admin_all" on invitations;
create policy "invitations_admin_all" on invitations for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "invitations_self_read" on invitations;
create policy "invitations_self_read" on invitations for select
  using (lower(email) = lower(auth.jwt()->>'email'));

-- CLIENTS
drop policy if exists "clients_admin_socio_editor" on clients;
drop policy if exists "clients_client_own" on clients;
drop policy if exists "clients_admin_socio_write" on clients;

create policy "clients_admin_socio_editor" on clients for select
  using (current_user_role() in ('admin','socio','editor'));

create policy "clients_client_own" on clients for select
  using (
    current_user_role() = 'client'
    and slug = (select workspace from profiles where id = auth.uid())
  );

create policy "clients_admin_socio_write" on clients for all
  using (current_user_role() in ('admin','socio'))
  with check (current_user_role() in ('admin','socio'));

-- TIME ENTRIES
drop policy if exists "time_team_only" on time_entries;

create policy "time_team_only" on time_entries for all
  using (current_user_role() in ('admin','socio','editor'));

-- DEALS
drop policy if exists "deals_team_only" on deals;

create policy "deals_team_only" on deals for all
  using (current_user_role() in ('admin','socio'));

-- ══════════════════════════════════════════════════════════════════
-- WORKSPACE INICIAL
-- ══════════════════════════════════════════════════════════════════
insert into clients (slug, name, emoji, cover)
values ('frame', 'gonzo · agencia', '○', 'linear-gradient(135deg,#0a1729,#1a3a6a)')
on conflict (slug) do nothing;

-- ══════════════════════════════════════════════════════════════════
-- PRIMER ADMIN
-- 1. Regístrate con tu email en la app
-- 2. Supabase → Table Editor → profiles → cambia role a 'admin'
-- 3. Desde la UI puedes gestionar el resto de roles
-- ══════════════════════════════════════════════════════════════════
