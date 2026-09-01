import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, joinList } from "../../../src/domain/format.js";

describe("formatCurrency", () => {
  it("formats a number as MXN currency", () => {
    expect(formatCurrency(1250.5)).toBe("$1,250.50");
  });

  it("returns an em dash for null/undefined", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats an ISO date string as DD/MM/YYYY", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });

  it("returns an em dash for a missing date", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("joinList", () => {
  it("joins a list of strings with a separator", () => {
    expect(joinList(["Verano", "Otono"])).toBe("Verano, Otono");
  });

  it("returns an em dash for an empty or missing list", () => {
    expect(joinList([])).toBe("—");
    expect(joinList(undefined)).toBe("—");
  });
});
