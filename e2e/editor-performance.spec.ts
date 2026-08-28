import { expect, test, type Page } from "@playwright/test";

const PROBLEM_COUNT = 100;
const MEASURED_KEYSTROKES = 12;
const MAX_P95_INPUT_LATENCY_MS = 250;

test("100問で本文や複数の解説を開いても編集中のTipTapを1個に保つ", async ({ page }, testInfo) => {
  const worksheetId = await openNewWorksheet(page);
  await seedProblems(page, worksheetId, PROBLEM_COUNT);
  await page.reload();

  const staticContents = page.locator(".content-card-static");
  await expect(staticContents).toHaveCount(PROBLEM_COUNT - 1, { timeout: 30_000 });
  await expect(page.locator(".ProseMirror")).toHaveCount(1);

  const targetCard = page.locator("[data-editor-problem-id]").nth(Math.floor(PROBLEM_COUNT / 2));
  await targetCard.scrollIntoViewIfNeeded();
  await targetCard.locator(".content-card-static").click();

  const editor = targetCard.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  await editor.focus();

  const durations: number[] = [];
  for (let index = 0; index < MEASURED_KEYSTROKES; index += 1) {
    await page.evaluate(() => performance.mark("editor-input-start"));
    await page.keyboard.type(String(index % 10));
    durations.push(await page.evaluate(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return performance.now() - performance.getEntriesByName("editor-input-start", "mark").at(-1)!.startTime;
    }));
  }

  const sorted = [...durations].sort((left, right) => left - right);
  const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
  await testInfo.attach("editor-input-latency.json", {
    body: JSON.stringify({ problemCount: PROBLEM_COUNT, durationsMs: durations, p95Ms }, null, 2),
    contentType: "application/json",
  });
  console.info(`100-problem input latency p95: ${p95Ms.toFixed(1)}ms`);

  expect(p95Ms).toBeLessThan(MAX_P95_INPUT_LATENCY_MS);
  await expect(page.locator(".ProseMirror")).toHaveCount(1);

  const solutionToggles = page.getByRole("button", { name: /教師用の解説/u });
  for (let index = 0; index < 5; index += 1) {
    await solutionToggles.nth(index).click();
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
  }
  await expect(page.locator(".solution-editor")).toHaveCount(5);
  await expect(page.locator(".solution-editor-static")).toHaveCount(4);

  await page.locator(".solution-editor-static").first().click();
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  await expect(page.locator(".solution-editor-static")).toHaveCount(4);
});

async function openNewWorksheet(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "新しいプリント" }).first().click();
  await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function seedProblems(page: Page, worksheetId: string, count: number): Promise<void> {
  await page.evaluate(async ({ id, problemCount }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("math-worksheet-db");
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const transaction = database.transaction("worksheets", "readwrite");
    const store = transaction.objectStore("worksheets");
    const worksheet = await new Promise<{
      title: string;
      header: { title: string };
      updatedAt: string;
      problems: Array<{ id: string; contents: Array<{ id: string }> }>;
    }>((resolve, reject) => {
      const request = store.get(id);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const template = worksheet.problems[0]!;
    worksheet.problems = Array.from({ length: problemCount }, (_, index) => {
      const problem = structuredClone(template);
      problem.id = crypto.randomUUID();
      problem.contents.forEach((content) => { content.id = crypto.randomUUID(); });
      const firstContent = problem.contents[0] as typeof problem.contents[number] & {
        document?: { content: Array<{ type: string; attrs: { textAlign: string }; content: Array<{ type: string; text: string }> }> };
      };
      if (firstContent.document) {
        firstContent.document.content = [{
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [{ type: "text", text: `性能テスト問題 ${index + 1}` }],
        }];
      }
      return problem;
    });
    worksheet.title = "100問入力性能テスト";
    worksheet.header.title = worksheet.title;
    worksheet.updatedAt = new Date().toISOString();
    store.put(worksheet);
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    });
    database.close();
  }, { id: worksheetId, problemCount: count });
}
