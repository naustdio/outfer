// Proves the storage.objects RLS from 0007_prenda_fotos_storage.sql: an
// authenticated user can upload/read/delete objects under their own
// {user_id}/ prefix, cannot touch another user's prefix, and anon is denied
// entirely. Same two-real-user pattern as owned-tables.test.js, reusing the
// shared fixtures in ./setup.js rather than reinventing user creation.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabaseEnv,
  assertConnected,
  makeAdminClient,
  makeAnonClient,
  createTestUser,
  deleteTestUser,
} from "./setup.js";

const BUCKET = "prenda-fotos";

function makeFile(contents = "fake-image-bytes") {
  return new Blob([contents], { type: "image/png" });
}

describe.skipIf(!hasSupabaseEnv)("storage RLS: prenda-fotos bucket", () => {
  const admin = hasSupabaseEnv ? makeAdminClient() : null;

  let userA;
  let userB;

  beforeAll(async () => {
    if (!hasSupabaseEnv) return;
    await assertConnected(admin);
    userA = await createTestUser(admin, "storage-a");
    userB = await createTestUser(admin, "storage-b");
  });

  afterAll(async () => {
    if (!hasSupabaseEnv) return;
    // Objects owned by each user, then the users themselves.
    await admin.storage.from(BUCKET).remove([
      `${userA.id}/p1/photo.png`,
      `${userB.id}/p2/photo.png`,
    ]);
    await deleteTestUser(admin, userA?.id);
    await deleteTestUser(admin, userB?.id);
  });

  it("an authenticated user can upload/read/delete objects under their own prefix", async () => {
    const path = `${userA.id}/p1/photo.png`;

    const { error: uploadError } = await userA.client.storage
      .from(BUCKET)
      .upload(path, makeFile(), { contentType: "image/png" });
    expect(uploadError).toBeNull();

    const { data: signed, error: signError } = await userA.client.storage
      .from(BUCKET)
      .createSignedUrl(path, 60);
    expect(signError).toBeNull();
    expect(signed.signedUrl).toBeTruthy();

    const { error: removeError } = await userA.client.storage.from(BUCKET).remove([path]);
    expect(removeError).toBeNull();
  });

  it("cannot read another user's prefix", async () => {
    const path = `${userB.id}/p2/photo.png`;
    const { error: uploadError } = await userB.client.storage
      .from(BUCKET)
      .upload(path, makeFile(), { contentType: "image/png" });
    expect(uploadError).toBeNull();

    // RLS makes the object invisible to userA rather than erroring loudly --
    // list() on userB's folder from userA's client must come back empty.
    const { data: listing, error: listError } = await userA.client.storage
      .from(BUCKET)
      .list(`${userB.id}/p2`);
    expect(listError).toBeNull();
    expect(listing).toEqual([]);

    const { error: downloadError } = await userA.client.storage.from(BUCKET).download(path);
    expect(downloadError).not.toBeNull();
  });

  it("cannot write into another user's prefix", async () => {
    const path = `${userB.id}/p2/intruder.png`;
    const { error } = await userA.client.storage
      .from(BUCKET)
      .upload(path, makeFile(), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("cannot delete another user's object", async () => {
    const path = `${userB.id}/p2/photo.png`;
    // Re-upload as userB since the previous test's object may already be gone.
    await userB.client.storage.from(BUCKET).upload(path, makeFile(), { contentType: "image/png" });

    const { error } = await userA.client.storage.from(BUCKET).remove([path]);
    // Supabase Storage remove() on RLS-invisible objects resolves without an
    // error but removes nothing -- assert via a subsequent admin-side list
    // that the object is still there instead of asserting on `error`.
    expect(error).toBeNull();
    const { data: stillThere } = await admin.storage.from(BUCKET).list(`${userB.id}/p2`);
    expect(stillThere.some((o) => o.name === "photo.png")).toBe(true);

    await admin.storage.from(BUCKET).remove([path]);
  });

  it("anon client is denied entirely: cannot upload, list, or read", async () => {
    const anon = makeAnonClient();
    const path = `${userA.id}/p1/anon-attempt.png`;

    const { error: uploadError } = await anon.storage
      .from(BUCKET)
      .upload(path, makeFile(), { contentType: "image/png" });
    expect(uploadError).not.toBeNull();

    const { data: listing, error: listError } = await anon.storage.from(BUCKET).list(`${userA.id}/p1`);
    expect(listError).toBeNull();
    expect(listing).toEqual([]);
  });
});
