import { createClient } from "@supabase/supabase-js";

// The only module in this codebase that imports @supabase/supabase-js --
// see design.md "Frontend Architecture" layer rules. Every other src/data/*
// module takes the client by injection so it can be unit-tested with a fake
// chainable client and no network.
export function createSupabaseClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof localStorage !== "undefined" ? localStorage : undefined,
    },
  });
}
