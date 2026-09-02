// Boot sequence per design.md "Auth and session gating": check for a
// session, render login or start the router, and react to auth state
// changes (SIGNED_IN starts the router -- if it wasn't already, per
// verify-report-pr2b CRITICAL-A -- and navigates to the intended route;
// SIGNED_OUT resets the router and re-renders login). Supabase-js v2 never
// emits "TOKEN_REFRESH_FAILED" (it emits "TOKEN_REFRESHED"), so that branch
// was dead code and has been removed.
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
    // No onSignedIn navigation callback here on purpose: auth.signIn()
    // (called by renderLogin's submit handler) triggers Supabase's own
    // onAuthStateChange("SIGNED_IN") below, which is the single source of
    // truth for post-sign-in navigation. A second, independent navigate()
    // call from here used to run in a race with that listener -- both
    // fired after every sign-in, rendering the landing screen twice. Found
    // by manually signing in against a real browser + local Supabase Auth
    // after the CRITICAL-A fix, not by any test (see app.test.js's header
    // comment: this class was untested before this bug and its first fix).
    renderLogin(root, { auth });
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
      // router.start() is the only place that registers the hashchange
      // listener. boot() only calls it when a session already exists at
      // load time; on the "no session yet" path it returns early after
      // showLogin(), so without this call the router never starts and a
      // successful sign-in changes the hash with nobody listening -- the
      // login form stays mounted forever (verify-report-pr2b CRITICAL-A).
      //
      // Pass the intended path INTO start() rather than calling
      // start(); navigate(intended) as two separate steps: start() already
      // renders once on its own (via the hashchange its default-hash-set
      // triggers), so a follow-up navigate() call to that same default path
      // rendered it a second time -- caught by manually exercising this
      // fix in a real browser, not by any test.
      router.start(gate.consumeIntendedPath());
    } else if (event === "SIGNED_OUT") {
      router.reset();
      showLogin();
    }
  });

  return { boot, gate, auth, client };
}
