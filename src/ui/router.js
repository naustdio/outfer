// Minimal hash-based client-side router. Hash routing (design.md's target
// file tree lists ui/router.js) was chosen over the History API because this
// is a static-file PWA deployed to shared hosting with no server-side
// rewrite rule to fall unknown paths back to index.html -- hash fragments
// never leave the browser, so `#/prendas/123` always resolves to the same
// index.html the browser already has, on any static host.
//
// Pure matching logic (parseHash/compileRoute/matchRoute) is unit tested in
// tests/unit/ui/router.test.js without touching the DOM or window.location.
// createRouter() is the thin window/DOM wiring layer around it -- exercised
// there too via a fake `window`, but real end-to-end rendering in a browser
// is manual per this project's established convention for DOM-touching UI
// code (see prendas-list.js, prenda-detail.js, login.js headers).

const PARAM_SEGMENT = /^:(.+)$/;

// "#/prendas" -> "/prendas"; "", "#", "#/" -> "/"; "#prendas" -> "/prendas".
export function parseHash(hash) {
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

// Compiles a route pattern like "/prendas/:id/edit" into a matching regex
// plus the ordered list of param names its capture groups correspond to.
export function compileRoute(pattern) {
  const paramNames = [];
  const segments = pattern
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const paramMatch = PARAM_SEGMENT.exec(segment);
      if (paramMatch) {
        paramNames.push(paramMatch[1]);
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
  const source = segments.length ? `/${segments.join("/")}` : "/";
  return { pattern, paramNames, regex: new RegExp(`^${source}/?$`) };
}

// Finds the first route (in declaration order) whose compiled pattern
// matches `path`, returning the matched route and its extracted params, or
// null. Order matters: declare more specific static/longer patterns before
// shorter dynamic ones (e.g. "/prendas/new" before "/prendas/:id").
export function matchRoute(routes, path) {
  for (const route of routes) {
    const compiled = route.compiled ?? compileRoute(route.pattern);
    const match = compiled.regex.exec(path);
    if (!match) continue;
    const params = {};
    compiled.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });
    return { route, params };
  }
  return null;
}

// Wires route definitions ({ pattern, handler(root, params) }) to
// window.location.hash. `window` is injectable so tests never touch a real
// global. Route handlers are plain closures the caller wires with whatever
// repos/deps a screen needs (see app.js) -- the router itself stays generic
// and knows nothing about prendas/outfits/tips.
export function createRouter({ root, routes, notFound, window: win = window }) {
  const compiledRoutes = routes.map((route) => ({ ...route, compiled: compileRoute(route.pattern) }));
  let guard = async () => true;

  async function render(path) {
    const allowed = await guard(path);
    if (!allowed) return;

    const matched = matchRoute(compiledRoutes, path);
    if (!matched) {
      notFound?.(root, path);
      return;
    }
    await matched.route.handler(root, matched.params);
  }

  function onHashChange() {
    render(parseHash(win.location.hash));
  }

  return {
    // Lets app.js wire session-gate's guard(path) in after both router and
    // gate exist (gate is constructed from router, so the router can't
    // depend on the gate at construction time -- see app.js).
    setGuard(fn) {
      guard = fn;
    },

    // `landingPath` is only used when there is no hash yet (a fresh sign-in
    // or a fresh load with an existing session). Accepting it here -- instead
    // of having the caller call start() and then navigate() right after --
    // matters: start() already performs exactly one render (either via the
    // hashchange its own `win.location.hash = ...` triggers, or directly for
    // an existing hash). A caller doing `start(); navigate(path)` afterward
    // renders the SAME default path a second time before this fix (verify
    // caught the login-never-leaves bug; this second issue -- duplicated
    // renders on sign-in -- was found by manually exercising the fix in a
    // real browser afterward, since no test asserted render call COUNT).
    start(landingPath = "/prendas") {
      win.addEventListener("hashchange", onHashChange);
      const current = parseHash(win.location.hash);
      if (!win.location.hash) {
        // Setting the hash triggers hashchange, which renders.
        win.location.hash = landingPath;
      } else {
        render(current);
      }
    },

    navigate(path) {
      if (parseHash(win.location.hash) === path) {
        render(path);
      } else {
        win.location.hash = path;
      }
    },

    // Called on SIGNED_OUT/TOKEN_REFRESH_FAILED (app.js): stop listening so
    // a stale hashchange can't re-render an authenticated screen after
    // showLogin() takes over root.
    reset() {
      win.removeEventListener("hashchange", onHashChange);
      win.location.hash = "";
    },

    // Invoked by session-gate's guard() when there is no session. app.js's
    // own onAuthStateChange(SIGNED_OUT) already renders login, so this is
    // deliberately a no-op -- it exists only so the guard has both
    // outcomes to call, matching createSessionGate's contract.
    redirectToLogin() {},

    // Invoked by session-gate's guard() when a session exists; the matched
    // route already renders once guard() resolves true, so this is also a
    // no-op.
    allow() {},
  };
}
