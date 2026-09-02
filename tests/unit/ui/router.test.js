import { describe, it, expect, vi } from "vitest";
import { parseHash, compileRoute, matchRoute, createRouter } from "../../../src/ui/router.js";

describe("parseHash", () => {
  it("strips the leading # from a hash", () => {
    expect(parseHash("#/prendas")).toBe("/prendas");
  });

  it("treats an empty or missing hash as the root path", () => {
    expect(parseHash("")).toBe("/");
    expect(parseHash(undefined)).toBe("/");
    expect(parseHash("#")).toBe("/");
    expect(parseHash("#/")).toBe("/");
  });

  it("normalizes a hash missing its leading slash", () => {
    expect(parseHash("#prendas/1")).toBe("/prendas/1");
  });
});

describe("compileRoute", () => {
  it("compiles a static pattern into a regex matching only that path", () => {
    const { regex } = compileRoute("/prendas");
    expect(regex.test("/prendas")).toBe(true);
    expect(regex.test("/prendas/1")).toBe(false);
    expect(regex.test("/outfits")).toBe(false);
  });

  it("compiles :param segments and records their names in order", () => {
    const { regex, paramNames } = compileRoute("/prendas/:id/edit");
    expect(paramNames).toEqual(["id"]);
    const match = regex.exec("/prendas/123/edit");
    expect(match).not.toBeNull();
    expect(match[1]).toBe("123");
    expect(regex.test("/prendas/edit")).toBe(false);
  });

  it("supports multiple params in one pattern", () => {
    const { paramNames } = compileRoute("/outfits/:outfitId/prendas/:prendaId");
    expect(paramNames).toEqual(["outfitId", "prendaId"]);
  });
});

describe("matchRoute", () => {
  const routes = [
    { pattern: "/prendas/new" },
    { pattern: "/prendas/:id/edit" },
    { pattern: "/prendas/:id" },
    { pattern: "/prendas" },
  ];

  it("matches a static route before a dynamic one earlier in the list", () => {
    const result = matchRoute(routes, "/prendas/new");
    expect(result.route.pattern).toBe("/prendas/new");
    expect(result.params).toEqual({});
  });

  it("extracts a single param from the matched dynamic route", () => {
    const result = matchRoute(routes, "/prendas/abc-123");
    expect(result.route.pattern).toBe("/prendas/:id");
    expect(result.params).toEqual({ id: "abc-123" });
  });

  it("matches the more specific /:id/edit route over the plain /:id route", () => {
    const result = matchRoute(routes, "/prendas/abc-123/edit");
    expect(result.route.pattern).toBe("/prendas/:id/edit");
    expect(result.params).toEqual({ id: "abc-123" });
  });

  it("returns null when no route matches", () => {
    expect(matchRoute(routes, "/outfits")).toBeNull();
  });
});

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
  };
}

describe("createRouter", () => {
  it("start() defaults to /prendas when the hash is empty", async () => {
    const win = fakeWindow("");
    const handler = vi.fn();
    const router = createRouter({ root: {}, routes: [{ pattern: "/prendas", handler }], window: win });

    router.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(win.location.hash).toBe("#/prendas");
    expect(handler).toHaveBeenCalledWith({}, {});
  });

  it("navigate() sets the hash and renders the matched route with params", async () => {
    const win = fakeWindow("#/prendas");
    const handler = vi.fn();
    const router = createRouter({
      root: {},
      routes: [{ pattern: "/prendas/:id", handler }],
      window: win,
    });
    router.start();
    await Promise.resolve();

    router.navigate("/prendas/42");
    await Promise.resolve();
    await Promise.resolve();

    expect(win.location.hash).toBe("#/prendas/42");
    expect(handler).toHaveBeenCalledWith({}, { id: "42" });
  });

  it("does not render a matched route when the injected guard denies it", async () => {
    const win = fakeWindow("#/prendas");
    const handler = vi.fn();
    const router = createRouter({ root: {}, routes: [{ pattern: "/prendas", handler }], window: win });
    router.setGuard(async () => false);

    router.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).not.toHaveBeenCalled();
  });

  it("calls notFound for an unmatched path instead of throwing", async () => {
    const win = fakeWindow("#/unknown");
    const notFound = vi.fn();
    const router = createRouter({ root: {}, routes: [{ pattern: "/prendas", handler: vi.fn() }], notFound, window: win });

    router.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(notFound).toHaveBeenCalledWith({}, "/unknown");
  });
});
