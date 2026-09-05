import { defineConfig } from "@playwright/test";
// 測定結果の揺れを抑えるため、ブラウザー性能試験を直列実行する設定。
export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.benchmark.spec.ts",
    globalSetup: "./e2e/global-setup.ts",
    fullyParallel: false,
    workers: 1,
    forbidOnly: true,
    retries: 0,
    reporter: "list",
    timeout: 300000,
    use: {
        baseURL: "http://127.0.0.1:4175",
        headless: true,
        launchOptions: { args: ["--enable-precise-memory-info"] },
        // 大規模画面の継続的なトレースは、ベンチマーク対象の入力遅延へ
        // 無視できない負荷を加えるため、性能測定時は記録しない。
        trace: "off",
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
    },
});
