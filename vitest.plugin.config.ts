import { defineConfig } from "vitest/config";

// 配布スクリプトはブラウザ用setupを使わずNode環境で検査する。
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/math-editor-plugin.test.mjs", "scripts/runtime-capabilities.test.mjs", "scripts/webmcp-target.test.mjs", "scripts/webmcp-delivery.test.mjs"],
  },
});
