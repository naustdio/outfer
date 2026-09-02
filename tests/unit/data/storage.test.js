import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import {
  makeStorageRepo,
  buildPrendaFotoPath,
  validatePrendaFoto,
} from "../../../src/data/storage.js";

describe("buildPrendaFotoPath", () => {
  it("builds a {user_id}/{prenda_id}/{timestamp}-{filename} path", () => {
    const path = buildPrendaFotoPath("user-1", "prenda-1", "foto.png");
    expect(path).toMatch(/^user-1\/prenda-1\/\d+-foto\.png$/);
  });

  it("sanitizes unsafe characters in the filename", () => {
    const path = buildPrendaFotoPath("user-1", "prenda-1", "my photo (1).png");
    expect(path).toMatch(/^user-1\/prenda-1\/\d+-my_photo__1_\.png$/);
  });

  it("throws when userId is missing", () => {
    expect(() => buildPrendaFotoPath(null, "prenda-1", "foto.png")).toThrow();
  });

  it("throws when prendaId is missing", () => {
    expect(() => buildPrendaFotoPath("user-1", null, "foto.png")).toThrow();
  });
});

describe("validatePrendaFoto", () => {
  it("accepts a small image file", () => {
    const file = { type: "image/png", size: 1024 };
    expect(validatePrendaFoto(file)).toEqual({ valid: true, error: null });
  });

  it("rejects a missing file", () => {
    const { valid, error } = validatePrendaFoto(null);
    expect(valid).toBe(false);
    expect(error).toBeTruthy();
  });

  it("rejects a non-image type", () => {
    const { valid, error } = validatePrendaFoto({ type: "application/pdf", size: 1024 });
    expect(valid).toBe(false);
    expect(error).toBeTruthy();
  });

  it("rejects a file over the size limit", () => {
    const { valid, error } = validatePrendaFoto({ type: "image/png", size: 6 * 1024 * 1024 });
    expect(valid).toBe(false);
    expect(error).toBeTruthy();
  });
});

describe("makeStorageRepo", () => {
  it("uploadPrendaFoto() resolves the current user, uploads, and returns the path", async () => {
    const client = makeFakeClient({
      responses: [
        { data: { user: { id: "user-1" } }, error: null }, // auth.getUser()
        { data: { path: "user-1/prenda-1/x-foto.png" }, error: null }, // upload()
      ],
    });
    const repo = makeStorageRepo(client);
    const file = { name: "foto.png", type: "image/png", size: 1024 };

    const path = await repo.uploadPrendaFoto("prenda-1", file);

    expect(client.calls[0]).toEqual({ auth: "getUser", args: [] });
    expect(client.calls[1].storage).toBe("prenda-fotos");
    expect(client.calls[1].ops[0][0]).toBe("upload");
    expect(client.calls[1].ops[0][1][0]).toMatch(/^user-1\/prenda-1\/\d+-foto\.png$/);
    expect(path).toMatch(/^user-1\/prenda-1\/\d+-foto\.png$/);
  });

  it("uploadPrendaFoto() rejects an invalid file before touching the network", async () => {
    const client = makeFakeClient({ responses: [] });
    const repo = makeStorageRepo(client);

    await expect(repo.uploadPrendaFoto("prenda-1", { type: "text/plain", size: 10 })).rejects.toThrow();
    expect(client.calls).toHaveLength(0);
  });

  it("uploadPrendaFoto() throws when there is no authenticated user", async () => {
    const client = makeFakeClient({ responses: [{ data: { user: null }, error: null }] });
    const repo = makeStorageRepo(client);
    const file = { name: "foto.png", type: "image/png", size: 1024 };

    await expect(repo.uploadPrendaFoto("prenda-1", file)).rejects.toThrow();
  });

  it("uploadPrendaFoto() throws when the upload errors", async () => {
    const client = makeFakeClient({
      responses: [
        { data: { user: { id: "user-1" } }, error: null },
        { data: null, error: { message: "boom" } },
      ],
    });
    const repo = makeStorageRepo(client);
    const file = { name: "foto.png", type: "image/png", size: 1024 };

    await expect(repo.uploadPrendaFoto("prenda-1", file)).rejects.toEqual({ message: "boom" });
  });

  it("deletePrendaFoto() removes the object by path", async () => {
    const client = makeFakeClient({ responses: [{ data: {}, error: null }] });
    const repo = makeStorageRepo(client);

    const result = await repo.deletePrendaFoto("user-1/prenda-1/foto.png");

    expect(client.calls[0].storage).toBe("prenda-fotos");
    expect(client.calls[0].ops[0]).toEqual(["remove", [["user-1/prenda-1/foto.png"]]]);
    expect(result).toBe(true);
  });

  it("deletePrendaFoto() throws when removal errors", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: { message: "boom" } }] });
    const repo = makeStorageRepo(client);

    await expect(repo.deletePrendaFoto("path")).rejects.toEqual({ message: "boom" });
  });

  it("getPrendaFotoUrl() returns a signed URL", async () => {
    const client = makeFakeClient({
      responses: [{ data: { signedUrl: "https://example.test/signed" }, error: null }],
    });
    const repo = makeStorageRepo(client);

    const url = await repo.getPrendaFotoUrl("user-1/prenda-1/foto.png");

    expect(client.calls[0].storage).toBe("prenda-fotos");
    expect(client.calls[0].ops[0][0]).toBe("createSignedUrl");
    expect(client.calls[0].ops[0][1][0]).toBe("user-1/prenda-1/foto.png");
    expect(url).toBe("https://example.test/signed");
  });

  it("getPrendaFotoUrl() throws when signing errors", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: { message: "boom" } }] });
    const repo = makeStorageRepo(client);

    await expect(repo.getPrendaFotoUrl("path")).rejects.toEqual({ message: "boom" });
  });
});
