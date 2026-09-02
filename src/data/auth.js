// Thin wrapper over supabase-js Auth. The login screen is UX only -- RLS is
// the actual security boundary (see design.md "Auth and session gating").
export function makeAuth(client) {
  return {
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return true;
    },

    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    onAuthStateChange(callback) {
      return client.auth.onAuthStateChange(callback);
    },
  };
}
