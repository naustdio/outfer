import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makeTipsRepo } from "../../../src/data/tips.js";

describe("makeTipsRepo", () => {
  it("list() queries tip ordered by created_at", async () => {
    const client = makeFakeClient({ responses: [{ data: [], error: null }] });
    const repo = makeTipsRepo(client);

    await repo.list();

    expect(client.calls[0].table).toBe("tip");
    expect(client.calls[0].ops.map(([name]) => name)).toContain("order");
  });

  it("getById() reads the tip row plus its outfit and prenda attachments", async () => {
    const client = makeFakeClient({
      responses: [
        { data: { id: "t1" }, error: null },
        { data: [{ outfit_id: "o1" }], error: null },
        { data: [{ prenda_id: "p1" }], error: null },
      ],
    });
    const repo = makeTipsRepo(client);

    const result = await repo.getById("t1");

    expect(client.calls.map((c) => c.table)).toEqual(["tip", "outfit_tip", "prenda_tip"]);
    expect(result).toEqual({
      tip: { id: "t1" },
      outfits: [{ outfit_id: "o1" }],
      prendas: [{ prenda_id: "p1" }],
    });
  });

  it("create() inserts into tip", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "t1" }, error: null }] });
    const repo = makeTipsRepo(client);
    const input = { tip: "Combina colores neutros" };

    const result = await repo.create(input);

    expect(client.calls[0].table).toBe("tip");
    expect(client.calls[0].ops).toContainEqual(["insert", [input]]);
    expect(result).toEqual({ id: "t1" });
  });

  it("update() patches tip by id", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "t1", tip: "Nuevo" }, error: null }] });
    const repo = makeTipsRepo(client);

    const result = await repo.update("t1", { tip: "Nuevo" });

    expect(client.calls[0].table).toBe("tip");
    expect(client.calls[0].ops).toContainEqual(["update", [{ tip: "Nuevo" }]]);
    expect(result).toEqual({ id: "t1", tip: "Nuevo" });
  });

  it("remove() deletes tip by id", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makeTipsRepo(client);

    const result = await repo.remove("t1");

    expect(client.calls[0].table).toBe("tip");
    expect(client.calls[0].ops).toContainEqual(["delete", []]);
    expect(result).toBe(true);
  });
});
