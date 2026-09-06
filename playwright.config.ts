import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3200",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  webServer: {
    command: "node --env-file-if-exists=.env.local scripts/e2e-server.mjs",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
