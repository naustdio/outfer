-- Rollback for 0006_tipo_prenda_service_role_grant. Run manually against the
-- target DB; the Supabase CLI does not execute down migrations automatically.
revoke update, delete on tipo_prenda from service_role;
