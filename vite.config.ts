import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// Reactアプリのビルド条件とユニットテスト環境をまとめて定義する。
export default defineConfig({
    plugins: [react()],
    build: {
        target: ["chrome107", "edge107"],
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        css: true,
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
});
