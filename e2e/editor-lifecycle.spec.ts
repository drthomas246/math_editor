import { expect, test, type Page } from "@playwright/test";
test("自動保存後のリロードで最新データを復元する", (/**
 * 期待する振る舞いを検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @returns 非同期処理の結果
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
 * 期待する振る舞いを検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @returns 非同期処理の結果
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
 * 期待する振る舞いを検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @returns 非同期処理の結果
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
 * openNewWorksheetに対応する画面表示を更新する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
 */
async function openNewWorksheet(page: Page): Promise<void> {
    await page.goto("/");
    await page.getByRole("button", { name: "新しいプリント" }).first().click();
    await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
    await expect(page.getByRole("textbox", { name: "プリント題名" })).toBeVisible();
}
