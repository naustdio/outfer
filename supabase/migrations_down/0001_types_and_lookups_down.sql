-- Rollback for 0001_types_and_lookups. Run manually against the target DB;
-- the Supabase CLI does not execute down migrations automatically.
drop table if exists tipo_prenda;
drop table if exists colores;

drop type if exists color;
drop type if exists categoria_tip;
drop type if exists tipo_dano;
drop type if exists temporada;
drop type if exists estado_prenda;
drop type if exists categoria_prenda;
