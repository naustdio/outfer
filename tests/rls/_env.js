// Shared env guard for the `rls` Vitest project. Tests in this project talk
// to a real local Supabase/Postgres instance and MUST be skipped (not
// failed) when no target is configured — see tasks.md Phase 2 task 2.4 and
// Phase 12 task 12.1 for the fail-loud-if-misconfigured counterpart.
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseEnv = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);
