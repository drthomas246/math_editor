import { expect, test, type Page } from "@playwright/test";
import { createSingleBackup } from "../src/application/backup/backup";
import { createWorksheet } from "../src/domain/worksheet/worksheet.defaults";
import { APP_SCHEMA_SHA256 } from "../src/infrastructure/webmcp/math-editor-capabilities";
import type { MathEditorModelContextTool } from "../src/infrastructure/webmcp/webmcp";

type TestWindow = Window & { mathEditorTestTools: Map<string, MathEditorModelContextTool> };

/** WebMCP登録APIを再現し、登録ツールをブラウザー内テストから呼べるようにする。 */
function installModelContext(): void {
  const tools = new Map<string, MathEditorModelContextTool>();
  (window as unknown as TestWindow).mathEditorTestTools = tools;
  /**
   * Math Editorから公開されたツールを保持する。
   * @param tool 登録するWebMCPツール
   * @param options ページ終了時の登録解除シグナル
   * @returns 登録完了時に解決するPromise
   */
  async function registerTool(tool: MathEditorModelContextTool, options?: { signal: AbortSignal }): Promise<void> {
    tools.set(tool.name, tool);
    /** ページ終了時に対象ツールを登録一覧から取り除く。 */
    function unregister(): void { tools.delete(tool.name); }
    options?.signal.addEventListener("abort", unregister, { once: true });
  }
  Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool } });
  Object.defineProperty(navigator, "modelContext", { configurable: true, value: undefined });
}

/**
 * Phase 3の3ツールが利用可能になるまで待機する。
 * @param page 実行中のブラウザーページ
 * @returns ツール登録待ちの完了
 */
async function waitForTools(page: Page): Promise<void> {
  /**
   * Phase 3の公開ツールが揃ったか判定する。
   * @returns 3ツールすべてが登録されていればtrue
   */
  function hasAllTools(): boolean {
    return (window as unknown as TestWindow).mathEditorTestTools.size === 3;
  }
  await page.waitForFunction(hasAllTools);
}

test("Consent後の直接取込を一覧へ反映し、同じrequestIdの再試行とreloadから回復する", /**
 * WebMCPホスト相当の呼出しを実ブラウザーで保存・表示同期まで検証する。
 * @param page Playwrightが提供するブラウザーページ
 * @returns Phase 3のE2E検証完了
 */
async function importsDirectlyAndRecovers({ page }) {
  await page.addInitScript(installModelContext);
  await page.goto("/");
  await waitForTools(page);
  const worksheet = createWorksheet();
  worksheet.title = "WebMCP直接取込";
  worksheet.header.title = worksheet.title;
  const payloadText = JSON.stringify(await createSingleBackup(worksheet, []));
  const requestId = "e2e-direct-import-request";

  /**
   * 検証ツールで候補を作成する。
   * @param input 完成payloadとSchemaハッシュ
   * @returns 検証済み候補の要約
   */
  async function validateCandidate(input: { payloadText: string; schemaSha256: string }) {
    const tools = (window as unknown as TestWindow).mathEditorTestTools;
    return tools.get("math_editor_validate_import")!.execute({
      payloadText: input.payloadText,
      skillSchemaSha256: input.schemaSha256,
    }, { signal: new AbortController().signal });
  }
  const candidate = await page.evaluate(validateCandidate, { payloadText, schemaSha256: APP_SCHEMA_SHA256 }) as {
    candidateToken: string;
    payloadSha256: string;
    worksheetId: string;
  };
  const importInput = {
    candidateToken: candidate.candidateToken,
    requestId,
    expectedPayloadSha256: candidate.payloadSha256,
  };

  /**
   * 直接取込ツールを実行して現在の保存件数も返す。
   * @param input 候補トークン、要求ID、payloadハッシュ
   * @returns ツール結果とIndexedDBのプリント件数
   */
  async function importCandidate(input: typeof importInput) {
    const tools = (window as unknown as TestWindow).mathEditorTestTools;
    const modulePath = "/src/infrastructure/indexeddb/database.ts";
    const { database } = await import(modulePath);
    const result = await tools.get("math_editor_import_worksheet")!.execute(input, { signal: new AbortController().signal });
    return { result, count: await database.worksheets.count() };
  }
  const denied = await page.evaluate(importCandidate, importInput);
  expect(denied).toMatchObject({ result: { success: false, error: { code: "CONSENT_REQUIRED" } }, count: 0 });

  await page.getByRole("button", { name: "AI連携: OFF" }).click();
  await page.getByRole("button", { name: "許可" }).click();
  await expect(page.getByRole("button", { name: "AI連携: ON" })).toBeVisible();
  const first = await page.evaluate(importCandidate, importInput);
  const replay = await page.evaluate(importCandidate, importInput);
  expect(first).toMatchObject({ result: { success: true, worksheetId: candidate.worksheetId, title: "WebMCP直接取込" }, count: 1 });
  expect(replay).toEqual(first);
  await expect(page.getByRole("button", { name: "WebMCP直接取込", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("AIから追加しました");

  await page.reload();
  await waitForTools(page);
  await expect(page.getByRole("button", { name: "AI連携: OFF" })).toBeVisible();
  const deniedAfterReload = await page.evaluate(importCandidate, importInput);
  expect(deniedAfterReload).toMatchObject({ result: { success: false, error: { code: "CONSENT_REQUIRED" } }, count: 1 });
  await page.getByRole("button", { name: "AI連携: OFF" }).click();
  await page.getByRole("button", { name: "許可" }).click();
  const recovered = await page.evaluate(importCandidate, importInput);
  expect(recovered).toEqual(first);
  await expect(page.getByRole("button", { name: "WebMCP直接取込", exact: true })).toBeVisible();
});
