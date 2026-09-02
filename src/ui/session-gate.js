// Session gate: UX-only routing boundary. RLS is the actual security
// boundary -- see design.md "Auth and session gating": "the gate is UX, RLS
// is security." Wraps navigation so any route other than /login checks for
// a live Supabase Auth session first, recording the intended route so
// login can redirect back to it afterwards.
export function createSessionGate({ auth, router }) {
  let intendedPath = null;

  return {
    async guard(path) {
      const session = await auth.getSession();
      if (!session) {
        intendedPath = path;
        router.redirectToLogin();
        return false;
      }
      router.allow(path);
      return true;
    },

    consumeIntendedPath(fallback = "/prendas") {
      const path = intendedPath ?? fallback;
      intendedPath = null;
      return path;
    },
  };
}
