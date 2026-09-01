-- 0003_joins: outfit_prenda / prenda_tip / outfit_tip with composite FKs.
-- Composite FKs against (id, user_id) make cross-user links structurally
-- impossible, independent of RLS (which is not yet enabled at this point).
-- Paired down migration: supabase/migrations_down/0003_joins_down.sql

create table outfit_prenda (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outfit_id uuid not null,
  prenda_id uuid not null,
  primary key (outfit_id, prenda_id),
  foreign key (outfit_id, user_id) references outfit(id, user_id) on delete cascade,
  foreign key (prenda_id, user_id) references prenda(id, user_id) on delete cascade
);

create table prenda_tip (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prenda_id uuid not null,
  tip_id    uuid not null,
  primary key (prenda_id, tip_id),
  foreign key (prenda_id, user_id) references prenda(id, user_id) on delete cascade,
  foreign key (tip_id, user_id)    references tip(id, user_id)    on delete cascade
);

create table outfit_tip (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outfit_id uuid not null,
  tip_id    uuid not null,
  primary key (outfit_id, tip_id),
  foreign key (outfit_id, user_id) references outfit(id, user_id) on delete cascade,
  foreign key (tip_id, user_id)    references tip(id, user_id)    on delete cascade
);

create index on outfit_prenda (prenda_id);
create index on prenda_tip (tip_id);
create index on outfit_tip (tip_id);

-- See 0001_types_and_lookups.sql for why explicit GRANTs are required here
-- (auto_expose_new_tables is off) and why `anon` gets SELECT-only.
grant select, insert, update, delete on outfit_prenda, prenda_tip, outfit_tip to authenticated, service_role;
grant select on outfit_prenda, prenda_tip, outfit_tip to anon;
