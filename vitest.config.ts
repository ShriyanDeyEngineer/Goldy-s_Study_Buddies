/**
 * Vitest configuration — how our unit tests run.
 *
 * Our unit tests cover pure logic only (validation schemas, the password
 * checklist, the join-button state machine, privacy stripping, filter
 * construction, calendar links). None of that needs a browser or a database,
 * so there is no DOM environment here and tests run in plain Node — fast.
 *
 * The one non-obvious bit: the "@" alias must match tsconfig.json's paths
 * entry, otherwise imports like "@/lib/validation/auth" resolve in the app
 * but explode in tests.
 *
 * Run tests with:  npm test        (single pass, used by CI)
 *                  npm run test:watch  (re-runs on save while developing)
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
