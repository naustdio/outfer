-- 0001_types_and_lookups: enums + shared vocabulary lookup tables.
-- Paired down migration: supabase/migrations_down/0001_types_and_lookups_down.sql

create type categoria_prenda as enum ('Superior', 'Inferior', 'Pies', 'Accesorios');
create type estado_prenda    as enum ('En closet', 'Por comprar');
create type temporada        as enum ('Primavera', 'Verano', 'Otono', 'Invierno', 'Atemporal');
create type tipo_dano        as enum ('Costura/Bastilla', 'Boton', 'Cierre', 'Mancha', 'Descosido', 'Desgaste', 'Otro');
create type categoria_tip    as enum ('Colores', 'Texturas', 'Proporciones', 'Accesorios', 'Ocasion');
create type color            as enum (
  'Negro', 'Blanco', 'Gris', 'Beige', 'Cafe', 'Azul', 'Azul marino', 'Celeste',
  'Verde', 'Verde oliva', 'Amarillo', 'Naranja', 'Rojo', 'Vino', 'Rosa',
  'Morado', 'Dorado', 'Plateado', 'Multicolor', 'Estampado'
);

-- UI metadata sidecar for the `color` enum, not a FK target.
create table colores (
  valor  color primary key,
  nombre text    not null,
  hex    text    not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  orden  smallint not null
);

-- Growable without migrations: users can add new tipo_prenda rows at runtime.
create table tipo_prenda (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  categoria categoria_prenda not null,
  orden     smallint not null default 100
);

-- This local stack has `auto_expose_new_tables` off (the new Supabase cloud
-- default): PostgREST denies ALL access to a table -- including service_role
-- and anon -- until it is explicitly GRANTed, independent of RLS. RLS
-- (migration 0004) is what actually filters ROWS; `anon` is granted SELECT
-- here (table-level reachability only) so that once RLS is enabled with no
-- `anon` policy, the result is "0 rows returned", matching design.md's
-- "reads and writes zero rows everywhere" -- not a permission-denied error.
-- `anon` never receives insert/update/delete: those fail outright, which
-- satisfies the same zero-write guarantee.
grant usage on schema public to authenticated, service_role, anon;
grant select on colores to authenticated, service_role, anon;
grant select, insert on tipo_prenda to authenticated, service_role;
grant select on tipo_prenda to anon;
-- tipo_prenda is append-only vocabulary: no update/delete grant, matching
-- the "add_tipo" policy shape from design.md (insert-only, no edit/delete).

insert into colores (valor, nombre, hex, orden) values
  ('Negro',       'Negro',       '#000000', 1),
  ('Blanco',      'Blanco',      '#FFFFFF', 2),
  ('Gris',        'Gris',        '#808080', 3),
  ('Beige',       'Beige',       '#F5F5DC', 4),
  ('Cafe',        'Cafe',        '#6F4E37', 5),
  ('Azul',        'Azul',        '#0000FF', 6),
  ('Azul marino', 'Azul marino', '#000080', 7),
  ('Celeste',     'Celeste',     '#87CEEB', 8),
  ('Verde',       'Verde',       '#008000', 9),
  ('Verde oliva', 'Verde oliva', '#808000', 10),
  ('Amarillo',    'Amarillo',    '#FFFF00', 11),
  ('Naranja',     'Naranja',     '#FFA500', 12),
  ('Rojo',        'Rojo',        '#FF0000', 13),
  ('Vino',        'Vino',        '#722F37', 14),
  ('Rosa',        'Rosa',        '#FFC0CB', 15),
  ('Morado',      'Morado',      '#800080', 16),
  ('Dorado',      'Dorado',      '#D4AF37', 17),
  ('Plateado',    'Plateado',    '#C0C0C0', 18),
  ('Multicolor',  'Multicolor',  '#FF00FF', 19),
  ('Estampado',   'Estampado',   '#996633', 20);

insert into tipo_prenda (nombre, categoria, orden) values
  ('Abrigo',      'Superior',    10),
  ('Chaqueta',    'Superior',    20),
  ('Sweater',     'Superior',    30),
  ('Camisa',      'Superior',    40),
  ('Blusa',       'Superior',    40),
  ('Polera',      'Superior',    50),
  ('Pantalon',    'Inferior',    60),
  ('Jeans',       'Inferior',    60),
  ('Falda',       'Inferior',    70),
  ('Shorts',      'Inferior',    80),
  ('Zapatos',     'Pies',        90),
  ('Zapatillas',  'Pies',        90),
  ('Botas',       'Pies',        95),
  ('Cinturon',    'Accesorios', 100),
  ('Bufanda',     'Accesorios', 100),
  ('Sombrero',    'Accesorios', 100),
  ('Bolso',       'Accesorios', 100),
  ('Joyeria',     'Accesorios', 100),
  ('Lentes',      'Accesorios', 100),
  ('Reloj',       'Accesorios', 100);
