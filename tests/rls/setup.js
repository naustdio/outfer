// Shared fixtures/helpers for the comprehensive Phase 12 RLS suite. Builds on
// top of the env guard in ./_env.js (which governs whether the `rls` Vitest
// project runs at all) and the two-client pattern established in
// pre-rls-anon-leak.test.js (task 2.4/2.5). Centralized here so every Phase
// 12 file shares one fixture shape instead of five near-duplicate copies.
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  hasSupabaseEnv,
} from "./_env.js";

export { hasSupabaseEnv };

// Task 12.1: fail LOUDLY (not silently skip) if SUPABASE_URL is set but the
// connection fails. `hasSupabaseEnv` (./_env.js) only guards the "env vars
// absent" case -- an intentional local opt-out via `describe.skipIf`. This
// guards the *other* failure mode: env vars present, but the local Supabase
// stack is down/misconfigured/migrations not applied. Without this check a
// broken stack would surface as individual assertion failures deep in each
// test file instead of one clear, early, actionable error.
export async function assertConnected(admin) {
  const { error } = await admin.from("colores").select("valor").limit(1);
  if (error) {
    throw new Error(
      `tests/rls: SUPABASE_URL is set (${SUPABASE_URL}) but the connection check failed ` +
        `-- is "supabase start" running and are all supabase/migrations/*.sql applied? ` +
        `Underlying error: ${error.message}`,
    );
  }
}

export function makeAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function makeAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let userCounter = 0;

// Creates a real Supabase Auth user via the Admin API (service role) and
// returns an authenticated client signed in as that user -- the same pattern
// pre-rls-anon-leak.test.js already uses for its single owner, extended so
// callers can cheaply create N distinct real users for isolation testing.
export async function createTestUser(admin, label) {
  userCounter += 1;
  const email = `rls-${label}-${Date.now()}-${userCounter}@example.test`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export async function deleteTestUser(admin, userId) {
  if (!userId) return;
  await admin.auth.admin.deleteUser(userId);
}

export async function getAnyTipoPrendaId(admin) {
  const { data, error } = await admin.from("tipo_prenda").select("id").limit(1).single();
  if (error) throw error;
  return data.id;
}

// Fixture builders. The service role bypasses RLS, so admin can seed rows
// for ANY owner directly -- this is what lets a single fixture pass build
// data for two different real users without two real sign-in round trips.
export async function insertPrenda(admin, userId, tipoPrendaId, overrides = {}) {
  const { data, error } = await admin
    .from("prenda")
    .insert({
      user_id: userId,
      nombre: "RLS fixture prenda",
      categoria: "Superior",
      tipo_prenda_id: tipoPrendaId,
      colores: ["Negro"],
      fecha_ingreso: "2026-01-01",
      ...overrides,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertOutfit(admin, userId, overrides = {}) {
  const { data, error } = await admin
    .from("outfit")
    .insert({ user_id: userId, titulo: "RLS fixture outfit", ...overrides })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertTip(admin, userId, overrides = {}) {
  const { data, error } = await admin
    .from("tip")
    .insert({ user_id: userId, tip: "RLS fixture tip", ...overrides })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Idempotency: every Phase 12 file MUST call this in `afterAll` for every
// user it creates so re-running the suite never pollutes the local dev DB
// other manual testing has been using.
export async function cleanupUserRows(admin, userId) {
  if (!userId) return;
  await admin.from("outfit_prenda").delete().eq("user_id", userId);
  await admin.from("prenda_tip").delete().eq("user_id", userId);
  await admin.from("outfit_tip").delete().eq("user_id", userId);
  await admin.from("prenda").delete().eq("user_id", userId);
  await admin.from("outfit").delete().eq("user_id", userId);
  await admin.from("tip").delete().eq("user_id", userId);
}
