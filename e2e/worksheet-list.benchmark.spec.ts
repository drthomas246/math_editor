import { expect, test } from "@playwright/test";
import { createWorksheetListFixtures, summarizeWorksheetComplexity, WORKSHEET_LIST_BENCHMARK_SCENARIOS, } from "../src/test/fixtures/performance-benchmark-fixtures";
type WorksheetRepositoryModule = typeof import("../src/infrastructure/indexeddb/dexie-worksheet-repository");
const PAGE_SIZE = 50;
const SEED_BATCH_SIZE = 25;
const DEFAULT_MAX_SEARCH_MS = 1000;
const DEFAULT_MAX_PAGE_CHANGE_MS = 1000;
const DEFAULT_SCENARIO_THRESHOLDS = {
    minimal: { maxRepositoryListMs: 2000, maxFirstPageRenderMs: 5000 },
    typical: { maxRepositoryListMs: 4000, maxFirstPageRenderMs: 8000 },
    heavy: { maxRepositoryListMs: 8000, maxFirstPageRenderMs: 15000 },
};
for (const scenario of WORKSHEET_LIST_BENCHMARK_SCENARIOS) {
    test(`${scenario.description} × ${scenario.worksheetCount.toLocaleString("ja-JP")}件の一覧性能を計測する`, (/**
     * 期待する振る舞いを検証する。
     *
     * @param page Playwrightが提供するブラウザーページ
     * @param testInfo 実行中のテスト情報
     * @returns 非同期処理の結果
     */
    async function runTestCase1({ page }, testInfo) {
        test.setTimeout(300000);
        await page.goto("/");
        const defaultThresholds = DEFAULT_SCENARIO_THRESHOLDS[scenario.profile];
        const thresholds = {
            maxRepositoryListMs: readPositiveNumber(process.env.LIST_BENCHMARK_MAX_REPOSITORY_MS, defaultThresholds.maxRepositoryListMs),
            maxFirstPageRenderMs: readPositiveNumber(process.env.LIST_BENCHMARK_MAX_RENDER_MS, defaultThresholds.maxFirstPageRenderMs),
            maxSearchMs: readPositiveNumber(process.env.LIST_BENCHMARK_MAX_SEARCH_MS, DEFAULT_MAX_SEARCH_MS),
            maxPageChangeMs: readPositiveNumber(process.env.LIST_BENCHMARK_MAX_PAGE_CHANGE_MS, DEFAULT_MAX_PAGE_CHANGE_MS),
        };
        const fixtures = createWorksheetListFixtures(scenario.profile, scenario.worksheetCount);
        const expectedSecondPageTitle = fixtures[scenario.worksheetCount - PAGE_SIZE - 1]!.title;
        let seedMs = 0;
        for (let offset = 0; offset < fixtures.length; offset += SEED_BATCH_SIZE) {
            seedMs += await page.evaluate((/**
             * evaluateへ渡す処理を実行する。
             *
             * @param worksheets worksheetsとして使用する値
             * @returns 非同期処理の結果
             */
            async function evaluateCallback2(worksheets) {
                const startedAt = performance.now();
                const database = await openDatabase();
                const transaction = database.transaction("worksheets", "readwrite");
                const store = transaction.objectStore("worksheets");
                worksheets.forEach((/**
                 * 各要素へ必要な処理を適用する。
                 *
                 * @param worksheet worksheetとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function processItem3(worksheet) {
                    return store.put(worksheet);
                }));
                await transactionComplete(transaction);
                database.close();
                return performance.now() - startedAt;
                /**
                 * openDatabaseに対応する画面表示を更新する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function openDatabase(): Promise<IDBDatabase> {
                    return new Promise((/**
                     * 呼び出し元から要求された処理を実行する。
                     *
                     * @param resolve resolveとして使用する値
                     * @param reject rejectとして使用する値
                     */
                    function commentRuleCallback4(resolve, reject) {
                        const request = indexedDB.open("math-worksheet-db");
                        request.addEventListener("success", (/**
                         * DOMから通知されたイベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleDomEvent5() {
                            return resolve(request.result);
                        }), { once: true });
                        request.addEventListener("error", (/**
                         * DOMから通知されたイベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleDomEvent6() {
                            return reject(request.error);
                        }), { once: true });
                    }));
                }
                /**
                 * transactionCompleteに必要な処理を実行する。
                 *
                 * @param transactionValue transactionValueとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function transactionComplete(transactionValue: IDBTransaction): Promise<void> {
                    return new Promise((/**
                     * 呼び出し元から要求された処理を実行する。
                     *
                     * @param resolve resolveとして使用する値
                     * @param reject rejectとして使用する値
                     */
                    function commentRuleCallback7(resolve, reject) {
                        transactionValue.addEventListener("complete", (/**
                         * DOMから通知されたイベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleDomEvent8() {
                            return resolve();
                        }), { once: true });
                        transactionValue.addEventListener("error", (/**
                         * DOMから通知されたイベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleDomEvent9() {
                            return reject(transactionValue.error);
                        }), { once: true });
                        transactionValue.addEventListener("abort", (/**
                         * DOMから通知されたイベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleDomEvent10() {
                            return reject(transactionValue.error);
                        }), { once: true });
                    }));
                }
            }), fixtures.slice(offset, offset + SEED_BATCH_SIZE));
        }
        const repository = await page.evaluate((/**
         * evaluateへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function evaluateCallback11() {
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
            /**
             * readHeapUsedで必要な値を取得する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function readHeapUsed(): number | null {
                return "memory" in performance
                    ? (performance as Performance & {
                        memory: {
                            usedJSHeapSize: number;
                        };
                    }).memory.usedJSHeapSize
                    : null;
            }
        }));
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
            browser: await page.evaluate((/**
             * evaluateへ渡す処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function evaluateCallback12() {
                return ({
                    domNodes: document.getElementsByTagName("*").length,
                    heapUsedBytes: "memory" in performance
                        ? (performance as Performance & {
                            memory: {
                                usedJSHeapSize: number;
                            };
                        }).memory.usedJSHeapSize
                        : null,
                });
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
        throw new Error(`一覧benchmarkのしきい値は正の数で指定してください: ${value}`);
    }
    return parsed;
}
