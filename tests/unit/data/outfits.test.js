import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makeOutfitsRepo } from "../../../src/data/outfits.js";

describe("makeOutfitsRepo", () => {
  it("list() queries outfit_v (the derived view), not the raw table", async () => {
    const client = makeFakeClient({ responses: [{ data: [], error: null }] });
    const repo = makeOutfitsRepo(client);

    await repo.list();

    expect(client.calls[0].table).toBe("outfit_v");
    expect(client.calls[0].ops.map(([name]) => name)).toContain("order");
  });

  it("getById() reads the outfit_v row (estado/nombre_sugerido come from the DB)", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "o1", estado: "Disponible" }, error: null }] });
    const repo = makeOutfitsRepo(client);

    const result = await repo.getById("o1");

    expect(client.calls[0].table).toBe("outfit_v");
    expect(client.calls[0].ops).toContainEqual(["eq", ["id", "o1"]]);
    expect(result).toEqual({ id: "o1", estado: "Disponible" });
  });

  it("create() inserts into outfit (the writable table)", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "o1" }, error: null }] });
    const repo = makeOutfitsRepo(client);
    const input = { titulo: "Casual" };

    const result = await repo.create(input);

    expect(client.calls[0].table).toBe("outfit");
    expect(client.calls[0].ops).toContainEqual(["insert", [input]]);
    expect(result).toEqual({ id: "o1" });
  });

  it("update() patches outfit by id", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "o1", titulo: "Nuevo" }, error: null }] });
    const repo = makeOutfitsRepo(client);

    const result = await repo.update("o1", { titulo: "Nuevo" });

    expect(client.calls[0].table).toBe("outfit");
    expect(client.calls[0].ops).toContainEqual(["update", [{ titulo: "Nuevo" }]]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["id", "o1"]]);
    expect(result).toEqual({ id: "o1", titulo: "Nuevo" });
  });

  // outfit_v (single row: estado/nombre_sugerido from Postgres) has no linked
  // garment ids -- it only aggregates a count. outfit-detail.js needs the
  // actual outfit_prenda rows to render/unlink individual garments, so this
  // is a second read alongside the outfit_v row, mirroring prendasRepo's
  // getById() multi-query shape (design.md Interfaces) without changing the
  // existing getById() contract above.
  it("getWithPrendas() reads the outfit_v row plus its linked outfit_prenda rows", async () => {
    const client = makeFakeClient({
      responses: [
        { data: { id: "o1", estado: "Incompleto" }, error: null },
        { data: [{ prenda_id: "p1" }, { prenda_id: "p2" }], error: null },
      ],
    });
    const repo = makeOutfitsRepo(client);

    const result = await repo.getWithPrendas("o1");

    expect(client.calls[0].table).toBe("outfit_v");
    expect(client.calls[0].ops).toContainEqual(["eq", ["id", "o1"]]);
    expect(client.calls[1].table).toBe("outfit_prenda");
    expect(client.calls[1].ops).toContainEqual(["eq", ["outfit_id", "o1"]]);
    expect(result).toEqual({
      outfit: { id: "o1", estado: "Incompleto" },
      prendaIds: ["p1", "p2"],
    });
  });

  // garment-catalog "Reverse Lookups on Garment Detail" has a mirror on the
  // outfit side (styling-tips "Attach a tip to both an outfit and a garment"
  // -- "each entity's detail view MUST show the tip"): outfit-detail.js
  // needs the tip ids linked to this outfit to render its own reverse-lookup
  // section. Additive alongside getWithPrendas() (kept byte-identical
  // above), same reasoning as that method's own header comment.
  it("getLinkedTipIds() reads the outfit's outfit_tip rows", async () => {
    const client = makeFakeClient({
      responses: [{ data: [{ tip_id: "t1" }, { tip_id: "t2" }], error: null }],
    });
    const repo = makeOutfitsRepo(client);

    const result = await repo.getLinkedTipIds("o1");

    expect(client.calls[0].table).toBe("outfit_tip");
    expect(client.calls[0].ops).toContainEqual(["eq", ["outfit_id", "o1"]]);
    expect(result).toEqual(["t1", "t2"]);
  });

  it("remove() deletes outfit by id", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeOutfitsRepo(client);

    const result = await repo.remove("o1");

    expect(client.calls[0].table).toBe("outfit");
    expect(client.calls[0].ops).toContainEqual(["delete", []]);
    expect(result).toBe(true);
  });
});
