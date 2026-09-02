// Boot sequence per design.md "Auth and session gating": check for a
// session, render login or start the router, and react to auth state
// changes (SIGNED_IN navigates to the intended route, SIGNED_OUT /
// TOKEN_REFRESH_FAILED resets the router and re-renders login).
//
// `router` is an injected interface ({ start(), navigate(path), reset() })
// -- design.md lists ui/router.js in the target file tree, but no task in
// tasks.md creates a concrete router yet (Phases 5-6 only cover auth +
// garment CRUD screens), so app.js depends on the shape, not an
// implementation, to stay unblocked. Flagged in apply-progress for
// sdd-verify: a concrete router.js still needs a task before app.js can
// actually run end to end in a browser.
import { createSupabaseClient } from "./data/supabaseClient.js";
import { makeAuth } from "./data/auth.js";
import { createSessionGate } from "./ui/session-gate.js";
import { renderLogin } from "./ui/screens/login.js";

export function createApp({ supabaseUrl, supabaseAnonKey, root, router }) {
  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey);
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
