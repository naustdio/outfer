// Copy this file to public/config.js (gitignored -- see .gitignore) and
// fill in your Supabase project's URL + anon key. src/main.js reads this
// global before building the Supabase client.
//
// Safe to commit real values into the gitignored copy as a static file:
// the anon key is public by design in this architecture (design.md: RLS is
// the real security boundary, not the key). Never put a service-role key
// here or anywhere client-side.
window.__CLOSET_APP_CONFIG__ = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",

  // Optional, local dev only: signs in automatically on load (a real
  // signInWithPassword() call, RLS still fully applies) instead of showing
  // the login screen every time. Leave unset -- or delete these two lines
  // -- for a real/hosted project. Requires an account that already exists
  // in your local Supabase Auth (create one via `supabase status` +
  // Studio, or the Admin API).
  // DEV_AUTO_LOGIN_EMAIL: "test@closet.local",
  // DEV_AUTO_LOGIN_PASSWORD: "your-local-password",
};
