// pwa-shell "App-Shell-Only Offline Caching": caches ONLY the static app
// shell (HTML/JS/manifest/icons/vendored supabase-js bundle) -- catalog
// data (garments/outfits/tips) MUST remain network-dependent, per design.md
// "The cross-origin bypass is deliberate and load-bearing: intercepting
// Supabase traffic would cache authenticated rows and bearer tokens in the
// Cache API". Every real Supabase call goes to a DIFFERENT origin (the
// Supabase project URL / local 127.0.0.1:56321 dev stack), never this app's
// own origin, so the same-origin check below is sufficient on its own --
// no separate "is this a supabase.co URL" special case is needed, and none
// is added (see tests/unit/sw-routing.test.js for both the *.supabase.co
// and the local-stack 127.0.0.1:56321 cases).
//
// Loaded as an ES module (registered with { type: "module" } from
// src/main.js) so shouldHandle can be a named export, unit tested directly
// per design.md's Testing Strategy row for sw.js ("Extract the decision to
// a pure shouldHandle(request) and test it directly"). `origin` is an
// explicit parameter rather than read from `self.location` internally so
// this stays callable from plain Node (no ServiceWorkerGlobalScope) in
// tests/unit/sw-routing.test.js; the real fetch listener below passes
// self.location.origin at call time.
const SHELL_CACHE = "closet-shell-v1";

// Deliberately NOT an exhaustive list of every JS module the app imports
// (screens/data/domain files) -- design.md's target file tree keeps adding
// screens, and hand-maintaining that list here would silently rot. Instead:
// precache only the minimal bootstrap chain needed to render *something*
// offline (index shell + manifest/icons + the entry module + the vendored
// supabase-js bundle + the gitignored per-deploy config.js), then the
// cache-first fetch handler below opportunistically caches every other
// same-origin module (screens, data/*, domain/*) as the user visits them on
// a prior online session -- satisfying "cached the app shell on a prior
// online visit" without a brittle static manifest.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/config.js",
  "/vendor/supabase-js.esm.js",
  "/src/main.js",
];

// Pure routing predicate (pwa-shell spec + design.md sw.js table): only
// same-origin GET requests are ever candidates for shell caching. A
// cross-origin request (any Supabase URL, incl. the local dev stack) or a
// non-GET request (mutations always go straight to the network) returns
// false, and the fetch listener below does not call respondWith at all for
// those -- the browser's default network handling takes over untouched.
export function shouldHandle(request, origin) {
  if (request.method !== "GET") return false;
  return new URL(request.url).origin === origin;
}

// cache.addAll() is all-or-nothing: ONE missing URL (most likely /config.js,
// which is gitignored and per-deploy -- it may genuinely not exist yet on a
// fresh checkout before the operator creates it) rejects the whole install,
// which leaves the worker permanently "redundant" with zero shell cached and
// therefore zero offline capability -- silently, since the caller only had
// an empty `.catch(() => {})`. Precache each URL independently instead: a
// missing file just means that one entry isn't cached yet (the cache-first
// fetch handler below will pick it up opportunistically on first successful
// fetch), not that installation as a whole fails.
export async function precacheBestEffort(cache, urls) {
  const results = await Promise.allSettled(urls.map((url) => cache.add(url)));
  const failed = results
    .map((result, i) => (result.status === "rejected" ? urls[i] : null))
    .filter(Boolean);
  if (failed.length > 0) {
    console.warn("[sw] precache: skipped (not found or fetch failed):", failed);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  // Not cached yet (e.g. a screen module not in PRECACHE_URLS, visited for
  // the first time): fetch from the network and store the response for
  // next time -- this is what lets Phase 10's/Phase 9's newly added screens
  // become available offline after one online visit, without listing them
  // here by hand.
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

// Guarded so importing this module in plain Node (tests/unit/sw-routing.
// test.js, which only needs shouldHandle) never touches `self` -- inside a
// real service worker `self` is always the global scope, so this is always
// true there.
if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) => precacheBestEffort(cache, PRECACHE_URLS))
        .then(() => self.skipWaiting()),
    );
  });

  // Cache-name versioning (SHELL_CACHE above) is the only invalidation
  // mechanism (design.md) -- bumping the "-v1" suffix on any shell change
  // makes activate delete the old cache and repopulate from PRECACHE_URLS.
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    if (!shouldHandle(event.request, self.location.origin)) return;
    event.respondWith(cacheFirst(event.request));
  });
}
