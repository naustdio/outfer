-- Rollback for 0007_prenda_fotos_storage. Run manually; not auto-executed by
-- the CLI (same convention as the rest of supabase/migrations_down/).
drop policy if exists prenda_fotos_owner_delete on storage.objects;
drop policy if exists prenda_fotos_owner_update on storage.objects;
drop policy if exists prenda_fotos_owner_insert on storage.objects;
drop policy if exists prenda_fotos_owner_select on storage.objects;

-- Objects must go before the bucket row (storage.objects.bucket_id FKs to
-- storage.buckets.id).
delete from storage.objects where bucket_id = 'prenda-fotos';
delete from storage.buckets where id = 'prenda-fotos';
