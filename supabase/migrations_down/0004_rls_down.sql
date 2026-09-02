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

-- RLS was the ONLY thing filtering `anon` down to 0 rows on these tables --
-- the SELECT grants themselves (added in 0001/0002/0003) are independent of
-- RLS and survive `disable row level security` untouched. Revoke them here
-- too, so this rollback can never run alone and leave every table openly
-- readable by anon. If 0001-0003's own down scripts already dropped these
-- tables, these revokes are no-ops (the objects no longer exist).
revoke select on colores, tipo_prenda from anon;
revoke select on prenda, outfit, tip from anon;
revoke select on outfit_prenda, prenda_tip, outfit_tip from anon;
