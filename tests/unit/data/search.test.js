import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makeSearchRepo } from "../../../src/data/search.js";

describe("makeSearchRepo", () => {
  it("search() calls rpc('search_all', { q }) and returns the hits", async () => {
    const hits = [{ tipo: "prenda", id: "p1", titulo: "Camisa", subtitulo: "" }];
    const client = makeFakeClient({ responses: [{ data: hits, error: null }] });
    const repo = makeSearchRepo(client);

    const result = await repo.search("camisa");

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toEqual({ rpc: "search_all", args: { q: "camisa" } });
    expect(result).toEqual(hits);
  });

  it("search() throws when the RPC errors", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: { message: "rpc failed" } }] });
    const repo = makeSearchRepo(client);

    await expect(repo.search("x")).rejects.toEqual({ message: "rpc failed" });
  });
});
