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
};
