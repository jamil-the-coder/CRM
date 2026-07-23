import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Default 5s is too tight once the full suite runs its DB-heavy tests in
    // parallel under load (bcrypt cost-12 hashing, multi-step CRUD flows) —
    // individual tests were passing in isolation but timing out under load.
    testTimeout: 15000,
    env: {
      // Pin to the mock calendar provider regardless of the developer's own
      // .env — the calendar tests exercise MockCalendarProvider's behavior
      // specifically, and shouldn't start failing just because a real
      // CALENDAR_PROVIDER is configured for actual local use.
      CALENDAR_PROVIDER: "mock",
    },
  },
});
