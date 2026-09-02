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

  it("remove() deletes outfit by id", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeOutfitsRepo(client);

    const result = await repo.remove("o1");

    expect(client.calls[0].table).toBe("outfit");
    expect(client.calls[0].ops).toContainEqual(["delete", []]);
    expect(result).toBe(true);
  });
});
