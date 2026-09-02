import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makePrendasRepo } from "../../../src/data/prendas.js";

describe("makePrendasRepo", () => {
  it("list() queries prenda with no filters by default", async () => {
    const client = makeFakeClient({ responses: [{ data: [], error: null }] });
    const repo = makePrendasRepo(client);

    await repo.list();

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].table).toBe("prenda");
    const ops = client.calls[0].ops.map(([name]) => name);
    expect(ops).toContain("select");
    expect(ops).not.toContain("eq");
    expect(ops).toContain("order");
  });

  it("list() applies categoria/disponible/favorito/temporada filters", async () => {
    const client = makeFakeClient({ responses: [{ data: [], error: null }] });
    const repo = makePrendasRepo(client);

    await repo.list({ categoria: "Superior", disponible: true, favorito: true, temporada: "Verano" });

    const ops = client.calls[0].ops;
    expect(ops).toContainEqual(["eq", ["categoria", "Superior"]]);
    expect(ops).toContainEqual(["eq", ["disponible", true]]);
    expect(ops).toContainEqual(["eq", ["favorito", true]]);
    expect(ops).toContainEqual(["contains", ["temporada", ["Verano"]]]);
  });

  it("list() throws when the query errors", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: { message: "boom" } }] });
    const repo = makePrendasRepo(client);

    await expect(repo.list()).rejects.toEqual({ message: "boom" });
  });

  it("getById() issues 3 queries: prenda, outfit links, tip links", async () => {
    const client = makeFakeClient({
      responses: [
        { data: { id: "p1" }, error: null },
        { data: [{ outfit_id: "o1" }], error: null },
        { data: [{ tip_id: "t1" }], error: null },
      ],
    });
    const repo = makePrendasRepo(client);

    const result = await repo.getById("p1");

    expect(client.calls).toHaveLength(3);
    expect(client.calls.map((c) => c.table)).toEqual(["prenda", "outfit_prenda", "prenda_tip"]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["id", "p1"]]);
    expect(client.calls[1].ops).toContainEqual(["eq", ["prenda_id", "p1"]]);
    expect(client.calls[2].ops).toContainEqual(["eq", ["prenda_id", "p1"]]);
    expect(result).toEqual({
      prenda: { id: "p1" },
      outfits: [{ outfit_id: "o1" }],
      tips: [{ tip_id: "t1" }],
    });
  });

  it("create() inserts into prenda and returns the created row", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "p1" }, error: null }] });
    const repo = makePrendasRepo(client);
    const input = { nombre: "Camisa azul" };

    const result = await repo.create(input);

    expect(client.calls[0].table).toBe("prenda");
    expect(client.calls[0].ops).toContainEqual(["insert", [input]]);
    expect(client.calls[0].ops.map(([name]) => name)).toContain("single");
    expect(result).toEqual({ id: "p1" });
  });

  it("update() patches prenda by id and returns the updated row", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "p1", nombre: "Nueva" }, error: null }] });
    const repo = makePrendasRepo(client);

    const result = await repo.update("p1", { nombre: "Nueva" });

    expect(client.calls[0].table).toBe("prenda");
    expect(client.calls[0].ops).toContainEqual(["update", [{ nombre: "Nueva" }]]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["id", "p1"]]);
    expect(result).toEqual({ id: "p1", nombre: "Nueva" });
  });

  it("remove() deletes prenda by id", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: null }] });
    const repo = makePrendasRepo(client);

    const result = await repo.remove("p1");

    expect(client.calls[0].table).toBe("prenda");
    expect(client.calls[0].ops).toContainEqual(["delete", []]);
    expect(client.calls[0].ops).toContainEqual(["eq", ["id", "p1"]]);
    expect(result).toBe(true);
  });
});
