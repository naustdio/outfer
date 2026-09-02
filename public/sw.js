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

// verify-report-pr5 CRITICAL-2 (carried over from verify-report-pr4.md):
// the old cacheFirst() served a cached response forever and never
// revalidated -- once a file was cached, a deployed content update never
// reached an already-installed PWA user without a human manually bumping
// SHELL_CACHE's hardcoded "-v1" suffix and remembering to do so on every
// single deploy. staleWhileRevalidate replaces it: serve the cached
// response immediately when present (same offline-first speed as before),
// but ALSO kick off a background fetch that updates the cache for next
// time whenever the device is online -- self-healing on every online visit
// instead of requiring a manual version bump. `cache` and `fetcher` are
// injected (same convention as precacheBestEffort's injected `cache`) so
// this stays a testable near-pure function in plain Node; see
// tests/unit/sw-routing.test.js. Returns `{ response, revalidate }` so the
// real fetch listener can `event.waitUntil(revalidate)` to keep the worker
// alive long enough for the background update to finish.
export async function staleWhileRevalidate(cache, request, fetcher) {
  const cached = await cache.match(request);

  const networkFetch = fetcher(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    // Already have something to serve -- a background revalidation
    // failure (e.g. offline) must never surface anywhere; the cached
    // response already satisfies this request, and the next online visit
    // gets another chance to revalidate.
    return { response: cached, revalidate: networkFetch.catch(() => undefined) };
  }

  // Nothing cached yet (e.g. a screen module not in PRECACHE_URLS, visited
  // for the first time): this request IS the network request, so a real
  // failure must propagate -- there is no fallback for a true cold cache
  // while offline.
  const response = await networkFetch;
  return { response, revalidate: Promise.resolve(response) };
}

async function staleWhileRevalidateFromCache(request) {
  const cache = await caches.open(SHELL_CACHE);
  return staleWhileRevalidate(cache, request, fetch);
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
    event.respondWith(
      staleWhileRevalidateFromCache(event.request).then(({ response, revalidate }) => {
        event.waitUntil(revalidate);
        return response;
      }),
    );
  });
}
