import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

// Load .env.local so the `rls` project can see SUPABASE_URL / SUPABASE_ANON_KEY
// without requiring callers to export them manually.
loadEnv({ path: ".env.local" });

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.js"],
        },
      },
      {
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.test.js"],
          // Real network round trips against the local Supabase stack
          // (auth admin API + Postgres) can be slower than the 10s default.
          hookTimeout: 20000,
          testTimeout: 20000,
        },
      },
    ],
  },
});
