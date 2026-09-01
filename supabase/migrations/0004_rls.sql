-- 0004_rls: enable RLS on all 8 tables + owner-scoped policies.
-- Turns tests/rls/pre-rls-anon-leak.test.js GREEN (task 2.5).
-- Paired down migration: supabase/migrations_down/0004_rls_down.sql

alter table prenda        enable row level security;
alter table outfit        enable row level security;
alter table tip           enable row level security;
alter table outfit_prenda enable row level security;
alter table prenda_tip    enable row level security;
alter table outfit_tip    enable row level security;
alter table tipo_prenda   enable row level security;
alter table colores       enable row level security;

-- Owned tables: one FOR ALL policy per table (not four per-operation
-- policies -- see design.md "FOR ALL policy per table" decision).
create policy owner_all on prenda for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy owner_all on outfit for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy owner_all on tip for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy owner_all on outfit_prenda for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy owner_all on prenda_tip for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy owner_all on outfit_tip for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Shared vocabulary: readable by any authenticated user, never by anon.
create policy read_catalog on colores     for select to authenticated using (true);
create policy read_catalog on tipo_prenda for select to authenticated using (true);
-- tipo_prenda is append-only vocabulary; no update/delete policy = denied.
create policy add_tipo on tipo_prenda for insert to authenticated with check (true);

-- No policy is granted to anon or public anywhere in this migration. RLS
-- with zero applicable policies for a role is a hard deny for that role.
