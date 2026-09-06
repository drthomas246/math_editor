import { expect, test, type Page } from "@playwright/test";
test("自動保存後のリロードで最新データを復元する", (/**
 * 「自動保存後のリロードで最新データを復元する」という仕様を操作結果から検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @returns テスト内の操作と検証が完了したときに解決するPromise
 */
async function runTestCase1({ page }) {
    await openNewWorksheet(page);
    const title = page.getByRole("textbox", { name: "プリント題名" });
    await title.fill("ブラウザE2E保存");
    await expect(page.getByText("未保存", { exact: true })).toBeVisible();
    await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "プリント題名" })).toHaveValue("ブラウザE2E保存");
}));
test("dirty状態でタブを閉じるとbeforeunload警告を要求する", (/**
 * 「dirty状態でタブを閉じるとbeforeunload警告を要求する」という仕様を操作結果から検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @returns テスト内の操作と検証が完了したときに解決するPromise
 */
async function runTestCase2({ page }) {
    await openNewWorksheet(page);
    await page.getByRole("textbox", { name: "プリント題名" }).fill("閉じる前の未保存データ");
    await expect(page.getByText("未保存", { exact: true })).toBeVisible();
    const dialogPromise = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.dismiss();
    expect(page.isClosed()).toBe(false);
    await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
    await page.close();
}));
test("ブラウザの戻る操作でも編集内容をIndexedDBへ残す", (/**
 * 「ブラウザの戻る操作でも編集内容をIndexedDBへ残す」という仕様を操作結果から検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @returns テスト内の操作と検証が完了したときに解決するPromise
 */
async function runTestCase3({ page }) {
    await openNewWorksheet(page);
    await page.getByRole("textbox", { name: "プリント題名" }).fill("戻る操作で保存");
    await expect(page.getByText("未保存", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: "戻る操作で保存", exact: true })).toBeVisible();
}));
/**
 * 一覧から新規プリントを作成し、編集画面が操作可能になるまで待機する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns 一覧から新規プリントを作成し、編集画面が操作可能になるまで待機する処理の完了時に解決するPromise
 */
async function openNewWorksheet(page: Page): Promise<void> {
    await page.goto("/");
    await page.getByRole("button", { name: "新しいプリント" }).first().click();
    await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
    await expect(page.getByRole("textbox", { name: "プリント題名" })).toBeVisible();
}
