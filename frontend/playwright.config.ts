import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.E2E_JWT_SECRET ??= randomBytes(32).toString("base64");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:13000",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-e2e.mjs",
    url: "http://localhost:13000/login",
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
