import { stat } from "node:fs/promises";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { WorksheetSchema, type Worksheet } from "../src/domain/worksheet/worksheet";
import { createProblem, createWorksheet } from "../src/domain/worksheet/worksheet.defaults";

const PAGE_COUNTS = readPageCounts(process.env.PDF_BENCHMARK_PAGE_COUNTS);
const DEFAULT_MAX_GENERATION_MS = 600_000;
const MAX_GENERATION_MS = readPositiveNumber(
  process.env.PDF_BENCHMARK_MAX_GENERATION_MS,
  DEFAULT_MAX_GENERATION_MS,
);

for (const pageCount of PAGE_COUNTS) {
  test(`${pageCount}ページのPDF生成時間・heap・成功を計測する`, async ({ page }, testInfo) => {
    test.setTimeout(MAX_GENERATION_MS + 240_000);
    const worksheet = createPdfFixture(pageCount);
    await seedWorksheet(page, worksheet);

    const editorLoadStartedAt = Date.now();
    await page.goto(`/worksheets/${worksheet.id}`);
    await expect(page.locator("[data-editor-problem-id]")).toHaveCount(pageCount, { timeout: 180_000 });
    await expect(page.locator("[data-pagination-ready=\"true\"]").first()).toBeVisible({ timeout: 180_000 });
    const editorLoadMs = Date.now() - editorLoadStartedAt;

    await page.getByRole("button", { name: "PDF出力" }).click();
    const dialog = page.getByRole("dialog", { name: "PDF出力" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /問題のみ/u }).check();
    await expect(dialog.getByText(`ページ数: ${pageCount}ページ`)).toBeVisible({ timeout: 180_000 });
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
      const result = {
        dataset: { pages: pageCount, problems: worksheet.problems.length, attempts: 1 },
        threshold: { maxGenerationMs: MAX_GENERATION_MS },
        success: true,
        successRatePercent: 100,
        editorLoadMs,
        generationMs,
        millisecondsPerPage: generationMs / pageCount,
        pdfBytes,
        heap,
        browser: await browserIdentity(page),
      };

      await attachResult(testInfo, pageCount, result);
      console.info(`${pageCount}-page PDF: ${generationMs}ms (${result.millisecondsPerPage.toFixed(1)}ms/page), ${(pdfBytes / 1024 / 1024).toFixed(1)}MiB, peak heap ${formatBytes(heap.peakBytes)}`);

      expect(download.suggestedFilename()).toMatch(/\.pdf$/u);
      expect(pdfBytes).toBeGreaterThan(1_000);
      expect(generationMs).toBeLessThan(MAX_GENERATION_MS);
    } catch (reason) {
      const result = {
        dataset: { pages: pageCount, problems: worksheet.problems.length, attempts: 1 },
        threshold: { maxGenerationMs: MAX_GENERATION_MS },
        success: false,
        successRatePercent: 0,
        editorLoadMs,
        generationMs: Date.now() - generationStartedAt,
        error: reason instanceof Error ? reason.message : String(reason),
        heap: await stopHeapSampling(page),
        browser: await browserIdentity(page),
      };
      await attachResult(testInfo, pageCount, result);
      throw reason;
    }
  });
}

function createPdfFixture(pageCount: number): Worksheet {
  const worksheet = createWorksheet(new Date("2026-08-28T00:00:00.000Z"));
  worksheet.title = `${pageCount}ページPDF性能テスト`;
  worksheet.header.title = worksheet.title;
  worksheet.problems = Array.from({ length: pageCount }, (_, index) => {
    const problem = createProblem();
    problem.pageBreakBefore = index > 0;
    const content = problem.contents[0];
    if (content?.type !== "richText") throw new Error("PDF性能テスト用本文を作成できませんでした");
    content.document.content = [{
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [{ type: "text", text: `PDF性能テスト問題 ${index + 1}` }],
    }];
    return problem;
  });
  return WorksheetSchema.parse(worksheet);
}

async function seedWorksheet(page: Page, worksheet: Worksheet): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (value) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("math-worksheet-db");
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const transaction = database.transaction("worksheets", "readwrite");
    transaction.objectStore("worksheets").put(value);
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    });
    database.close();
  }, worksheet);
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

async function attachResult(
  testInfo: TestInfo,
  pageCount: number,
  result: unknown,
): Promise<void> {
  await testInfo.attach(`pdf-${pageCount}-page-benchmark.json`, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
}

function formatBytes(value: number | null): string {
  return value === null ? "unavailable" : `${(value / 1024 / 1024).toFixed(1)}MiB`;
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
