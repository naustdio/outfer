import { describe, it, expect } from "vitest";
import { makeFakeClient } from "./_fakeClient.js";
import { makeAuth } from "../../../src/data/auth.js";

describe("makeAuth", () => {
  it("signIn() calls auth.signInWithPassword with email/password", async () => {
    const client = makeFakeClient({ responses: [{ data: { session: {} }, error: null }] });
    const auth = makeAuth(client);

    await auth.signIn("owner@example.com", "hunter2");

    expect(client.calls[0]).toEqual({
      auth: "signInWithPassword",
      args: [{ email: "owner@example.com", password: "hunter2" }],
    });
  });

  it("signIn() throws when Supabase Auth rejects the credentials", async () => {
    const client = makeFakeClient({ responses: [{ data: null, error: { message: "invalid credentials" } }] });
    const auth = makeAuth(client);

    await expect(auth.signIn("owner@example.com", "wrong")).rejects.toEqual({
      message: "invalid credentials",
    });
  });

  it("signOut() calls auth.signOut", async () => {
    const client = makeFakeClient({ responses: [{ error: null }] });
    const auth = makeAuth(client);

    await auth.signOut();

    expect(client.calls[0]).toEqual({ auth: "signOut", args: [] });
  });

  it("getSession() calls auth.getSession and returns the session", async () => {
    const client = makeFakeClient({ responses: [{ data: { session: { user: { id: "u1" } } }, error: null }] });
    const auth = makeAuth(client);

    const session = await auth.getSession();

    expect(client.calls[0]).toEqual({ auth: "getSession", args: [] });
    expect(session).toEqual({ user: { id: "u1" } });
  });

  it("onAuthStateChange() forwards to auth.onAuthStateChange", () => {
    const client = makeFakeClient();
    const auth = makeAuth(client);
    const cb = () => {};

    auth.onAuthStateChange(cb);

    expect(client.calls[0]).toEqual({ auth: "onAuthStateChange", args: [cb] });
  });
});
