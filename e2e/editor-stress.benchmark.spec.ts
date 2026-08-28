import { expect, test, type Page } from "@playwright/test";

import {
  createEditorStressFixture,
  EDITOR_STRESS_CONTENTS_PER_PROBLEM,
  EDITOR_STRESS_PROBLEM_COUNT,
  EDITOR_STRESS_SUBQUESTIONS_PER_GROUP,
} from "../src/test/fixtures/editor-stress-fixture";

const WARMUP_KEYSTROKES = 3;
const MEASURED_KEYSTROKES = 20;
const DEFAULT_MAX_P95_INPUT_LATENCY_MS = 250;
const MAX_P95_INPUT_LATENCY_MS = readPositiveNumber(
  process.env.EDITOR_STRESS_MAX_P95_MS,
  DEFAULT_MAX_P95_INPUT_LATENCY_MS,
);

// A valid transparent 1x1 PNG. The stress fixture deliberately reuses small
// blobs so the benchmark measures editor structure and rendering, not I/O.
const PNG_BYTES = [
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240,
  31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130,
];

test("200問の複合Worksheetでも入力レイテンシを上限内に保つ", async ({ page }, testInfo) => {
  test.setTimeout(300_000);

  const worksheetId = await openNewWorksheet(page);
  const fixture = createEditorStressFixture();
  fixture.worksheet.id = worksheetId;
  fixture.assets.forEach((asset) => { asset.worksheetId = worksheetId; });
  await seedStressFixture(page, fixture);

  const loadStartedAt = Date.now();
  await page.reload();
  const problemCards = page.locator("[data-editor-problem-id]");
  await expect(problemCards).toHaveCount(EDITOR_STRESS_PROBLEM_COUNT, { timeout: 180_000 });
  await expect(page.locator(".content-card-static")).toHaveCount(
    EDITOR_STRESS_PROBLEM_COUNT * EDITOR_STRESS_CONTENTS_PER_PROBLEM - 1,
    { timeout: 180_000 },
  );
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  await expect(page.locator("[data-pagination-ready=\"true\"]")).toBeVisible({ timeout: 180_000 });
  const initialLoadMs = Date.now() - loadStartedAt;

  const targetCard = problemCards.nth(Math.floor(EDITOR_STRESS_PROBLEM_COUNT / 2));
  const selectionStartedAt = Date.now();
  await targetCard.scrollIntoViewIfNeeded();
  await targetCard.locator(".content-card-static").first().click();
  const editor = targetCard.locator(".ProseMirror");
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  const targetSelectionMs = Date.now() - selectionStartedAt;
  await editor.focus();

  for (let index = 0; index < WARMUP_KEYSTROKES; index += 1) {
    await page.keyboard.type("0");
    await waitForTwoAnimationFrames(page);
  }

  const durationsMs: number[] = [];
  for (let index = 0; index < MEASURED_KEYSTROKES; index += 1) {
    await page.evaluate(() => performance.mark("editor-stress-input-start"));
    await page.keyboard.type(String(index % 10));
    durationsMs.push(await page.evaluate(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return performance.now()
        - performance.getEntriesByName("editor-stress-input-start", "mark").at(-1)!.startTime;
    }));
  }

  const sortedDurations = [...durationsMs].sort((left, right) => left - right);
  const p95Ms = sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1]
    ?? Number.POSITIVE_INFINITY;
  const browserStats = await page.evaluate(() => ({
    domNodes: document.getElementsByTagName("*").length,
    previewAtoms: document.querySelectorAll("[data-pagination-atom]").length,
    heapUsedBytes: "memory" in performance
      ? (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
      : null,
  }));
  const result = {
    dataset: {
      problems: EDITOR_STRESS_PROBLEM_COUNT,
      contentsPerProblem: EDITOR_STRESS_CONTENTS_PER_PROBLEM,
      subQuestionsPerGroup: EDITOR_STRESS_SUBQUESTIONS_PER_GROUP,
      assets: fixture.assets.length,
      measuredKeystrokes: MEASURED_KEYSTROKES,
    },
    thresholds: { maxP95InputLatencyMs: MAX_P95_INPUT_LATENCY_MS },
    initialLoadMs,
    targetSelectionMs,
    inputLatency: { durationsMs, p95Ms },
    browser: browserStats,
  };

  await testInfo.attach("editor-stress-benchmark.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.info(`200-problem stress input latency p95: ${p95Ms.toFixed(1)}ms`);
  console.info(`Initial render: ${initialLoadMs}ms; target selection: ${targetSelectionMs}ms; DOM nodes: ${browserStats.domNodes}`);

  expect(p95Ms).toBeLessThan(MAX_P95_INPUT_LATENCY_MS);
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
});

async function openNewWorksheet(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "新しいプリント" }).first().click();
  await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function seedStressFixture(
  page: Page,
  fixture: ReturnType<typeof createEditorStressFixture>,
): Promise<void> {
  await page.evaluate(async ({ worksheet, assets, pngBytes }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("math-worksheet-db");
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const transaction = database.transaction(["worksheets", "assets"], "readwrite");
    transaction.objectStore("worksheets").put(worksheet);
    const assetStore = transaction.objectStore("assets");
    for (const asset of assets) {
      assetStore.put({
        ...asset,
        blob: new Blob([new Uint8Array(pngBytes)], { type: asset.mimeType }),
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    });
    database.close();
  }, { ...fixture, pngBytes: PNG_BYTES });
}

async function waitForTwoAnimationFrames(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`EDITOR_STRESS_MAX_P95_MS must be a positive number: ${value}`);
  }
  return parsed;
}
