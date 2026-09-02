-- 0007_prenda_fotos_storage: private Storage bucket for garment photos
-- (prenda.fotos, text[], already exists in 0002_entities.sql but has had no
-- Storage backing until now) + RLS on storage.objects scoping access to the
-- owning user only.
--
-- Path convention every policy below keys off:
--   {user_id}/{prenda_id}/{filename}
-- storage.foldername(name) splits an object's path on "/" into an array, so
-- (storage.foldername(name))[1] is that leading {user_id} segment -- this is
-- the standard Supabase Storage RLS pattern for per-user folders.
--
-- Same deny-by-default posture as 0004_rls.sql: no policy is granted to
-- anon or public anywhere here, and storage.objects RLS with zero
-- applicable policies for a role is a hard deny for that role. The bucket
-- itself is created non-public so even a leaked/guessed object path can't
-- be fetched anonymously without a signed URL.
--
-- Paired down migration: supabase/migrations_down/0007_prenda_fotos_storage_down.sql

insert into storage.buckets (id, name, public)
values ('prenda-fotos', 'prenda-fotos', false)
on conflict (id) do nothing;

create policy prenda_fotos_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prenda-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy prenda_fotos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prenda-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy prenda_fotos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'prenda-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'prenda-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy prenda_fotos_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'prenda-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
