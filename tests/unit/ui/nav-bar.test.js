// Covers the one pure/testable piece of src/ui/components/nav-bar.js --
// isTabActive(). The DOM-mounting renderNavBar() itself is not unit tested
// per this project's established "DOM screens are manual/E2E" convention
// (see prendas-list.js, login.js header comments).
import { describe, it, expect } from "vitest";
import { isTabActive } from "../../../src/ui/components/nav-bar.js";

describe("isTabActive", () => {
  it("is active for an exact path match", () => {
    expect(isTabActive("/prendas", "/prendas")).toBe(true);
  });

  it("is active for a nested path under the tab", () => {
    expect(isTabActive("/prendas", "/prendas/123")).toBe(true);
    expect(isTabActive("/prendas", "/prendas/new")).toBe(true);
  });

  it("is not active for a sibling tab", () => {
    expect(isTabActive("/prendas", "/outfits")).toBe(false);
  });

  it("is not active for a path that merely shares a prefix string", () => {
    expect(isTabActive("/prendas", "/prendas-extra")).toBe(false);
  });
});
