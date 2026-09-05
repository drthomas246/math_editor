import { expect, test, type Page } from "@playwright/test";
import { createEditorStressFixture, EDITOR_STRESS_CONTENTS_PER_PROBLEM, EDITOR_STRESS_PROBLEM_COUNT, EDITOR_STRESS_SUBQUESTIONS_PER_GROUP, } from "../src/test/fixtures/editor-stress-fixture";
const WARMUP_KEYSTROKES = 3;
const MEASURED_KEYSTROKES = 20;
const DEFAULT_MAX_P95_INPUT_LATENCY_MS = 250;
const DEFAULT_MAX_INITIAL_LOAD_MS = 30000;
const DEFAULT_MAX_TARGET_SELECTION_MS = 2000;
const MAX_P95_INPUT_LATENCY_MS = readPositiveNumber(process.env.EDITOR_STRESS_MAX_P95_MS, DEFAULT_MAX_P95_INPUT_LATENCY_MS);
const MAX_INITIAL_LOAD_MS = readPositiveNumber(process.env.EDITOR_STRESS_MAX_INITIAL_LOAD_MS, DEFAULT_MAX_INITIAL_LOAD_MS);
const MAX_TARGET_SELECTION_MS = readPositiveNumber(process.env.EDITOR_STRESS_MAX_SELECTION_MS, DEFAULT_MAX_TARGET_SELECTION_MS);
// 入出力時間ではなくエディタ構造と描画性能を測るため、負荷データでは
// 正常な透過1×1 PNGの小さなBlobを意図的に再利用する。
const PNG_BYTES = [
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
    0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240,
    31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69,
    78, 68, 174, 66, 96, 130,
];
test("200問の複合Worksheetでも入力レイテンシを上限内に保つ", (/**
 * 期待する振る舞いを検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @param testInfo 実行中のテスト情報
 * @returns 非同期処理の結果
 */
async function runTestCase1({ page }, testInfo) {
    test.setTimeout(300000);
    const worksheetId = await openNewWorksheet(page);
    const fixture = createEditorStressFixture();
    fixture.worksheet.id = worksheetId;
    fixture.assets.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param asset assetとして使用する値
     */
    function processItem2(asset) { asset.worksheetId = worksheetId; }));
    await seedStressFixture(page, fixture);
    const loadStartedAt = Date.now();
    await page.reload();
    const problemCards = page.locator("[data-editor-problem-id]");
    await expect(problemCards).toHaveCount(EDITOR_STRESS_PROBLEM_COUNT, { timeout: 180000 });
    await expect(page.locator(".content-card-static")).toHaveCount(EDITOR_STRESS_PROBLEM_COUNT * EDITOR_STRESS_CONTENTS_PER_PROBLEM - 1, { timeout: 180000 });
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
    await expect(page.locator("[data-pagination-ready=\"true\"]")).toBeVisible({ timeout: 180000 });
    const initialLoadMs = Date.now() - loadStartedAt;
    const targetCard = problemCards.nth(Math.floor(EDITOR_STRESS_PROBLEM_COUNT / 2));
    const selectionStartedAt = Date.now();
    await targetCard.scrollIntoViewIfNeeded();
    await targetCard.locator(".content-card-static").first().click();
    const editor = targetCard.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
    const targetSelectionMs = Date.now() - selectionStartedAt;
    await editor.focus();
    for (let index = 0; index < WARMUP_KEYSTROKES; index += 1) {
        await page.keyboard.type("0");
        await waitForTwoAnimationFrames(page);
    }
    const durationsMs: number[] = [];
    for (let index = 0; index < MEASURED_KEYSTROKES; index += 1) {
        await page.evaluate((/**
         * evaluateへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function evaluateCallback3() {
            return performance.mark("editor-stress-input-start");
        }));
        await page.keyboard.type(String(index % 10));
        durationsMs.push(await page.evaluate((/**
         * evaluateへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function evaluateCallback4() {
            await new Promise<void>((/**
             * 呼び出し元から要求された処理を実行する。
             *
             * @param resolve resolveとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function commentRuleCallback5(resolve) {
                return requestAnimationFrame((/**
                 * 次の描画タイミングで画面状態を更新する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleAnimationFrame6() {
                    return requestAnimationFrame((/**
                     * 次の描画タイミングで画面状態を更新する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function handleAnimationFrame7() {
                        return resolve();
                    }));
                }));
            }));
            return performance.now()
                - performance.getEntriesByName("editor-stress-input-start", "mark").at(-1)!.startTime;
        })));
    }
    const sortedDurations = [...durationsMs].sort((/**
     * 表示順を決めるため二つの要素を比較する。
     *
     * @param left leftとして使用する値
     * @param right rightとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function compareItems8(left, right) {
        return left - right;
    }));
    const p95Ms = sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1]
        ?? Number.POSITIVE_INFINITY;
    const browserStats = await page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function evaluateCallback9() {
        return ({
            domNodes: document.getElementsByTagName("*").length,
            previewAtoms: document.querySelectorAll("[data-pagination-atom]").length,
            heapUsedBytes: "memory" in performance
                ? (performance as Performance & {
                    memory: {
                        usedJSHeapSize: number;
                    };
                }).memory.usedJSHeapSize
                : null,
        });
    }));
    const result = {
        dataset: {
            problems: EDITOR_STRESS_PROBLEM_COUNT,
            contentsPerProblem: EDITOR_STRESS_CONTENTS_PER_PROBLEM,
            subQuestionsPerGroup: EDITOR_STRESS_SUBQUESTIONS_PER_GROUP,
            assets: fixture.assets.length,
            measuredKeystrokes: MEASURED_KEYSTROKES,
        },
        thresholds: {
            maxInitialLoadMs: MAX_INITIAL_LOAD_MS,
            maxTargetSelectionMs: MAX_TARGET_SELECTION_MS,
            maxP95InputLatencyMs: MAX_P95_INPUT_LATENCY_MS,
        },
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
    expect(initialLoadMs).toBeLessThan(MAX_INITIAL_LOAD_MS);
    expect(targetSelectionMs).toBeLessThan(MAX_TARGET_SELECTION_MS);
    expect(p95Ms).toBeLessThan(MAX_P95_INPUT_LATENCY_MS);
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
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
 * seedStressFixtureに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @param fixture fixtureとして使用する値
 * @returns 非同期処理の結果
 */
async function seedStressFixture(page: Page, fixture: ReturnType<typeof createEditorStressFixture>): Promise<void> {
    await page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 非同期処理の結果
     */
    async function evaluateCallback10(parameter1) {
        let { worksheet, assets, pngBytes } = parameter1;
        const database = await new Promise<IDBDatabase>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback11(resolve, reject) {
            const request = indexedDB.open("math-worksheet-db");
            request.addEventListener("success", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent12() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent13() {
                return reject(request.error);
            }), { once: true });
        }));
        const transaction = database.transaction(["worksheets", "assets"], "readwrite");
        transaction.objectStore("worksheets").put(worksheet);
        const assetStore = transaction.objectStore("assets");
        for (const asset of assets) {
            assetStore.put({
                ...asset,
                blob: new Blob([new Uint8Array(pngBytes)], { type: asset.mimeType }),
            });
        }
        await new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback14(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent15() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent16() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent17() {
                return reject(transaction.error);
            }), { once: true });
        }));
        database.close();
    }), { ...fixture, pngBytes: PNG_BYTES });
}
/**
 * waitForTwoAnimationFramesに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
 */
async function waitForTwoAnimationFrames(page: Page): Promise<void> {
    await page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     *
     * @returns 非同期処理の結果
     */
    async function evaluateCallback18() {
        await new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback19(resolve) {
            return requestAnimationFrame((/**
             * 次の描画タイミングで画面状態を更新する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleAnimationFrame20() {
                return requestAnimationFrame((/**
                 * 次の描画タイミングで画面状態を更新する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleAnimationFrame21() {
                    return resolve();
                }));
            }));
        }));
    }));
}
/**
 * readPositiveNumberで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @param fallback fallbackとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function readPositiveNumber(value: string | undefined, fallback: number): number {
    if (value === undefined)
        return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`EDITOR_STRESS_MAX_P95_MS must be a positive number: ${value}`);
    }
    return parsed;
}
