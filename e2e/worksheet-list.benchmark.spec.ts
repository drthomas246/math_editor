import { expect, test } from "@playwright/test";

import { STRUCTURE_LIMITS } from "../src/domain/worksheet/structure-limits";
import type { Worksheet } from "../src/domain/worksheet/worksheet";
import { createWorksheet } from "../src/domain/worksheet/worksheet.defaults";

type WorksheetRepositoryModule = typeof import("../src/infrastructure/indexeddb/dexie-worksheet-repository");

const WORKSHEET_COUNT = STRUCTURE_LIMITS.worksheetsPerArchive;
const PAGE_SIZE = 50;
const DEFAULT_MAX_REPOSITORY_LIST_MS = 2_000;
const DEFAULT_MAX_FIRST_PAGE_RENDER_MS = 5_000;
const DEFAULT_MAX_SEARCH_MS = 1_000;
const DEFAULT_MAX_PAGE_CHANGE_MS = 1_000;

const thresholds = {
  maxRepositoryListMs: readPositiveNumber(
    process.env.LIST_BENCHMARK_MAX_REPOSITORY_MS,
    DEFAULT_MAX_REPOSITORY_LIST_MS,
  ),
  maxFirstPageRenderMs: readPositiveNumber(
    process.env.LIST_BENCHMARK_MAX_RENDER_MS,
    DEFAULT_MAX_FIRST_PAGE_RENDER_MS,
  ),
  maxSearchMs: readPositiveNumber(
    process.env.LIST_BENCHMARK_MAX_SEARCH_MS,
    DEFAULT_MAX_SEARCH_MS,
  ),
  maxPageChangeMs: readPositiveNumber(
    process.env.LIST_BENCHMARK_MAX_PAGE_CHANGE_MS,
    DEFAULT_MAX_PAGE_CHANGE_MS,
  ),
};

test("2,000件の一覧取得・初期表示・検索・ページ切り替えを計測する", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");

  const fixtures = createWorksheetFixtures(WORKSHEET_COUNT);
  const seedMs = await page.evaluate(async (worksheets) => {
    const startedAt = performance.now();
    const database = await openDatabase();
    const transaction = database.transaction("worksheets", "readwrite");
    const store = transaction.objectStore("worksheets");
    worksheets.forEach((worksheet) => store.put(worksheet));
    await transactionComplete(transaction);
    database.close();
    return performance.now() - startedAt;

    function openDatabase(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("math-worksheet-db");
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
    }

    function transactionComplete(transactionValue: IDBTransaction): Promise<void> {
      return new Promise((resolve, reject) => {
        transactionValue.addEventListener("complete", () => resolve(), { once: true });
        transactionValue.addEventListener("error", () => reject(transactionValue.error), { once: true });
        transactionValue.addEventListener("abort", () => reject(transactionValue.error), { once: true });
      });
    }
  }, fixtures);

  const repository = await page.evaluate(async () => {
    const modulePath = "/src/infrastructure/indexeddb/dexie-worksheet-repository.ts";
    const { worksheetRepository } = await import(/* @vite-ignore */ modulePath) as WorksheetRepositoryModule;
    const heapBeforeBytes = readHeapUsed();
    const startedAt = performance.now();
    const result = await worksheetRepository.list();
    return {
      durationMs: performance.now() - startedAt,
      worksheets: result.worksheets.length,
      invalidCount: result.invalidCount,
      heapBeforeBytes,
      heapAfterBytes: readHeapUsed(),
    };

    function readHeapUsed(): number | null {
      return "memory" in performance
        ? (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
        : null;
    }
  });

  const renderStartedAt = Date.now();
  await page.reload();
  await expect(page.locator(".worksheet-row")).toHaveCount(PAGE_SIZE, { timeout: thresholds.maxFirstPageRenderMs });
  await expect(page.getByText(`${WORKSHEET_COUNT} PRINTS`)).toBeVisible();
  const firstPageRenderMs = Date.now() - renderStartedAt;

  const pageChangeStartedAt = Date.now();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByText(`2 / ${WORKSHEET_COUNT / PAGE_SIZE}`)).toBeVisible();
  await expect(page.locator(".worksheet-title-button", { hasText: "一覧性能テスト 1949" })).toBeVisible();
  const pageChangeMs = Date.now() - pageChangeStartedAt;

  const searchStartedAt = Date.now();
  await page.getByRole("textbox", { name: "題名で検索" }).fill("検索対象プリント");
  await expect(page.locator(".worksheet-row")).toHaveCount(1, { timeout: thresholds.maxSearchMs });
  await expect(page.locator(".worksheet-title-button", { hasText: "検索対象プリント" })).toBeVisible();
  const searchMs = Date.now() - searchStartedAt;

  const result = {
    dataset: { worksheets: WORKSHEET_COUNT, renderedRows: PAGE_SIZE },
    thresholds,
    seedMs,
    repository,
    ui: { firstPageRenderMs, pageChangeMs, searchMs },
    browser: await page.evaluate(() => ({
      domNodes: document.getElementsByTagName("*").length,
      heapUsedBytes: "memory" in performance
        ? (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
        : null,
    })),
  };

  await testInfo.attach("worksheet-list-benchmark.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.info(`2,000 worksheets: repository ${repository.durationMs.toFixed(1)}ms; first render ${firstPageRenderMs}ms; search ${searchMs}ms; page change ${pageChangeMs}ms`);

  expect(repository.worksheets).toBe(WORKSHEET_COUNT);
  expect(repository.invalidCount).toBe(0);
  expect(repository.durationMs).toBeLessThan(thresholds.maxRepositoryListMs);
  expect(firstPageRenderMs).toBeLessThan(thresholds.maxFirstPageRenderMs);
  expect(searchMs).toBeLessThan(thresholds.maxSearchMs);
  expect(pageChangeMs).toBeLessThan(thresholds.maxPageChangeMs);
});

function createWorksheetFixtures(count: number): Worksheet[] {
  const baseTime = Date.parse("2026-08-28T00:00:00.000Z");
  return Array.from({ length: count }, (_, index) => {
    const worksheet = createWorksheet(new Date(baseTime + index * 1_000));
    worksheet.title = index === count - 1
      ? "検索対象プリント"
      : `一覧性能テスト ${String(index).padStart(4, "0")}`;
    worksheet.header.title = worksheet.title;
    return worksheet;
  });
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`一覧benchmarkのしきい値は正の数で指定してください: ${value}`);
  }
  return parsed;
}
