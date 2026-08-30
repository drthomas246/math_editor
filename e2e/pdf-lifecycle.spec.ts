import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("1ページPDFを実ブラウザで生成してダウンロードできる", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("button", { name: "新しいプリント" }).first().click();
  await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);

  await page.getByRole("button", { name: "PDF出力" }).click();
  const dialog = page.getByRole("dialog", { name: "PDF出力" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ページ数: 1ページ")).toBeVisible({ timeout: 30_000 });
  const downloadButton = dialog.getByRole("button", { name: "PDFをダウンロード" });
  await expect(downloadButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  await downloadButton.click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("生成したPDFの一時ファイルを取得できませんでした");
  const pdfBytes = await readFile(downloadPath);

  expect(download.suggestedFilename()).toMatch(/\.pdf$/u);
  expect(pdfBytes.length).toBeGreaterThan(5_000);
  expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
});
