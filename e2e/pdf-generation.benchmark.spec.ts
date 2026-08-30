import { stat } from "node:fs/promises";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  COMPLEX_PDF_BENCHMARK_PAGE_COUNT,
  createComplexPdfBenchmarkFixture,
  createSimplePdfBenchmarkFixture,
  type PdfBenchmarkFixture,
} from "../src/test/fixtures/performance-benchmark-fixtures";

const PAGE_COUNTS = readPageCounts(process.env.PDF_BENCHMARK_PAGE_COUNTS);
const COMPLEX_PAGE_COUNT = readPositiveInteger(
  process.env.PDF_BENCHMARK_COMPLEX_PAGE_COUNT,
  COMPLEX_PDF_BENCHMARK_PAGE_COUNT,
);
const DEFAULT_MAX_GENERATION_MS = 600_000;
const DEFAULT_MAX_MILLISECONDS_PER_PAGE = 1_000;
const MAX_GENERATION_MS = readPositiveNumber(
  process.env.PDF_BENCHMARK_MAX_GENERATION_MS,
  DEFAULT_MAX_GENERATION_MS,
);
const MAX_MILLISECONDS_PER_PAGE = readPositiveNumber(
  process.env.PDF_BENCHMARK_MAX_MS_PER_PAGE,
  DEFAULT_MAX_MILLISECONDS_PER_PAGE,
);

const scenarios = [
  ...PAGE_COUNTS.map((pageCount) => ({
    id: `simple-${pageCount}`,
    profile: "simple" as const,
    pageCount,
    description: `${pageCount}ページの短文`,
  })),
  {
    id: `complex-${COMPLEX_PAGE_COUNT}`,
    profile: "complex" as const,
    pageCount: COMPLEX_PAGE_COUNT,
    description: `${COMPLEX_PAGE_COUNT}ページの数式・表・画像`,
  },
];

for (const scenario of scenarios) {
  test(`${scenario.description}を含むPDFの生成時間・heap・成功を計測する`, async ({ page }, testInfo) => {
    test.setTimeout(MAX_GENERATION_MS + 240_000);
    const fixture = scenario.profile === "complex"
      ? createComplexPdfBenchmarkFixture(scenario.pageCount)
      : createSimplePdfBenchmarkFixture(scenario.pageCount);
    const { worksheet } = fixture;
    await seedWorksheet(page, fixture);

    const editorLoadStartedAt = Date.now();
    await page.goto(`/worksheets/${worksheet.id}`);
    await expect(page.locator("[data-editor-problem-id]")).toHaveCount(scenario.pageCount, { timeout: 180_000 });
    await expect(page.locator("[data-pagination-ready=\"true\"]").first()).toBeVisible({ timeout: 180_000 });
    const editorLoadMs = Date.now() - editorLoadStartedAt;

    await page.getByRole("button", { name: "PDF出力" }).click();
    const dialog = page.getByRole("dialog", { name: "PDF出力" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /問題のみ/u }).check();
    await expect(dialog.getByText(`ページ数: ${scenario.pageCount}ページ`)).toBeVisible({ timeout: 180_000 });
    await startHeapSampling(page);

    const generationStartedAt = Date.now();
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: MAX_GENERATION_MS });
      await dialog.getByRole("button", { name: "PDFをダウンロード" }).click();
      const download = await downloadPromise;
      const generationMs = Date.now() - generationStartedAt;
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("生成したPDFの一時ファイルを取得できませんでした");
      const pdfBytes = (await stat(downloadPath)).size;
      const heap = await stopHeapSampling(page);
      const stagesMs = await readPdfPerformanceMeasures(page);
      const result = {
        dataset: {
          profile: scenario.profile,
          pages: scenario.pageCount,
          problems: worksheet.problems.length,
          assets: fixture.assets.length,
          includesMathTableAndImage: scenario.profile === "complex",
          attempts: 1,
        },
        threshold: {
          maxGenerationMs: MAX_GENERATION_MS,
          maxMillisecondsPerPage: MAX_MILLISECONDS_PER_PAGE,
        },
        success: true,
        successRatePercent: 100,
        editorLoadMs,
        generationMs,
        millisecondsPerPage: generationMs / scenario.pageCount,
        pdfBytes,
        heap,
        stagesMs,
        browser: await browserIdentity(page),
      };

      await attachResult(testInfo, scenario.id, result);
      await testInfo.attach(`pdf-${scenario.id}-output.pdf`, {
        path: downloadPath,
        contentType: "application/pdf",
      });
      console.info(`${scenario.id} PDF: ${generationMs}ms (${result.millisecondsPerPage.toFixed(1)}ms/page), ${(pdfBytes / 1024 / 1024).toFixed(1)}MiB, peak heap ${formatBytes(heap.peakBytes)}`);
      console.info(`Stages: fonts ${formatMilliseconds(stagesMs.fonts)}, rasterization ${formatMilliseconds(stagesMs.rasterization)}, assembly ${formatMilliseconds(stagesMs.assembly)}`);

      expect(download.suggestedFilename()).toMatch(/\.pdf$/u);
      expect(pdfBytes).toBeGreaterThan(1_000);
      expect(generationMs).toBeLessThan(MAX_GENERATION_MS);
      expect(result.millisecondsPerPage).toBeLessThan(MAX_MILLISECONDS_PER_PAGE);
    } catch (reason) {
      const result = {
        dataset: {
          profile: scenario.profile,
          pages: scenario.pageCount,
          problems: worksheet.problems.length,
          assets: fixture.assets.length,
          includesMathTableAndImage: scenario.profile === "complex",
          attempts: 1,
        },
        threshold: {
          maxGenerationMs: MAX_GENERATION_MS,
          maxMillisecondsPerPage: MAX_MILLISECONDS_PER_PAGE,
        },
        success: false,
        successRatePercent: 0,
        editorLoadMs,
        generationMs: Date.now() - generationStartedAt,
        error: reason instanceof Error ? reason.message : String(reason),
        heap: await stopHeapSampling(page),
        browser: await browserIdentity(page),
      };
      await attachResult(testInfo, scenario.id, result);
      throw reason;
    }
  });
}

async function seedWorksheet(page: Page, fixture: PdfBenchmarkFixture): Promise<void> {
  await page.goto("/");
  await page.evaluate(async ({ worksheet, assets }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("math-worksheet-db");
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const transaction = database.transaction(["worksheets", "assets"], "readwrite");
    transaction.objectStore("worksheets").put(worksheet);
    const assetStore = transaction.objectStore("assets");
    assets.forEach((asset) => {
      const { dataBase64, ...metadata } = asset;
      const binary = atob(dataBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      assetStore.put({ ...metadata, blob: new Blob([bytes], { type: asset.mimeType }) });
    });
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    });
    database.close();
  }, fixture);
}

type HeapSampleState = {
  baselineBytes: number | null;
  samples: number[];
  timer: number;
};

async function startHeapSampling(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as typeof window & { __pdfBenchmarkHeap?: HeapSampleState };
    const read = (): number | null => "memory" in performance
      ? (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
      : null;
    const baselineBytes = read();
    const samples = baselineBytes === null ? [] : [baselineBytes];
    const timer = window.setInterval(() => {
      const value = read();
      if (value !== null) samples.push(value);
    }, 100);
    target.__pdfBenchmarkHeap = { baselineBytes, samples, timer };
  });
}

async function stopHeapSampling(page: Page): Promise<{
  baselineBytes: number | null;
  peakBytes: number | null;
  finalBytes: number | null;
  peakIncreaseBytes: number | null;
}> {
  if (page.isClosed()) {
    return { baselineBytes: null, peakBytes: null, finalBytes: null, peakIncreaseBytes: null };
  }
  try {
    return await page.evaluate(() => {
      const target = window as typeof window & { __pdfBenchmarkHeap?: HeapSampleState };
      const state = target.__pdfBenchmarkHeap;
      const finalBytes = "memory" in performance
        ? (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
        : null;
      if (!state) return { baselineBytes: null, peakBytes: null, finalBytes, peakIncreaseBytes: null };
      window.clearInterval(state.timer);
      if (finalBytes !== null) state.samples.push(finalBytes);
      const peakBytes = state.samples.length > 0 ? Math.max(...state.samples) : null;
      delete target.__pdfBenchmarkHeap;
      return {
        baselineBytes: state.baselineBytes,
        peakBytes,
        finalBytes,
        peakIncreaseBytes: peakBytes !== null && state.baselineBytes !== null
          ? peakBytes - state.baselineBytes
          : null,
      };
    });
  } catch {
    return { baselineBytes: null, peakBytes: null, finalBytes: null, peakIncreaseBytes: null };
  }
}

async function browserIdentity(page: Page): Promise<{ userAgent: string }> {
  if (page.isClosed()) return { userAgent: "browser page closed" };
  try {
    return await page.evaluate(() => ({ userAgent: navigator.userAgent }));
  } catch {
    return { userAgent: "browser unavailable" };
  }
}

async function readPdfPerformanceMeasures(page: Page): Promise<{
  fonts: number | null;
  rasterization: number | null;
  assembly: number | null;
}> {
  return page.evaluate(() => {
    const duration = (name: string): number | null => performance.getEntriesByName(name, "measure").at(-1)?.duration ?? null;
    return {
      fonts: duration("math-editor.pdf.fonts"),
      rasterization: duration("math-editor.pdf.rasterization"),
      assembly: duration("math-editor.pdf.assembly"),
    };
  });
}

async function attachResult(
  testInfo: TestInfo,
  scenarioId: string,
  result: unknown,
): Promise<void> {
  await testInfo.attach(`pdf-${scenarioId}-benchmark.json`, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
}

function formatBytes(value: number | null): string {
  return value === null ? "unavailable" : `${(value / 1024 / 1024).toFixed(1)}MiB`;
}

function formatMilliseconds(value: number | null): string {
  return value === null ? "unavailable" : `${value.toFixed(1)}ms`;
}

function readPageCounts(value: string | undefined): number[] {
  if (value === undefined) return [50, 100];
  const values = value.split(",").map((entry) => Number(entry.trim()));
  if (values.length === 0 || values.some((entry) => !Number.isInteger(entry) || entry <= 0 || entry > 200)) {
    throw new Error(`PDF_BENCHMARK_PAGE_COUNTS must contain integers from 1 to 200: ${value}`);
  }
  return [...new Set(values)];
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`PDF_BENCHMARK_MAX_GENERATION_MS must be a positive number: ${value}`);
  }
  return parsed;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
    throw new Error(`PDF_BENCHMARK_COMPLEX_PAGE_COUNT must be an integer from 1 to 200: ${value}`);
  }
  return parsed;
}
