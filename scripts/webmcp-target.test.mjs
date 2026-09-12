import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { OFFICIAL_APP_URL, resolveSugakuJitateTarget } from "../AI/skills/sugaku-jitate-textbook-import/scripts/resolve_sugaku_jitate_target.mjs";

const toolNames = ["sujita_get_capabilities", "sujita_validate_import", "sujita_import_worksheet"];
describe("WebMCP接続先の実行時解決", function targets() {
  it("開いている対象ページを明示URLやテストURLより優先する", function discovered() {
    expect(resolveSugakuJitateTarget({ pages: [{ url: "http://localhost:5189/worksheets/123", toolNames }], userTargetUrl: "https://other.example", testTargetUrl: "http://localhost:6000" })).toEqual({ success: true, url: "http://localhost:5189/worksheets/123", source: "discovered", directImportToolAvailable: true });
  });
  it("名前だけのページや片方のツールだけを持つページを選ばない", function metadataOnly() {
    expect(resolveSugakuJitateTarget({ pages: [{ url: "https://example.com", title: "すうがく仕立て", toolNames: [toolNames[0]] }] })).toEqual({ success: true, url: OFFICIAL_APP_URL, source: "official" });
  });
  it("発見できなければ利用者、自己テストの順で実際のURLを使う", function explicit() {
    expect(resolveSugakuJitateTarget({ userTargetUrl: "https://example.com/editor", testTargetUrl: "http://localhost:6000" })).toEqual({ success: true, url: "https://example.com/editor", source: "user" });
    expect(resolveSugakuJitateTarget({ testTargetUrl: "http://localhost:6000" })).toEqual({ success: true, url: "http://localhost:6000/", source: "test" });
  });
  it("複数候補を勝手に選ばず、明示された対象だけに絞る", function ambiguous() {
    const pages = [{ url: "https://first.example/", toolNames }, { url: "https://second.example/", toolNames }];
    expect(resolveSugakuJitateTarget({ pages })).toMatchObject({ success: false, error: { reason: "ambiguous" } });
    expect(resolveSugakuJitateTarget({ pages, userTargetUrl: "https://second.example" })).toEqual({ success: true, url: "https://second.example/", source: "discovered", directImportToolAvailable: true });
  });
  it("未指定なら正式URLを使い、危険な明示URLは拒否する", function officialOrSafe() {
    for (const value of [undefined, null, {}]) {
      expect(resolveSugakuJitateTarget(value)).toEqual({ success: true, url: OFFICIAL_APP_URL, source: "official" });
    }
    for (const value of [{ userTargetUrl: "file:///tmp/editor" }, { userTargetUrl: "javascript:alert(1)" }, { userTargetUrl: "https://user:pass@example.com" }]) {
      expect(resolveSugakuJitateTarget(value)).toMatchObject({ success: false, error: { code: "TARGET_URL_REQUIRED" } });
    }
    expect(resolveSugakuJitateTarget({ userTargetUrl: "bad", testTargetUrl: "https://test.example" })).toMatchObject({ success: false });
  });
  it("同一URLの別タブをpageIdで選択し、以後の呼出先を固定できる", function sameUrlTabs() {
    const pages = [{ pageId: "one", url: "https://example.com/", toolNames }, { pageId: "two", url: "https://example.com/", toolNames }];
    expect(resolveSugakuJitateTarget({ pages, userTargetUrl: pages[0].url })).toMatchObject({ success: false, error: { reason: "ambiguous" } });
    expect(resolveSugakuJitateTarget({ pages, selectedPageId: "two", userTargetUrl: pages[1].url })).toMatchObject({ success: true, pageId: "two", directImportToolAvailable: true });
    expect(resolveSugakuJitateTarget({ pages: [pages[0]] })).toMatchObject({ success: true, pageId: "one" });
  });
  it("存在しないpageIdやURLと競合する選択を別ページへ置換しない", function invalidPageSelection() {
    const pages = [{ pageId: "one", url: "https://first.example/", toolNames }, { pageId: "two", url: "https://second.example/", toolNames }];
    expect(resolveSugakuJitateTarget({ pages, selectedPageId: "missing" })).toMatchObject({ success: false, error: { reason: "page-not-found" } });
    expect(resolveSugakuJitateTarget({ pages, selectedPageId: "one", userTargetUrl: pages[1].url })).toMatchObject({ success: false, error: { reason: "target-conflict" } });
    expect(resolveSugakuJitateTarget({ pages, selectedPageId: " " })).toMatchObject({ success: false, error: { reason: "invalid-page-id" } });
  });
  it("事前検証だけのページも発見し、直接取込ツールの不在を明示する", function validationOnly() {
    const validationTools = toolNames.slice(0, 2);
    expect(resolveSugakuJitateTarget({ pages: [{ pageId: "read-only", url: "https://example.com/", toolNames: validationTools }] })).toMatchObject({ success: true, pageId: "read-only", directImportToolAvailable: false });
  });
  it("CLIが実行時の観測ファイルを読み、成功と選択待ちを終了コードでも返す", function cli() {
    const directory = mkdtempSync(join(tmpdir(), "sugaku-jitate-target-test-"));
    const input = join(directory, "pages.json");
    const script = fileURLToPath(new URL("../AI/skills/sugaku-jitate-textbook-import/scripts/resolve_sugaku_jitate_target.mjs", import.meta.url));
    try {
      writeFileSync(input, JSON.stringify({ pages: [{ url: "http://localhost:6091/", toolNames }] }));
      const success = spawnSync(process.execPath, [script, "--input", input], { encoding: "utf8" });
      expect(success.status).toBe(0);
      expect(JSON.parse(success.stdout)).toMatchObject({ success: true, url: "http://localhost:6091/" });
      writeFileSync(input, "{}");
      const official = spawnSync(process.execPath, [script, "--input", input], { encoding: "utf8" });
      expect(official.status).toBe(0);
      expect(JSON.parse(official.stdout)).toEqual({ success: true, url: OFFICIAL_APP_URL, source: "official" });
    } finally {
      // このテストが作成した一つのファイルと空ディレクトリだけを解放する。
      unlinkSync(input);
      rmdirSync(directory);
    }
  });
});
