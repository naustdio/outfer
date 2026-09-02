// @vitest-environment jsdom
//
// Covers CRITICAL-A from openspec/changes/closet-app/verify-report-pr2b.md:
// a successful sign-in never left the login screen because createApp's
// SIGNED_IN handler navigated the router without ever having started it
// (router.start() is the only place that registers the hashchange
// listener). This class was entirely untested before this file existed.
//
// Wires the REAL createApp (src/app.js) + REAL createRouter (src/ui/router.js)
// together, exactly as src/main.js composes them, with an injectable fake
// window (same shape as tests/unit/ui/router.test.js's fakeWindow) so no
// real browser navigation is needed. The Supabase client is faked at the
// lowest possible boundary (client.auth.*) so makeAuth's real forwarding
// logic (src/data/auth.js) is exercised untouched.
import { describe, it, expect, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { createRouter } from "../../../src/ui/router.js";

function fakeWindow(initialHash = "") {
  const listeners = new Set();
  const location = { _hash: initialHash };
  Object.defineProperty(location, "hash", {
    get: () => location._hash,
    set: (value) => {
      location._hash = value.startsWith("#") || value === "" ? value : `#${value}`;
      for (const fn of listeners) fn();
    },
  });
  return {
    location,
    addEventListener: (event, fn) => event === "hashchange" && listeners.add(fn),
    removeEventListener: (event, fn) => event === "hashchange" && listeners.delete(fn),
    hashchangeListenerCount: () => listeners.size,
  };
}

// Fakes the Supabase client at the client.auth.* boundary so
// src/data/auth.js's real makeAuth() forwarding logic runs unmodified.
function fakeSupabaseClient({ initialSession = null } = {}) {
  let authCallback;
  return {
    fireAuthEvent(event, session = null) {
      authCallback?.(event, session);
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: initialSession }, error: null }),
      onAuthStateChange: vi.fn((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      }),
    },
  };
}

describe("createApp boot + sign-in wiring (CRITICAL-A)", () => {
  it("never starts the router on boot when there is no session (login screen only)", async () => {
    const root = document.createElement("div");
    const win = fakeWindow("");
    const prendasHandler = vi.fn();
    const router = createRouter({ root, routes: [{ pattern: "/prendas", handler: prendasHandler }], window: win });
    const client = fakeSupabaseClient({ initialSession: null });

    const app = createApp({ root, router, client });
    await app.boot();

    expect(root.querySelector("form.login-form")).not.toBeNull();
    expect(win.hashchangeListenerCount()).toBe(0);
    expect(prendasHandler).not.toHaveBeenCalled();
  });

  it("starts the router on SIGNED_IN so a successful sign-in actually navigates away from the login screen", async () => {
    const root = document.createElement("div");
    const win = fakeWindow("");
    // Every real screen (login.js, prendas-list.js, ...) clears `root`
    // before rendering its own markup -- that's how the previous screen's
    // DOM actually disappears on navigation. A bare vi.fn() wouldn't touch
    // the DOM at all, so it can't stand in for "a real screen mounted";
    // mirror that one line of real screen behavior here.
    const prendasHandler = vi.fn((container) => {
      container.innerHTML = "";
    });
    const router = createRouter({ root, routes: [{ pattern: "/prendas", handler: prendasHandler }], window: win });
    const client = fakeSupabaseClient({ initialSession: null });

    const app = createApp({ root, router, client });
    await app.boot();

    // Precondition: still on the login screen with nothing listening for
    // hash changes -- this is the exact state CRITICAL-A leaves the app in
    // forever, because nothing after this point used to start the router.
    expect(win.hashchangeListenerCount()).toBe(0);

    client.fireAuthEvent("SIGNED_IN", { user: { id: "u1" } });
    // Let the async SIGNED_IN handler, router.start()'s hashchange dispatch,
    // and the route handler's render all settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(win.hashchangeListenerCount()).toBeGreaterThan(0);
    expect(prendasHandler).toHaveBeenCalled();
    expect(root.querySelector("form.login-form")).toBeNull();
  });
});
