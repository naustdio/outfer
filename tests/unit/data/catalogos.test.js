import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makeCatalogosRepo } from "../../../src/data/catalogos.js";

describe("makeCatalogosRepo", () => {
  it("listColores() queries colores ordered by orden", async () => {
    const client = makeFakeClient({ responses: [{ data: [], error: null }] });
    const repo = makeCatalogosRepo(client);

    await repo.listColores();

    expect(client.calls[0].table).toBe("colores");
    expect(client.calls[0].ops).toContainEqual(["order", ["orden"]]);
  });

  it("listTiposPrenda() queries tipo_prenda ordered by orden, optionally filtered by categoria", async () => {
    const client = makeFakeClient({ responses: [{ data: [], error: null }] });
    const repo = makeCatalogosRepo(client);

    await repo.listTiposPrenda({ categoria: "Superior" });

    expect(client.calls[0].table).toBe("tipo_prenda");
    expect(client.calls[0].ops).toContainEqual(["eq", ["categoria", "Superior"]]);
    expect(client.calls[0].ops).toContainEqual(["order", ["orden"]]);
  });

  it("createTipoPrenda() inserts a new growable lookup row", async () => {
    const client = makeFakeClient({ responses: [{ data: { id: "tp1" }, error: null }] });
    const repo = makeCatalogosRepo(client);
    const input = { nombre: "Vestido", categoria: "Superior" };

    const result = await repo.createTipoPrenda(input);

    expect(client.calls[0].table).toBe("tipo_prenda");
    expect(client.calls[0].ops).toContainEqual(["insert", [input]]);
    expect(result).toEqual({ id: "tp1" });
  });
});
