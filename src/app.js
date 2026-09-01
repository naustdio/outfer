// Boot sequence per design.md "Auth and session gating": check for a
// session, render login or start the router, and react to auth state
// changes (SIGNED_IN navigates to the intended route, SIGNED_OUT /
// TOKEN_REFRESH_FAILED resets the router and re-renders login).
//
// `router` is an injected interface ({ start(), navigate(path), reset() })
// implemented by src/ui/router.js and wired up by src/main.js (the real
// browser entry point, added in Phase 6.5 to close verify-report-pr2's
// CRITICAL-3: no task ever created a concrete router or HTML entry point,
// so the app could not actually load in a browser).
//
// `client` can be injected directly (src/main.js does this so router routes
// and createApp share exactly one Supabase client instance); otherwise one
// is built from supabaseUrl/supabaseAnonKey as before.
import { createSupabaseClient } from "./data/supabaseClient.js";
import { makeAuth } from "./data/auth.js";
import { createSessionGate } from "./ui/session-gate.js";
import { renderLogin } from "./ui/screens/login.js";

export function createApp({ supabaseUrl, supabaseAnonKey, root, router, client: injectedClient }) {
  const client = injectedClient ?? createSupabaseClient(supabaseUrl, supabaseAnonKey);
  const auth = makeAuth(client);
  const gate = createSessionGate({ auth, router });

  function showLogin() {
    renderLogin(root, {
      auth,
      onSignedIn: () => router.navigate(gate.consumeIntendedPath()),
    });
  }

  async function boot() {
    const session = await auth.getSession();
    if (!session) {
      showLogin();
      return;
    }
    router.start();
  }

  auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      router.navigate(gate.consumeIntendedPath());
    } else if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
      router.reset();
      showLogin();
    }
  });

  return { boot, gate, auth, client };
}
