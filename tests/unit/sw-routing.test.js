// pwa-shell "App-Shell-Only Offline Caching": public/sw.js MUST cache only
// the static app shell and MUST NOT intercept catalog-data requests.
// shouldHandle(request, origin) is extracted as a pure function -- same
// convention as design.md's Testing Strategy row for sw.js ("Extract the
// decision to a pure shouldHandle(request) and test it directly") -- so it
// is testable in plain Node without a ServiceWorkerGlobalScope. `origin` is
// an explicit second parameter (rather than reading `self.location.origin`
// internally) so this stays a pure function callable from Node; the actual
// fetch listener in sw.js passes self.location.origin at call time.
import { describe, it, expect, vi } from "vitest";
import { shouldHandle, precacheBestEffort, staleWhileRevalidate } from "../../public/sw.js";

const APP_ORIGIN = "https://closet.example";

function makeRequest(url, method = "GET") {
  return { url, method };
}

describe("shouldHandle", () => {
  it("handles a same-origin GET for a static asset", () => {
    const request = makeRequest(`${APP_ORIGIN}/src/main.js`);

    expect(shouldHandle(request, APP_ORIGIN)).toBe(true);
  });

  it("handles a same-origin GET for the index document", () => {
    const request = makeRequest(`${APP_ORIGIN}/`);

    expect(shouldHandle(request, APP_ORIGIN)).toBe(true);
  });

  // design.md: "Anything not same-origin (incl. *.supabase.co) not
  // intercepted -- return; before respondWith" -- catalog-data requests
  // must remain network-dependent and never sit in the Cache API.
  it("does NOT handle a cross-origin *.supabase.co request", () => {
    const request = makeRequest("https://abcd1234.supabase.co/rest/v1/prenda");

    expect(shouldHandle(request, APP_ORIGIN)).toBe(false);
  });

  it("does NOT handle a cross-origin local Supabase stack request (127.0.0.1:56321)", () => {
    const request = makeRequest("http://127.0.0.1:56321/rest/v1/outfit_v");

    expect(shouldHandle(request, APP_ORIGIN)).toBe(false);
  });

  it("does NOT handle a non-GET same-origin request", () => {
    const request = makeRequest(`${APP_ORIGIN}/src/main.js`, "POST");

    expect(shouldHandle(request, APP_ORIGIN)).toBe(false);
  });
});

// verify-report-pr4 WARNING-2: cache.addAll() is all-or-nothing, so one
// missing precache URL (most likely /config.js -- gitignored, per-deploy,
// may not exist yet on a fresh checkout) used to reject the entire install,
// leaving the worker "redundant" with nothing cached -- silently, since the
// only caller had an empty `.catch(() => {})`. precacheBestEffort replaces
// cache.addAll() with independent per-URL attempts precisely so a single
// missing file degrades to "one entry not cached yet" instead of "install
// failed, zero offline capability".
describe("precacheBestEffort", () => {
  function fakeCache(behaviors) {
    return { add: vi.fn((url) => behaviors[url] ?? Promise.resolve()) };
  }

  it("caches every URL that succeeds even when another URL fails", async () => {
    const cache = fakeCache({ "/config.js": Promise.reject(new Error("404")) });

    await precacheBestEffort(cache, ["/index.html", "/config.js", "/manifest.json"]);

    expect(cache.add).toHaveBeenCalledWith("/index.html");
    expect(cache.add).toHaveBeenCalledWith("/config.js");
    expect(cache.add).toHaveBeenCalledWith("/manifest.json");
  });

  it("never throws or rejects when one URL fails", async () => {
    const cache = fakeCache({ "/config.js": Promise.reject(new Error("404")) });

    await expect(precacheBestEffort(cache, ["/index.html", "/config.js"])).resolves.not.toThrow();
  });

  it("never throws when every URL fails", async () => {
    const cache = fakeCache({
      "/a": Promise.reject(new Error("404")),
      "/b": Promise.reject(new Error("network error")),
    });

    await expect(precacheBestEffort(cache, ["/a", "/b"])).resolves.not.toThrow();
  });
});

// verify-report-pr5 CRITICAL-2 (carried over from verify-report-pr4.md): the
// old cacheFirst() served a cached response forever and never revalidated --
// a content-only deploy never reached an already-installed PWA user without
// a manual SHELL_CACHE version bump. staleWhileRevalidate(cache, request,
// fetcher) replaces it: serve the cached response immediately when present
// (fast, works offline) while ALSO kicking off a background fetch to update
// the cache for next time (self-healing on every online visit). `cache` and
// `fetcher` are injected (same convention as precacheBestEffort's injected
// `cache`) so this stays testable in plain Node without a real Cache/fetch.
function fakeResponse(body, { ok = true } = {}) {
  return {
    ok,
    _body: body,
    clone() {
      return fakeResponse(body, { ok });
    },
  };
}

describe("staleWhileRevalidate", () => {
  it("returns the cached response immediately when one exists", async () => {
    const cached = fakeResponse("cached-shell");
    const cache = { match: vi.fn().mockResolvedValue(cached), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue(fakeResponse("fresh-shell"));

    const { response } = await staleWhileRevalidate(cache, "/src/main.js", fetcher);

    expect(response).toBe(cached);
  });

  it("kicks off a background fetch and updates the cache for next time when cached", async () => {
    const cached = fakeResponse("cached-shell");
    const fresh = fakeResponse("fresh-shell");
    const cache = { match: vi.fn().mockResolvedValue(cached), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue(fresh);

    const { response, revalidate } = await staleWhileRevalidate(cache, "/src/main.js", fetcher);
    await revalidate;

    expect(response).toBe(cached);
    expect(fetcher).toHaveBeenCalledWith("/src/main.js");
    expect(cache.put).toHaveBeenCalledWith("/src/main.js", expect.anything());
  });

  it("a failed background revalidation never rejects and never breaks the already-served cached response", async () => {
    const cached = fakeResponse("cached-shell");
    const cache = { match: vi.fn().mockResolvedValue(cached), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));

    const { response, revalidate } = await staleWhileRevalidate(cache, "/src/main.js", fetcher);

    expect(response).toBe(cached);
    await expect(revalidate).resolves.not.toThrow();
  });

  it("falls back to the network and caches the response when nothing is cached yet", async () => {
    const fresh = fakeResponse("fresh-shell");
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue(fresh);

    const { response } = await staleWhileRevalidate(cache, "/screens/new-screen.js", fetcher);

    expect(response).toBe(fresh);
    expect(cache.put).toHaveBeenCalledWith("/screens/new-screen.js", expect.anything());
  });

  it("propagates a network failure when nothing is cached (true cold cache + offline)", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(staleWhileRevalidate(cache, "/screens/new-screen.js", fetcher)).rejects.toThrow("offline");
  });

  // verify-report-pr5-fixpass WARNING-2: the `response.ok` guard was never
  // exercised in its negative direction -- a fakeResponse({ ok: false })
  // never appeared in any prior test, so an implementation that cached
  // error pages (404s, 500s) into the shell would have passed all of them.
  it("never caches a non-OK response when revalidating a cache hit", async () => {
    const cached = fakeResponse("cached-shell");
    const errorResponse = fakeResponse("Not Found", { ok: false });
    const cache = { match: vi.fn().mockResolvedValue(cached), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue(errorResponse);

    const { revalidate } = await staleWhileRevalidate(cache, "/src/main.js", fetcher);
    await revalidate;

    expect(cache.put).not.toHaveBeenCalled();
  });

  it("never caches a non-OK response on a cold cache, but still returns it to the caller", async () => {
    const errorResponse = fakeResponse("Not Found", { ok: false });
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue(errorResponse);

    const { response } = await staleWhileRevalidate(cache, "/screens/new-screen.js", fetcher);

    expect(response).toBe(errorResponse);
    expect(cache.put).not.toHaveBeenCalled();
  });
});
