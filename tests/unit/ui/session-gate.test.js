import { describe, it, expect, vi } from "vitest";
import { createSessionGate } from "../../../src/ui/session-gate.js";

describe("createSessionGate", () => {
  it("guard() redirects to login and records the intended path when there is no session", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(null) };
    const router = { redirectToLogin: vi.fn(), allow: vi.fn() };
    const gate = createSessionGate({ auth, router });

    const allowed = await gate.guard("/prendas/123");

    expect(allowed).toBe(false);
    expect(router.redirectToLogin).toHaveBeenCalledOnce();
    expect(router.allow).not.toHaveBeenCalled();
  });

  it("guard() allows navigation and does not redirect when a session exists", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ user: { id: "u1" } }) };
    const router = { redirectToLogin: vi.fn(), allow: vi.fn() };
    const gate = createSessionGate({ auth, router });

    const allowed = await gate.guard("/prendas");

    expect(allowed).toBe(true);
    expect(router.allow).toHaveBeenCalledWith("/prendas");
    expect(router.redirectToLogin).not.toHaveBeenCalled();
  });

  it("consumeIntendedPath() returns the path recorded by the last denied guard(), once, then falls back", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(null) };
    const router = { redirectToLogin: vi.fn(), allow: vi.fn() };
    const gate = createSessionGate({ auth, router });
    await gate.guard("/outfits/9");

    expect(gate.consumeIntendedPath()).toBe("/outfits/9");
    expect(gate.consumeIntendedPath()).toBe("/prendas");
    expect(gate.consumeIntendedPath("/tips")).toBe("/tips");
  });
});
