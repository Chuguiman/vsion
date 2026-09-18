-- Esquema vsion (Supabase / Postgres). Ejecutar una vez en el nuevo proyecto.

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
  created_at    timestamptz not null default now()
);

create index if not exists runs_created_idx on runs (created_at desc);
create index if not exists runs_gazette_idx on runs (country, gazette_number);

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
  created_at timestamptz not null default now()
);
create index if not exists client_marks_denom_idx on client_marks (denom);

-- (Fase 3) estado de revisión por candidato — se añadirá al aprobar/descartar.
-- create table candidate_reviews (...);
