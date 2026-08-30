import { expect, test } from "@playwright/test";

import {
  createWorksheetListFixtures,
  summarizeWorksheetComplexity,
  WORKSHEET_LIST_BENCHMARK_SCENARIOS,
} from "../src/test/fixtures/performance-benchmark-fixtures";

type WorksheetRepositoryModule = typeof import("../src/infrastructure/indexeddb/dexie-worksheet-repository");

const PAGE_SIZE = 50;
const SEED_BATCH_SIZE = 25;
const DEFAULT_MAX_SEARCH_MS = 1_000;
const DEFAULT_MAX_PAGE_CHANGE_MS = 1_000;

const DEFAULT_SCENARIO_THRESHOLDS = {
  minimal: { maxRepositoryListMs: 2_000, maxFirstPageRenderMs: 5_000 },
  typical: { maxRepositoryListMs: 4_000, maxFirstPageRenderMs: 8_000 },
  heavy: { maxRepositoryListMs: 8_000, maxFirstPageRenderMs: 15_000 },
};

for (const scenario of WORKSHEET_LIST_BENCHMARK_SCENARIOS) {
  test(`${scenario.description} × ${scenario.worksheetCount.toLocaleString("ja-JP")}件の一覧性能を計測する`, async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await page.goto("/");

    const defaultThresholds = DEFAULT_SCENARIO_THRESHOLDS[scenario.profile];
    const thresholds = {
      maxRepositoryListMs: readPositiveNumber(
        process.env.LIST_BENCHMARK_MAX_REPOSITORY_MS,
        defaultThresholds.maxRepositoryListMs,
      ),
      maxFirstPageRenderMs: readPositiveNumber(
        process.env.LIST_BENCHMARK_MAX_RENDER_MS,
        defaultThresholds.maxFirstPageRenderMs,
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
    const fixtures = createWorksheetListFixtures(scenario.profile, scenario.worksheetCount);
    const expectedSecondPageTitle = fixtures[scenario.worksheetCount - PAGE_SIZE - 1]!.title;
    let seedMs = 0;
    for (let offset = 0; offset < fixtures.length; offset += SEED_BATCH_SIZE) {
      seedMs += await page.evaluate(async (worksheets) => {
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
      }, fixtures.slice(offset, offset + SEED_BATCH_SIZE));
    }

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
    await expect(page.getByText(`${scenario.worksheetCount} PRINTS`)).toBeVisible();
    const firstPageRenderMs = Date.now() - renderStartedAt;

    const pageChangeStartedAt = Date.now();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page.getByText(`2 / ${Math.ceil(scenario.worksheetCount / PAGE_SIZE)}`)).toBeVisible();
    await expect(page.locator(".worksheet-title-button", { hasText: expectedSecondPageTitle })).toBeVisible();
    const pageChangeMs = Date.now() - pageChangeStartedAt;

    const searchStartedAt = Date.now();
    await page.getByRole("textbox", { name: "題名で検索" }).fill("検索対象プリント");
    await expect(page.locator(".worksheet-row")).toHaveCount(1, { timeout: thresholds.maxSearchMs });
    await expect(page.locator(".worksheet-title-button", { hasText: "検索対象プリント" })).toBeVisible();
    const searchMs = Date.now() - searchStartedAt;

    const result = {
      dataset: {
        profile: scenario.profile,
        description: scenario.description,
        worksheets: scenario.worksheetCount,
        renderedRows: PAGE_SIZE,
        perWorksheet: summarizeWorksheetComplexity(fixtures[0]!),
      },
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

    await testInfo.attach(`${scenario.profile}-worksheet-list-benchmark.json`, {
      body: JSON.stringify(result, null, 2),
      contentType: "application/json",
    });
    console.info(`${scenario.profile} ${scenario.worksheetCount} worksheets: repository ${repository.durationMs.toFixed(1)}ms; first render ${firstPageRenderMs}ms; search ${searchMs}ms; page change ${pageChangeMs}ms`);

    expect(repository.worksheets).toBe(scenario.worksheetCount);
    expect(repository.invalidCount).toBe(0);
    expect(repository.durationMs).toBeLessThan(thresholds.maxRepositoryListMs);
    expect(firstPageRenderMs).toBeLessThan(thresholds.maxFirstPageRenderMs);
    expect(searchMs).toBeLessThan(thresholds.maxSearchMs);
    expect(pageChangeMs).toBeLessThan(thresholds.maxPageChangeMs);
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
