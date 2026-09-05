import { expect, test, type Page } from "@playwright/test";
const PROBLEM_COUNT = 100;
const MEASURED_KEYSTROKES = 12;
const MAX_P95_INPUT_LATENCY_MS = 250;
test("100問で本文や複数の解説を開いても編集中のTipTapを1個に保つ", (/**
 * 期待する振る舞いを検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @param testInfo 実行中のテスト情報
 * @returns 非同期処理の結果
 */
async function runTestCase1({ page }, testInfo) {
    const worksheetId = await openNewWorksheet(page);
    await seedProblems(page, worksheetId, PROBLEM_COUNT);
    await page.reload();
    const staticContents = page.locator(".content-card-static");
    await expect(staticContents).toHaveCount(PROBLEM_COUNT - 1, { timeout: 30000 });
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
        await page.evaluate((/**
         * evaluateへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function evaluateCallback2() {
            return performance.mark("editor-input-start");
        }));
        await page.keyboard.type(String(index % 10));
        durations.push(await page.evaluate((/**
         * evaluateへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function evaluateCallback3() {
            await new Promise<void>((/**
             * 呼び出し元から要求された処理を実行する。
             *
             * @param resolve resolveとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function commentRuleCallback4(resolve) {
                return requestAnimationFrame((/**
                 * 次の描画タイミングで画面状態を更新する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleAnimationFrame5() {
                    return requestAnimationFrame((/**
                     * 次の描画タイミングで画面状態を更新する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function handleAnimationFrame6() {
                        return resolve();
                    }));
                }));
            }));
            return performance.now() - performance.getEntriesByName("editor-input-start", "mark").at(-1)!.startTime;
        })));
    }
    const sorted = [...durations].sort((/**
     * 表示順を決めるため二つの要素を比較する。
     *
     * @param left leftとして使用する値
     * @param right rightとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function compareItems7(left, right) {
        return left - right;
    }));
    const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    await testInfo.attach("editor-input-latency.json", {
        body: JSON.stringify({ problemCount: PROBLEM_COUNT, durationsMs: durations, p95Ms }, null, 2),
        contentType: "application/json",
    });
    console.info(`100-problem input latency p95: ${p95Ms.toFixed(1)}ms`);
    expect(p95Ms).toBeLessThan(MAX_P95_INPUT_LATENCY_MS);
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
    const solutionToggles = page.getByRole("button", { name: "教師用の解説", exact: true });
    for (let index = 0; index < 5; index += 1) {
        const toggle = solutionToggles.nth(index);
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator(".ProseMirror")).toHaveCount(1);
    }
    await expect(page.locator(".solution-editor")).toHaveCount(5);
    await expect(page.locator(".solution-editor-static")).toHaveCount(4);
    await page.locator(".solution-editor-static").first().click();
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
    await expect(page.locator(".solution-editor-static")).toHaveCount(4);
}));
/**
 * openNewWorksheetに対応する画面表示を更新する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
 */
async function openNewWorksheet(page: Page): Promise<string> {
    await page.goto("/");
    await page.getByRole("button", { name: "新しいプリント" }).first().click();
    await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
    return new URL(page.url()).pathname.split("/").at(-1)!;
}
/**
 * seedProblemsに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @param worksheetId 対象を識別するID
 * @param count countとして使用する値
 * @returns 非同期処理の結果
 */
async function seedProblems(page: Page, worksheetId: string, count: number): Promise<void> {
    await page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 非同期処理の結果
     */
    async function evaluateCallback8(parameter1) {
        let { id, problemCount } = parameter1;
        const database = await new Promise<IDBDatabase>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback9(resolve, reject) {
            const request = indexedDB.open("math-worksheet-db");
            request.addEventListener("success", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent10() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent11() {
                return reject(request.error);
            }), { once: true });
        }));
        const transaction = database.transaction("worksheets", "readwrite");
        const store = transaction.objectStore("worksheets");
        const worksheet = await new Promise<{
            title: string;
            header: {
                title: string;
            };
            updatedAt: string;
            problems: Array<{
                id: string;
                contents: Array<{
                    id: string;
                }>;
            }>;
        }>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback12(resolve, reject) {
            const request = store.get(id);
            request.addEventListener("success", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent13() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent14() {
                return reject(request.error);
            }), { once: true });
        }));
        const template = worksheet.problems[0]!;
        worksheet.problems = Array.from({ length: problemCount }, (/**
         * fromへ渡す処理を実行する。
         *
         * @param _ _として使用する値
         * @param index 対象となる位置
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback15(_, index) {
            const problem = structuredClone(template);
            problem.id = crypto.randomUUID();
            problem.contents.forEach((/**
             * 各要素へ必要な処理を適用する。
             *
             * @param content contentとして使用する値
             */
            function processItem16(content) { content.id = crypto.randomUUID(); }));
            const firstContent = problem.contents[0] as typeof problem.contents[number] & {
                document?: {
                    content: Array<{
                        type: string;
                        attrs: {
                            textAlign: string;
                        };
                        content: Array<{
                            type: string;
                            text: string;
                        }>;
                    }>;
                };
            };
            if (firstContent.document) {
                firstContent.document.content = [{
                        type: "paragraph",
                        attrs: { textAlign: "left" },
                        content: [{ type: "text", text: `性能テスト問題 ${index + 1}` }],
                    }];
            }
            return problem;
        }));
        worksheet.title = "100問入力性能テスト";
        worksheet.header.title = worksheet.title;
        worksheet.updatedAt = new Date().toISOString();
        store.put(worksheet);
        await new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback17(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent18() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent19() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent20() {
                return reject(transaction.error);
            }), { once: true });
        }));
        database.close();
    }), { id: worksheetId, problemCount: count });
}
