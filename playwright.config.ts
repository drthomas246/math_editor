import { defineConfig } from "@playwright/test";
// 通常のE2Eテストをローカル環境とCIで共通実行するための設定。
export default defineConfig({
    testDir: "./e2e",
    testIgnore: "**/*.benchmark.spec.ts",
    globalSetup: "./e2e/global-setup.ts",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: "http://127.0.0.1:4175",
        headless: true,
        trace: "on-first-retry",
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
    },
});
