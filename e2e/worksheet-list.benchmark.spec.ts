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
     * 「${scenario.description} × ${scenario.worksheetCount.toLocaleString("ja-JP")}件の一覧性能を計測する」という仕様を操作結果から検証する。
     *
     * @param page Playwrightが提供するブラウザーページ
     * @param testInfo 実行中のテスト情報
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
             * ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する。
             *
             * @param worksheets 処理対象となるプリント一覧
             * @returns ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する処理の完了時に解決するPromise
             */
            async function evaluateCallback2(worksheets) {
                const startedAt = performance.now();
                const database = await openDatabase();
                const transaction = database.transaction("worksheets", "readwrite");
                const store = transaction.objectStore("worksheets");
                worksheets.forEach((/**
                 * 各処理対象となるプリントについてputを実行し、対応関係または検証状態を更新する。
                 *
                 * @param worksheet 処理対象となるプリント
                 */
                function processItem3(worksheet) {
                    return store.put(worksheet);
                }));
                await transactionComplete(transaction);
                database.close();
                return performance.now() - startedAt;
                /**
                 * Databaseを取得して利用可能な状態へ反映する。
                 *
                 * @returns Databaseを外部状態から取得し、利用者が操作できる画面状態へ反映する処理の完了時に解決するPromise
                 */
                function openDatabase(): Promise<IDBDatabase> {
                    return new Promise((/**
                     * 画像の読み込み完了と失敗イベントを、レイアウト処理がawaitできるPromiseへ変換する。
                     *
                     * @param resolve 非同期処理を正常完了させるPromise関数
                     * @param reject 非同期処理を失敗として終了させるPromise関数
                     */
                    function settlePromise4(resolve, reject) {
                        const request = indexedDB.open("math-worksheet-db");
                        request.addEventListener("success", (/**
                         * 「success」イベントを受け、現在のDOMまたは編集状態へ反映する。
                         *
                         */
                        function handleDomEvent5() {
                            return resolve(request.result);
                        }), { once: true });
                        request.addEventListener("error", (/**
                         * 「error」イベントを受け、現在のDOMまたは編集状態へ反映する。
                         *
                         */
                        function handleDomEvent6() {
                            return reject(request.error);
                        }), { once: true });
                    }));
                }
                /**
                 * 完了を監視するIndexedDBトランザクションを基にtransaction・Completeを導出する。
                 *
                 * @param transactionValue 完了を監視するIndexedDBトランザクション
                 * @returns 完了を監視するIndexedDBトランザクションを基にtransaction・Completeを導出する処理の完了時に解決するPromise
                 */
                function transactionComplete(transactionValue: IDBTransaction): Promise<void> {
                    return new Promise((/**
                     * 画像の読み込み完了と失敗イベントを、レイアウト処理がawaitできるPromiseへ変換する。
                     *
                     * @param resolve 非同期処理を正常完了させるPromise関数
                     * @param reject 非同期処理を失敗として終了させるPromise関数
                     */
                    function settlePromise7(resolve, reject) {
                        transactionValue.addEventListener("complete", (/**
                         * 「complete」イベントを受け、現在のDOMまたは編集状態へ反映する。
                         *
                         */
                        function handleDomEvent8() {
                            return resolve();
                        }), { once: true });
                        transactionValue.addEventListener("error", (/**
                         * 「error」イベントを受け、現在のDOMまたは編集状態へ反映する。
                         *
                         */
                        function handleDomEvent9() {
                            return reject(transactionValue.error);
                        }), { once: true });
                        transactionValue.addEventListener("abort", (/**
                         * 「abort」イベントを受け、現在のDOMまたは編集状態へ反映する。
                         *
                         */
                        function handleDomEvent10() {
                            return reject(transactionValue.error);
                        }), { once: true });
                    }));
                }
            }), fixtures.slice(offset, offset + SEED_BATCH_SIZE));
        }
        const repository = await page.evaluate((/**
         * ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す。
         *
         * @returns ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す処理の完了時に解決するPromise
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
             * Heap・Usedを入力データまたは現在の状態から取り出す。
             *
             * @returns 条件に応じて選択した値から算出した数値
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
             * ブラウザーの対応APIからheap使用量を取得し、未対応時はnullを返す。
             *
             * @returns ブラウザー内で取得または計測した値
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
 * 環境変数の文字列を正の数として検証し、不正な場合は安全な既定値へ戻す。
 *
 * @param value read・Positive・番号で判定または変換する入力値
 * @param fallback 設定値が不正な場合に採用する既定値
 * @returns 設定値が不正な場合に採用する既定値から算出した数値
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
