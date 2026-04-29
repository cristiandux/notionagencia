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
  rate            integer default 0,           -- €/hora objetivo
  emoji           text default '📁',
  voice           text default '',             -- voz de marca
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

create trigger clients_updated_at
  before update on clients
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

create trigger deals_updated_at
  before update on deals
  for each row execute procedure set_updated_at();

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════

-- Activar RLS en todas las tablas
alter table profiles     enable row level security;
alter table clients      enable row level security;
alter table time_entries enable row level security;
alter table deals        enable row level security;

-- Helper: obtener rol del usuario actual
create or replace function current_user_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- PROFILES: cada usuario ve su propio perfil; admin lo ve todo
create policy "profiles_self_read"   on profiles for select using (id = auth.uid());
create policy "profiles_admin_all"   on profiles for all    using (current_user_role() = 'admin');
create policy "profiles_self_update" on profiles for update using (id = auth.uid());

-- CLIENTS: admin y socio ven todos; editor ve todos; cliente ve solo el suyo
create policy "clients_admin_socio_editor" on clients for select
  using (current_user_role() in ('admin','socio','editor'));

create policy "clients_client_own" on clients for select
  using (
    current_user_role() = 'client'
    and slug = (select workspace from profiles where id = auth.uid())
  );

create policy "clients_admin_socio_write" on clients for all
  using (current_user_role() in ('admin','socio'));

-- TIME ENTRIES: solo admin, socio y editor
create policy "time_team_only" on time_entries for all
  using (current_user_role() in ('admin','socio','editor'));

-- DEALS: solo admin y socio
create policy "deals_team_only" on deals for all
  using (current_user_role() in ('admin','socio'));

-- ══════════════════════════════════════════════════════════════════
-- WORKSPACE INICIAL (frame = tu agencia)
-- Ejecuta esto una vez para crear el workspace principal
-- ══════════════════════════════════════════════════════════════════
insert into clients (slug, name, emoji, cover)
values ('frame', 'gonzo · agencia', '○', 'linear-gradient(135deg,#0a1729,#1a3a6a)')
on conflict (slug) do nothing;

-- ══════════════════════════════════════════════════════════════════
-- NOTAS DE IMPLEMENTACIÓN
-- ══════════════════════════════════════════════════════════════════
-- 1. Para crear el primer admin:
--    a) Regístrate en la app con tu email
--    b) En Supabase → Table Editor → profiles → edita tu fila → role = 'admin'
--    c) A partir de ahí, el admin puede cambiar roles desde la UI
--
-- 2. Para añadir clientes desde la UI:
--    Admin → Clientes → "+ Añadir cliente"
--    Esto crea un registro en la tabla clients
--
-- 3. Para invitar a un cliente al portal:
--    Admin → Equipo → Invitar usuario → rol: client → workspace: [slug del cliente]
--    El cliente recibe un email de Supabase Auth con su enlace de acceso
--
-- 4. Storage para archivos (opcional, adicional a SwissTransfer):
--    Si quieres subir archivos directamente en lugar de SwissTransfer links:
--    Supabase → Storage → Create bucket "deliverables" (public) y "raw-files" (private)
