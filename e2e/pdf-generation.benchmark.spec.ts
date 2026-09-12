import { stat } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { COMPLEX_PDF_BENCHMARK_PAGE_COUNT, createComplexPdfBenchmarkFixture, createSimplePdfBenchmarkFixture, type PdfBenchmarkFixture, } from "../src/test/fixtures/performance-benchmark-fixtures";
const PAGE_COUNTS = readPageCounts(process.env.PDF_BENCHMARK_PAGE_COUNTS);
const COMPLEX_PAGE_COUNT = readPositiveInteger(process.env.PDF_BENCHMARK_COMPLEX_PAGE_COUNT, COMPLEX_PDF_BENCHMARK_PAGE_COUNT);
const DEFAULT_MAX_GENERATION_MS = 600000;
const DEFAULT_MAX_MILLISECONDS_PER_PAGE = 1000;
const MAX_GENERATION_MS = readPositiveNumber(process.env.PDF_BENCHMARK_MAX_GENERATION_MS, DEFAULT_MAX_GENERATION_MS);
const MAX_MILLISECONDS_PER_PAGE = readPositiveNumber(process.env.PDF_BENCHMARK_MAX_MS_PER_PAGE, DEFAULT_MAX_MILLISECONDS_PER_PAGE);
const scenarios = [
    ...PAGE_COUNTS.map((/**
     * 各生成するPDFのページ数を対象を一意に特定する識別子・生成する負荷データの規模区分・生成するPDFのページ数・descriptionを持つオブジェクトへ変換する。
     *
     * @param pageCount 生成するPDFのページ数
     * @returns 対象を一意に特定する識別子・生成する負荷データの規模区分・生成するPDFのページ数・descriptionを持つオブジェクト
     */
    function mapItem1(pageCount) {
        return ({
            id: `simple-${pageCount}`,
            profile: "simple" as const,
            pageCount,
            description: `${pageCount}ページの短文`,
        });
    })),
    {
        id: `complex-${COMPLEX_PAGE_COUNT}`,
        profile: "complex" as const,
        pageCount: COMPLEX_PAGE_COUNT,
        description: `${COMPLEX_PAGE_COUNT}ページの数式・表・画像`,
    },
];
for (const scenario of scenarios) {
    test(`${scenario.description}を含むPDFの生成時間・heap・成功を計測する`, (/**
     * 「${scenario.description}を含むPDFの生成時間・heap・成功を計測する」という仕様を操作結果から検証する。
     *
     * @param page Playwrightが提供するブラウザーページ
     * @param testInfo 実行中のテスト情報
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase2({ page }, testInfo) {
        test.setTimeout(MAX_GENERATION_MS + 240000);
        const fixture = scenario.profile === "complex"
            ? createComplexPdfBenchmarkFixture(scenario.pageCount)
            : createSimplePdfBenchmarkFixture(scenario.pageCount);
        const { worksheet } = fixture;
        await seedWorksheet(page, fixture);
        const editorLoadStartedAt = Date.now();
        await page.goto(`/worksheets/${worksheet.id}`);
        await expect(page.locator("[data-editor-problem-id]")).toHaveCount(scenario.pageCount, { timeout: 180000 });
        await expect(page.locator("[data-pagination-ready=\"true\"]").first()).toBeVisible({ timeout: 180000 });
        const editorLoadMs = Date.now() - editorLoadStartedAt;
        await page.getByRole("button", { name: "PDF出力" }).click();
        const dialog = page.getByRole("dialog", { name: "PDF出力" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("radio", { name: /問題のみ/u }).check();
        await expect(dialog.getByText(`ページ数: ${scenario.pageCount}ページ`)).toBeVisible({ timeout: 180000 });
        await startHeapSampling(page);
        const generationStartedAt = Date.now();
        try {
            const downloadPromise = page.waitForEvent("download", { timeout: MAX_GENERATION_MS });
            await dialog.getByRole("button", { name: "PDFをダウンロード" }).click();
            const download = await downloadPromise;
            const generationMs = Date.now() - generationStartedAt;
            const downloadPath = await download.path();
            if (!downloadPath)
                throw new Error("生成したPDFの一時ファイルを取得できませんでした");
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
            expect(pdfBytes).toBeGreaterThan(1000);
            expect(generationMs).toBeLessThan(MAX_GENERATION_MS);
            expect(result.millisecondsPerPage).toBeLessThan(MAX_MILLISECONDS_PER_PAGE);
        }
        catch (reason) {
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
    }));
}
/**
 * PDF生成ベンチマーク用のプリントと画像をブラウザーへ登録する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @param fixture ブラウザーへ投入する性能測定用データ一式
 * @returns IndexedDBへの登録が完了したときに解決するPromise
 */
async function seedWorksheet(page: Page, fixture: PdfBenchmarkFixture): Promise<void> {
    await page.goto("/");
    await page.evaluate((/**
     * ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する。
     *
     * @param callbackInput プリントと画像アセット一覧
     * @returns 性能測定用データの保存が完了したときに解決するPromise
     */
    async function evaluateCallback3(callbackInput) {
        let { worksheet, assets } = callbackInput;
        const database = await new Promise<IDBDatabase>((/**
         * テスト対象アプリのIndexedDB接続要求をPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise4(resolve, reject) {
            const request = indexedDB.open("math-worksheet-db");
            request.addEventListener("success", (/**
             * 接続に成功したデータベースを後続の登録処理へ渡す。
             *
             */
            function handleDomEvent5() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * IndexedDB接続エラーを呼び出し元へ伝える。
             *
             */
            function handleDomEvent6() {
                return reject(request.error);
            }), { once: true });
        }));
        const transaction = database.transaction(["worksheets", "assets"], "readwrite");
        transaction.objectStore("worksheets").put(worksheet);
        const assetStore = transaction.objectStore("assets");
        assets.forEach((/**
         * 各処理対象の画像アセットについてatobを実行し、対応関係または検証状態を更新する。
         *
         * @param asset 処理対象の画像アセット
         */
        function processItem7(asset) {
            const { dataBase64, ...metadata } = asset;
            const binary = atob(dataBase64);
            const bytes = Uint8Array.from(binary, (/**
             * 配列位置ごとにchar・結果理由・Atの結果を生成し、fixtureまたはバイナリの要素として格納する。
             *
             * @param character 検査中の一文字
             * @returns char・コード・位置の結果
             */
            function fromCallback8(character) {
                return character.charCodeAt(0);
            }));
            assetStore.put({ ...metadata, blob: new Blob([bytes], { type: asset.mimeType }) });
        }));
        await new Promise<void>((/**
         * 更新トランザクションの完了または失敗をPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise9(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * プリントと画像が永続化された時点で待機を終了する。
             *
             */
            function handleDomEvent10() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * トランザクション中のエラーを呼び出し元へ伝える。
             *
             */
            function handleDomEvent11() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * 中断されたトランザクションを失敗として呼び出し元へ伝える。
             *
             */
            function handleDomEvent12() {
                return reject(transaction.error);
            }), { once: true });
        }));
        database.close();
    }), fixture);
}
type HeapSampleState = {
    baselineBytes: number | null;
    samples: number[];
    timer: number;
};
/**
 * PDF生成前のJavaScript heap使用量をChromiumの開発者プロトコルで計測開始する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns PDF生成前のJavaScript heap使用量をChromiumの開発者プロトコルで計測開始する処理の完了時に解決するPromise
 */
async function startHeapSampling(page: Page): Promise<void> {
    await page.evaluate((/**
     * ブラウザーの対応APIからheap使用量を取得し、未対応時はnullを返す。
      * @returns ブラウザー内で取得または計測した値
     */
    function evaluateCallback13() {
        const target = window as typeof window & {
            __pdfBenchmarkHeap?: HeapSampleState;
        };
        const read = (/**
         * readを入力データまたは現在の状態から取り出す。
         *
         * @returns 条件に応じて選択した値から算出した数値
         */
        function readImplementation14(): number | null {
            return "memory" in performance
                ? (performance as Performance & {
                    memory: {
                        usedJSHeapSize: number;
                    };
                }).memory.usedJSHeapSize
                : null;
        });
        const baselineBytes = read();
        const samples = baselineBytes === null ? [] : [baselineBytes];
        const timer = window.setInterval((/**
         * Intervalを現在の編集結果へ反映する。
         */
        function setIntervalCallback15() {
            const value = read();
            if (value !== null)
                samples.push(value);
        }), 100);
        target.__pdfBenchmarkHeap = { baselineBytes, samples, timer };
    }));
}
/**
 * heap計測を終了し、PDF生成中の使用量サンプルを回収する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns heap計測を終了し、PDF生成中の使用量サンプルを回収する処理の完了時に解決するPromise
 */
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
        return await page.evaluate((/**
         * ブラウザーの対応APIからheap使用量を取得し、未対応時はnullを返す。
         *
         * @returns ブラウザー内で取得または計測した値
         */
        function evaluateCallback16() {
            const target = window as typeof window & {
                __pdfBenchmarkHeap?: HeapSampleState;
            };
            const state = target.__pdfBenchmarkHeap;
            const finalBytes = "memory" in performance
                ? (performance as Performance & {
                    memory: {
                        usedJSHeapSize: number;
                    };
                }).memory.usedJSHeapSize
                : null;
            if (!state)
                return { baselineBytes: null, peakBytes: null, finalBytes, peakIncreaseBytes: null };
            window.clearInterval(state.timer);
            if (finalBytes !== null)
                state.samples.push(finalBytes);
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
        }));
    }
    catch {
        return { baselineBytes: null, peakBytes: null, finalBytes: null, peakIncreaseBytes: null };
    }
}
/**
 * 性能測定結果へ添付するブラウザー名とバージョンを取得する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns 性能測定結果へ添付するブラウザー名とバージョンを取得する処理の完了時に解決するPromise
 */
async function browserIdentity(page: Page): Promise<{
    userAgent: string;
}> {
    if (page.isClosed())
        return { userAgent: "browser page closed" };
    try {
        return await page.evaluate((/**
         * ブラウザー内のDOMまたはWeb APIを操作し、Node側では取得できない検証値を返す。
         *
         * @returns ブラウザー内で取得または計測した値
         */
        function evaluateCallback17() {
            return ({ userAgent: navigator.userAgent });
        }));
    }
    catch {
        return { userAgent: "browser unavailable" };
    }
}
/**
 * PDF・Performance・Measuresを入力データまたは現在の状態から取り出す。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns PDF・Performance・Measuresを入力データまたは現在の状態から取り出す処理の完了時に解決するPromise
 */
async function readPdfPerformanceMeasures(page: Page): Promise<{
    fonts: number | null;
    rasterization: number | null;
    assembly: number | null;
}> {
    return page.evaluate((/**
     * ブラウザー内のDOMまたはWeb APIを操作し、Node側では取得できない検証値を返す。
     *
     * @returns ブラウザー内で取得または計測した値
     */
    function evaluateCallback18() {
        const duration = (/**
         * 一回の編集操作に要したミリ秒数を表操作を適用する位置で処理し、その結果を呼び出し元へ反映する。
         *
         * @param name 生成物または計測項目を識別する名前
          * @returns 二つの値を比較した結果から算出した数値
         */
        function durationImplementation19(name: string): number | null {
            return performance.getEntriesByName(name, "measure").at(-1)?.duration ?? null;
        });
        return {
            fonts: duration("sujita.pdf.fonts"),
            rasterization: duration("sujita.pdf.rasterization"),
            assembly: duration("sujita.pdf.assembly"),
        };
    }));
}
/**
 * 性能測定結果を後から比較できるJSONとしてPlaywrightレポートへ添付する。
 *
 * @param testInfo 計測結果を添付するPlaywrightテスト情報
 * @param scenarioId 対象を識別するID
 * @param result 処理によって得られた結果
 * @returns 性能測定結果を後から比較できるJSONとしてPlaywrightレポートへ添付する処理の完了時に解決するPromise
 */
async function attachResult(testInfo: TestInfo, scenarioId: string, result: unknown): Promise<void> {
    await testInfo.attach(`pdf-${scenarioId}-benchmark.json`, {
        body: JSON.stringify(result, null, 2),
        contentType: "application/json",
    });
}
/**
 * Bytesを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value 表示形式・Bytesで判定または変換する入力値
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function formatBytes(value: number | null): string {
    return value === null ? "unavailable" : `${(value / 1024 / 1024).toFixed(1)}MiB`;
}
/**
 * Millisecondsを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value 表示形式・Millisecondsで判定または変換する入力値
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function formatMilliseconds(value: number | null): string {
    return value === null ? "unavailable" : `${value.toFixed(1)}ms`;
}
/**
 * ページ・Countsを入力データまたは現在の状態から取り出す。
 *
 * @param value read・ページ・Countsで判定または変換する入力値
 * @returns 順序を保った要素一覧から算出した数値
 */
function readPageCounts(value: string | undefined): number[] {
    if (value === undefined)
        return [50, 100];
    const values = value.split(",").map((/**
     * 各キーと値の組を番号の結果へ変換する。
     *
     * @param entry キーと値の組
     * @returns 番号の結果
     */
    function mapItem20(entry) {
        return Number(entry.trim());
    }));
    if (values.length === 0 || values.some((/**
     * いずれかのentryが要求条件を満たすか判定する。
     *
     * @param entry キーと値の組
     * @returns is・Integerの結果が存在しないまたはキーと値の組が0以下であるまたはキーと値の組が200より大きい場合はtrue
     */
    function hasMatchingItem21(entry) {
        return !Number.isInteger(entry) || entry <= 0 || entry > 200;
    }))) {
        throw new Error(`PDF_BENCHMARK_PAGE_COUNTS must contain integers from 1 to 200: ${value}`);
    }
    return [...new Set(values)];
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
        throw new Error(`PDF_BENCHMARK_MAX_GENERATION_MS must be a positive number: ${value}`);
    }
    return parsed;
}
/**
 * 環境変数の文字列を正の整数として検証し、不正な場合は安全な既定値へ戻す。
 *
 * @param value read・Positive・Integerで判定または変換する入力値
 * @param fallback 設定値が不正な場合に採用する既定値
 * @returns 設定値が不正な場合に採用する既定値から算出した数値
 */
function readPositiveInteger(value: string | undefined, fallback: number): number {
    if (value === undefined)
        return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
        throw new Error(`PDF_BENCHMARK_COMPLEX_PAGE_COUNT must be an integer from 1 to 200: ${value}`);
    }
    return parsed;
}
