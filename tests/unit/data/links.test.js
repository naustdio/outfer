import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makeLinksRepo } from "../../../src/data/links.js";

describe("makeLinksRepo", () => {
  it("linkOutfitPrenda() inserts into outfit_prenda", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeLinksRepo(client);

    await repo.linkOutfitPrenda("o1", "p1");

    expect(client.calls[0].table).toBe("outfit_prenda");
    expect(client.calls[0].ops).toContainEqual(["insert", [{ outfit_id: "o1", prenda_id: "p1" }]]);
  });

  it("unlinkOutfitPrenda() deletes the matching outfit_prenda row", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeLinksRepo(client);

    await repo.unlinkOutfitPrenda("o1", "p1");

    expect(client.calls[0].table).toBe("outfit_prenda");
    expect(client.calls[0].ops).toContainEqual(["delete", []]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["outfit_id", "o1"]]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["prenda_id", "p1"]]);
  });

  it("linkPrendaTip() inserts into prenda_tip", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeLinksRepo(client);

    await repo.linkPrendaTip("p1", "t1");

    expect(client.calls[0].table).toBe("prenda_tip");
    expect(client.calls[0].ops).toContainEqual(["insert", [{ prenda_id: "p1", tip_id: "t1" }]]);
  });

  it("unlinkPrendaTip() deletes the matching prenda_tip row", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeLinksRepo(client);

    await repo.unlinkPrendaTip("p1", "t1");

    expect(client.calls[0].table).toBe("prenda_tip");
    expect(client.calls[0].ops).toContainEqual(["eq", ["prenda_id", "p1"]]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["tip_id", "t1"]]);
  });

  it("linkOutfitTip() inserts into outfit_tip", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeLinksRepo(client);

    await repo.linkOutfitTip("o1", "t1");

    expect(client.calls[0].table).toBe("outfit_tip");
    expect(client.calls[0].ops).toContainEqual(["insert", [{ outfit_id: "o1", tip_id: "t1" }]]);
  });

  it("unlinkOutfitTip() deletes the matching outfit_tip row, leaving prenda_tip untouched", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeLinksRepo(client);

    await repo.unlinkOutfitTip("o1", "t1");

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].table).toBe("outfit_tip");
    expect(client.calls[0].ops).toContainEqual(["eq", ["outfit_id", "o1"]]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["tip_id", "t1"]]);
  });

  it("propagates errors from the underlying client instead of swallowing them", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: { message: "fk violation" } }] });
    const repo = makeLinksRepo(client);

    await expect(repo.linkOutfitPrenda("o1", "p1")).rejects.toEqual({ message: "fk violation" });
  });
});
