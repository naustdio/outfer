-- Rollback for 0004_rls. Run manually; not auto-executed by the CLI.
drop policy if exists add_tipo on tipo_prenda;
drop policy if exists read_catalog on tipo_prenda;
drop policy if exists read_catalog on colores;
drop policy if exists owner_all on outfit_tip;
drop policy if exists owner_all on prenda_tip;
drop policy if exists owner_all on outfit_prenda;
drop policy if exists owner_all on tip;
drop policy if exists owner_all on outfit;
drop policy if exists owner_all on prenda;

alter table colores       disable row level security;
alter table tipo_prenda   disable row level security;
alter table outfit_tip    disable row level security;
alter table prenda_tip    disable row level security;
alter table outfit_prenda disable row level security;
alter table tip           disable row level security;
alter table outfit        disable row level security;
alter table prenda        disable row level security;
