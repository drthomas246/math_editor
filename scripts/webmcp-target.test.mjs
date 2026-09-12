import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveMathEditorTarget } from "../AI/skills/math-editor-textbook-import/scripts/resolve_math_editor_target.mjs";

const toolNames = ["math_editor_get_capabilities", "math_editor_validate_import", "math_editor_import_worksheet"];
describe("WebMCP接続先の実行時解決", function targets() {
  it("開いている対象ページを明示URLやテストURLより優先する", function discovered() {
    expect(resolveMathEditorTarget({ pages: [{ url: "http://localhost:5189/worksheets/123", toolNames }], userTargetUrl: "https://other.example", testTargetUrl: "http://localhost:6000" })).toEqual({ success: true, url: "http://localhost:5189/worksheets/123", source: "discovered", directImportToolAvailable: true });
  });
  it("名前だけのページや片方のツールだけを持つページを選ばない", function metadataOnly() {
    expect(resolveMathEditorTarget({ pages: [{ url: "https://example.com", title: "Math Editor", toolNames: [toolNames[0]] }] })).toMatchObject({ success: false, error: { code: "TARGET_URL_REQUIRED" } });
  });
  it("発見できなければ利用者、自己テストの順で実際のURLを使う", function explicit() {
    expect(resolveMathEditorTarget({ userTargetUrl: "https://example.com/editor", testTargetUrl: "http://localhost:6000" })).toEqual({ success: true, url: "https://example.com/editor", source: "user" });
    expect(resolveMathEditorTarget({ testTargetUrl: "http://localhost:6000" })).toEqual({ success: true, url: "http://localhost:6000/", source: "test" });
  });
  it("複数候補を勝手に選ばず、明示された対象だけに絞る", function ambiguous() {
    const pages = [{ url: "https://first.example/", toolNames }, { url: "https://second.example/", toolNames }];
    expect(resolveMathEditorTarget({ pages })).toMatchObject({ success: false, error: { reason: "ambiguous" } });
    expect(resolveMathEditorTarget({ pages, userTargetUrl: "https://second.example" })).toEqual({ success: true, url: "https://second.example/", source: "discovered", directImportToolAvailable: true });
  });
  it("未指定や危険なURLでは接続先を推測しない", function noGuessing() {
    for (const value of [undefined, null, {}, { userTargetUrl: "file:///tmp/editor" }, { userTargetUrl: "javascript:alert(1)" }, { userTargetUrl: "https://user:pass@example.com" }]) {
      expect(resolveMathEditorTarget(value)).toMatchObject({ success: false, error: { code: "TARGET_URL_REQUIRED" } });
    }
    expect(resolveMathEditorTarget({ userTargetUrl: "bad", testTargetUrl: "https://test.example" })).toMatchObject({ success: false });
  });
  it("同一URLの別タブをpageIdで選択し、以後の呼出先を固定できる", function sameUrlTabs() {
    const pages = [{ pageId: "one", url: "https://example.com/", toolNames }, { pageId: "two", url: "https://example.com/", toolNames }];
    expect(resolveMathEditorTarget({ pages, userTargetUrl: pages[0].url })).toMatchObject({ success: false, error: { reason: "ambiguous" } });
    expect(resolveMathEditorTarget({ pages, selectedPageId: "two", userTargetUrl: pages[1].url })).toMatchObject({ success: true, pageId: "two", directImportToolAvailable: true });
    expect(resolveMathEditorTarget({ pages: [pages[0]] })).toMatchObject({ success: true, pageId: "one" });
  });
  it("存在しないpageIdやURLと競合する選択を別ページへ置換しない", function invalidPageSelection() {
    const pages = [{ pageId: "one", url: "https://first.example/", toolNames }, { pageId: "two", url: "https://second.example/", toolNames }];
    expect(resolveMathEditorTarget({ pages, selectedPageId: "missing" })).toMatchObject({ success: false, error: { reason: "page-not-found" } });
    expect(resolveMathEditorTarget({ pages, selectedPageId: "one", userTargetUrl: pages[1].url })).toMatchObject({ success: false, error: { reason: "target-conflict" } });
    expect(resolveMathEditorTarget({ pages, selectedPageId: " " })).toMatchObject({ success: false, error: { reason: "invalid-page-id" } });
  });
  it("事前検証だけのページも発見し、直接取込ツールの不在を明示する", function validationOnly() {
    const validationTools = toolNames.slice(0, 2);
    expect(resolveMathEditorTarget({ pages: [{ pageId: "read-only", url: "https://example.com/", toolNames: validationTools }] })).toMatchObject({ success: true, pageId: "read-only", directImportToolAvailable: false });
  });
  it("CLIが実行時の観測ファイルを読み、成功と選択待ちを終了コードでも返す", function cli() {
    const directory = mkdtempSync(join(tmpdir(), "math-editor-target-test-"));
    const input = join(directory, "pages.json");
    const script = fileURLToPath(new URL("../AI/skills/math-editor-textbook-import/scripts/resolve_math_editor_target.mjs", import.meta.url));
    try {
      writeFileSync(input, JSON.stringify({ pages: [{ url: "http://localhost:6091/", toolNames }] }));
      const success = spawnSync(process.execPath, [script, "--input", input], { encoding: "utf8" });
      expect(success.status).toBe(0);
      expect(JSON.parse(success.stdout)).toMatchObject({ success: true, url: "http://localhost:6091/" });
      writeFileSync(input, "{}");
      const missing = spawnSync(process.execPath, [script, "--input", input], { encoding: "utf8" });
      expect(missing.status).toBe(1);
      expect(JSON.parse(missing.stdout)).toMatchObject({ success: false, error: { code: "TARGET_URL_REQUIRED" } });
    } finally {
      // このテストが作成した一つのファイルと空ディレクトリだけを解放する。
      unlinkSync(input);
      rmdirSync(directory);
    }
  });
});
