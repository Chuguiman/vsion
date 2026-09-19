-- Esquema vsion (Supabase / Postgres). Ejecutar una vez en el nuevo proyecto.

-- Organizaciones (firmas/clientes). El superadmin es global (organization_id null).
create table if not exists organizations (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Usuarios y roles. Bootstrap: el primer registro queda como superadmin;
-- luego el registro público se cierra y el superadmin crea las demás cuentas.
create table if not exists users (
  id            bigint generated always as identity primary key,
  email         text unique not null,
  password_hash text not null,
  name          text,
  role          text not null default 'user' check (role in ('superadmin','admin','user')),
  avatar        text,
  organization_id bigint references organizations(id) on delete set null,
  must_change   boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table users add column if not exists avatar text;
alter table users add column if not exists organization_id bigint references organizations(id) on delete set null;
alter table users add column if not exists must_change boolean not null default false;

-- Corrida de comparación (una por gaceta procesada)
create table if not exists runs (
  id            bigint generated always as identity primary key,
  country       text        not null,
  gazette_number text       not null,
  date_public   date,
  date_due      date,
  language      text        default 'es',
  client_count  int         not null default 0,
  gazette_count int         not null default 0,
  n_candidates  int         not null default 0,
  n_own         int         not null default 0,   -- aviso de publicación
  n_opposition  int         not null default 0,
  n_monitor     int         not null default 0,
  ai_ran        boolean     not null default false,
  payload       jsonb       not null,             -- DTO agrupado del reporte
  organization_id bigint,                          -- org dueña (null = superadmin/global)
  created_at    timestamptz not null default now()
);
alter table runs add column if not exists organization_id bigint;

create index if not exists runs_created_idx on runs (created_at desc);
create index if not exists runs_gazette_idx on runs (country, gazette_number);

-- Países (maestro). Ids alineados con samai para match futuro (no autogenerado).
create table if not exists countries (
  id     bigint primary key,
  name   text not null,
  iso2   text not null,
  region text,
  status int not null default 1
);

-- Países monitoreados por organización (activar/desactivar).
create table if not exists monitored_countries (
  organization_id bigint not null,
  country_id      bigint not null references countries(id),
  is_active       boolean not null default true,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, country_id)
);

-- Cartera del cliente importada una sola vez. Cada gaceta se compara contra esto.
create table if not exists client_marks (
  id         bigint generated always as identity primary key,
  case_id    text,
  code       text,
  denom      text not null,
  classes    int[] not null default '{}',
  pys        text,
  holder     text,
  attorney   text,
  status     text,
  country    text,
  filed_date text,
  valid_until text,
  register_date text,
  created_at timestamptz not null default now()
);
-- columnas añadidas después de la creación inicial (idempotente)
alter table client_marks add column if not exists country text;
alter table client_marks add column if not exists filed_date text;
alter table client_marks add column if not exists valid_until text;
alter table client_marks add column if not exists register_date text;
create index if not exists client_marks_denom_idx on client_marks (denom);

-- Perfil de vigilancia por (organización, país de gaceta). Define qué
-- subconjunto de la cartera se compara en ese país. Sin fila => cartera completa.
create table if not exists watch_scopes (
  organization_id bigint not null,          -- 0 = global (superadmin)
  country         text   not null,          -- código de país de la gaceta (CO, MX, PE, BR)
  mode            text   not null default 'all' check (mode in ('all','include','exclude')),
  holders         text[] not null default '{}',   -- titulares/solicitantes
  case_ids        text[] not null default '{}',   -- expedientes/solicitudes (case_id o code)
  updated_at      timestamptz not null default now(),
  primary key (organization_id, country)
);

-- Selección manual de marcas de la cartera para un país.
create table if not exists watch_marks (
  organization_id bigint not null,
  country         text   not null,
  mark_id         bigint not null references client_marks(id) on delete cascade,
  primary key (organization_id, country, mark_id)
);
create index if not exists watch_marks_scope_idx on watch_marks (organization_id, country);

-- Publicación completa de la gaceta (todas las entradas, no solo los matches).
-- Alimenta el visor paginado y, en Fase B, las imágenes + hash perceptual.
create table if not exists publications (
  id                 bigint generated always as identity primary key,
  run_id             bigint not null,
  seq                int    not null default 0,   -- orden dentro de la gaceta
  denom              text   not null default '',  -- vacío = figurativa/3D
  classes            int[]  not null default '{}',
  pys                text,
  applicant          text,
  applicant_country  text,
  representant       text,
  application_number text,
  application_date   text,
  mark_type          text,
  status             text,
  image_id           text,   -- id de imagen del SIC (p.ej. 0900000282554b53)
  image_path         text,   -- Fase B: ruta en Supabase Storage
  image_phash        text,   -- Fase B: hash perceptual
  created_at         timestamptz not null default now()
);
create index if not exists publications_run_idx on publications (run_id, seq);

-- Imágenes de publicaciones (Fase B). Clave = id de imagen del SIC (== nombre de
-- archivo). Se llena con scripts/ingest-images.mjs; el visor la une por image_id.
create table if not exists mark_images (
  image_id   text primary key,     -- p.ej. 0900000282550ccb.webp
  bucket     text not null,
  path       text not null,        -- ruta del objeto dentro del bucket
  phash      text,                 -- dHash perceptual (16 hex)
  width      int,
  height     int,
  created_at timestamptz not null default now()
);

-- Fase 3: decisión humana por candidato (aprobar / descartar). Tabla aparte
-- para no colisionar con la escritura del payload de 'runs' durante el análisis.
create table if not exists reviews (
  run_id     bigint not null,
  cand_key   text   not null,   -- <applicationNumber>::<clientCode>::<clientDenom>
  status     text   not null check (status in ('approved','discarded')),
  updated_at timestamptz not null default now(),
  primary key (run_id, cand_key)
);
