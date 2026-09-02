-- 0002_entities: prenda / outfit / tip + indexes + composite-FK targets.
-- Paired down migration: supabase/migrations_down/0002_entities_down.sql

create table prenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  categoria categoria_prenda not null,
  tipo_prenda_id uuid not null references tipo_prenda(id),
  marca text,
  estado estado_prenda not null default 'En closet',
  disponible boolean generated always as (estado = 'En closet') stored,
  colores color[] not null check (array_length(colores, 1) between 1 and 3),
  talla text,
  link_compra text,
  precio numeric(10, 2),
  favorito boolean not null default false,
  fecha_ingreso date not null,
  cantidad integer not null default 1 check (cantidad > 0),
  necesita_reparacion boolean not null default false,
  tipo_dano tipo_dano[] not null default '{}',
  detalle_dano text,
  temporada temporada[] not null default '{}',
  fotos text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table outfit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null,
  imagen_inspiracion text,
  notas text,
  temporada temporada[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table tip (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tip text not null,
  descripcion text,
  categoria categoria_tip[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index on prenda (user_id);
create index on outfit (user_id);
create index on tip (user_id);
create index on prenda (tipo_prenda_id);

-- See 0001_types_and_lookups.sql for why explicit GRANTs are required here
-- (auto_expose_new_tables is off) and why `anon` gets SELECT-only: RLS (0004)
-- filters `anon` SELECTs down to 0 rows instead of erroring; anon writes are
-- blocked outright by the missing insert/update/delete grant.
grant select, insert, update, delete on prenda, outfit, tip to authenticated, service_role;
grant select on prenda, outfit, tip to anon;
