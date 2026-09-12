import { expect, test, type Page } from "@playwright/test";
import { createWorksheet } from "../src/domain/worksheet/worksheet.defaults";
import { createSingleBackup } from "../src/application/backup/backup";
import { APP_SCHEMA_SHA256 } from "../src/infrastructure/webmcp/sugaku-jitate-capabilities";
import type { SugakuJitateModelContextTool } from "../src/infrastructure/webmcp/webmcp";

type TestWindow = Window & { sugakuJitateTestTools: Map<string, SugakuJitateModelContextTool> };

/**
 * 登録APIだけを再現し、アプリの検証・暗号処理・画像デコードは実装を使う。
 * @param mode 現行API、未対応、登録拒否のいずれを再現するか
 */
function installModelContext(mode: "supported" | "unsupported" | "rejected"): void {
  const tools = new Map<string, SugakuJitateModelContextTool>();
  (window as unknown as TestWindow).sugakuJitateTestTools = tools;
  /**
   * ブラウザによるツール登録を再現する。
   * @param tool 登録されたアプリのツール
   * @param options アプリの登録解除シグナル
   * @returns ツール登録の完了
   */
  async function registerTool(tool: SugakuJitateModelContextTool, options?: { signal: AbortSignal }): Promise<void> {
    if (mode === "rejected") throw new DOMException("Rejected", "NotAllowedError");
    if (tools.has(tool.name)) throw new Error("Duplicate tool");
    tools.set(tool.name, tool);
    /** アプリの終了時に登録を解除する。 */
    function removeTool(): void { tools.delete(tool.name); }
    options?.signal.addEventListener("abort", removeTool, { once: true });
  }
  Object.defineProperty(document, "modelContext", { configurable: true, value: mode === "unsupported" ? undefined : { registerTool } });
  Object.defineProperty(navigator, "modelContext", { configurable: true, value: undefined });
}

/**
 * 登録済みツールがすべて揃うまで待つ。
 * @param page 実行中のブラウザページ
 * @returns 登録待ちの完了
 */
async function waitForTools(page: Page): Promise<void> {
  /**
   * ページ上の3ツールの登録を確認する。
   * @returns 必要な登録が完了していればtrue
   */
  function hasTools(): boolean { return (window as unknown as TestWindow).sugakuJitateTestTools.size === 3; }
  await page.waitForFunction(hasTools);
}

test("WebMCPから実画像を事前検証してもIndexedDBと一覧を変更しない", /**
 * 初期化からツール実行までを実ブラウザで検証する。
 * @param page Playwrightが提供するページ
 * @returns ブラウザ検証の完了
 */
async function validatesInBrowser({ page }) {
  await page.addInitScript(installModelContext, "supported" as const);
  await page.goto("/");
  await waitForTools(page);
  const file = await createSingleBackup(createWorksheet(), []);
  if (file.kind !== "single") throw new Error("単一プリントが必要です");
  const input = { file, skillSchemaSha256: APP_SCHEMA_SHA256 };
  /**
   * 実際の画像を作り、成功と不正画像の検証後にDB件数を比較する。
   * @param data 検証する単一プリントとSchemaハッシュ
   * @returns 能力情報、検証結果、保存件数
   */
  async function runValidation(data: typeof input) {
    const tools = (window as unknown as TestWindow).sugakuJitateTestTools;
    const modulePath = "/src/infrastructure/indexeddb/database.ts";
    const { database } = await import(modulePath);
    const before = [await database.worksheets.count(), await database.assets.count()];
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    canvas.getContext("2d")!.fillRect(0, 0, 2, 2);
    const id = crypto.randomUUID();
    data.file.worksheet.problems[0]!.contents.push({ id: crypto.randomUUID(), type: "image", assetId: id, alt: "実画像", placement: "block", widthPercent: 50 });
    data.file.assets.push({ id, worksheetId: data.file.worksheet.id, mimeType: "image/png", dataBase64: canvas.toDataURL("image/png").split(",")[1]!, width: 2, height: 2, createdAt: data.file.worksheet.createdAt });
    const capabilities = await tools.get("sujita_get_capabilities")!.execute({}, { signal: new AbortController().signal });
    const valid = await tools.get("sujita_validate_import")!.execute({ payloadText: JSON.stringify(data.file), skillSchemaSha256: data.skillSchemaSha256 }, { signal: new AbortController().signal });
    data.file.assets[0]!.width = 3;
    const invalid = await tools.get("sujita_validate_import")!.execute({ payloadText: JSON.stringify(data.file), skillSchemaSha256: data.skillSchemaSha256 }, { signal: new AbortController().signal });
    const after = [await database.worksheets.count(), await database.assets.count()];
    return { capabilities, valid, invalid, before, after, names: [...tools.keys()] };
  }
  const result = await page.evaluate(runValidation, input);
  expect(result.capabilities).toMatchObject({ app: "sujita", schemaSha256: APP_SCHEMA_SHA256, directImportAvailable: true, writeConsentGranted: false });
  expect(result.valid).toMatchObject({ valid: true, assetCount: 1 });
  expect(result.invalid).toMatchObject({ valid: false, error: { code: "INVALID_ASSET" } });
  expect(result.before).toEqual([0, 0]);
  expect(result.after).toEqual(result.before);
  expect(result.names).toEqual(["sujita_get_capabilities", "sujita_validate_import", "sujita_import_worksheet"]);
  await expect(page.getByText("まだプリントがありません", { exact: true })).toBeVisible();
  await page.reload();
  await waitForTools(page);
  await expect(page.getByText("まだプリントがありません", { exact: true })).toBeVisible();
});

for (const mode of ["unsupported", "rejected"] as const) {
  test(`WebMCPが${mode}でも通常のプリント作成と保存が使える`, /**
   * 未対応または拒否されたWebMCPが通常操作を妨げないことを確認する。
   * @param page Playwrightが提供するページ
   * @returns 通常操作の検証完了
   */
  async function normalApp({ page }) {
    const errors: string[] = [];
    /**
     * 起動時の未処理例外を記録する。
     * @param error ブラウザで発生した例外
     */
    function recordError(error: Error): void { errors.push(error.message); }
    page.on("pageerror", recordError);
    await page.addInitScript(installModelContext, mode);
    await page.goto("/");
    await page.getByRole("button", { name: "新しいプリント" }).first().click();
    await page.getByRole("textbox", { name: "プリント題名" }).fill("通常操作の確認");
    await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "プリント題名" })).toHaveValue("通常操作の確認");
    expect(errors).toEqual([]);
  });
}
