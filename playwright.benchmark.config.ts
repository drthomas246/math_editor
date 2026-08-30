import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.benchmark.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  timeout: 300_000,
  use: {
    baseURL: "http://127.0.0.1:4175",
    headless: true,
    launchOptions: { args: ["--enable-precise-memory-info"] },
    // Tracing continuously captures this very large page and materially skews
    // the input latency that this opt-in benchmark is intended to measure.
    trace: "off",
    ...(process.env.CI ? {} : { channel: "chrome" as const }),
  },
});
