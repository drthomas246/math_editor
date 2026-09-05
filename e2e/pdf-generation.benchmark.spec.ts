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
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param pageCount pageCountとして使用する値
     * @returns 呼び出し元で使用する処理結果
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
     * 期待する振る舞いを検証する。
     *
     * @param page Playwrightが提供するブラウザーページ
     * @param testInfo 実行中のテスト情報
     * @returns 非同期処理の結果
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
 * seedWorksheetに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @param fixture fixtureとして使用する値
 * @returns 非同期処理の結果
 */
async function seedWorksheet(page: Page, fixture: PdfBenchmarkFixture): Promise<void> {
    await page.goto("/");
    await page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 非同期処理の結果
     */
    async function evaluateCallback3(parameter1) {
        let { worksheet, assets } = parameter1;
        const database = await new Promise<IDBDatabase>((/**
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
        const transaction = database.transaction(["worksheets", "assets"], "readwrite");
        transaction.objectStore("worksheets").put(worksheet);
        const assetStore = transaction.objectStore("assets");
        assets.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param asset assetとして使用する値
         */
        function processItem7(asset) {
            const { dataBase64, ...metadata } = asset;
            const binary = atob(dataBase64);
            const bytes = Uint8Array.from(binary, (/**
             * fromへ渡す処理を実行する。
             *
             * @param character characterとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function fromCallback8(character) {
                return character.charCodeAt(0);
            }));
            assetStore.put({ ...metadata, blob: new Blob([bytes], { type: asset.mimeType }) });
        }));
        await new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback9(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent10() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent11() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
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
 * startHeapSamplingに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
 */
async function startHeapSampling(page: Page): Promise<void> {
    await page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     */
    function evaluateCallback13() {
        const target = window as typeof window & {
            __pdfBenchmarkHeap?: HeapSampleState;
        };
        const read = (/**
         * readで必要な値を取得する。
         *
         * @returns 呼び出し元で使用する処理結果
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
         * setIntervalへ渡す処理を実行する。
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
 * stopHeapSamplingに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
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
         * evaluateへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
 * browserIdentityに必要な処理を実行する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
 */
async function browserIdentity(page: Page): Promise<{
    userAgent: string;
}> {
    if (page.isClosed())
        return { userAgent: "browser page closed" };
    try {
        return await page.evaluate((/**
         * evaluateへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
 * readPdfPerformanceMeasuresで必要な値を取得する。
 *
 * @param page pageとして使用する値
 * @returns 非同期処理の結果
 */
async function readPdfPerformanceMeasures(page: Page): Promise<{
    fonts: number | null;
    rasterization: number | null;
    assembly: number | null;
}> {
    return page.evaluate((/**
     * evaluateへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function evaluateCallback18() {
        const duration = (/**
         * durationに必要な処理を実行する。
         *
         * @param name nameとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function durationImplementation19(name: string): number | null {
            return performance.getEntriesByName(name, "measure").at(-1)?.duration ?? null;
        });
        return {
            fonts: duration("math-editor.pdf.fonts"),
            rasterization: duration("math-editor.pdf.rasterization"),
            assembly: duration("math-editor.pdf.assembly"),
        };
    }));
}
/**
 * attachResultに必要な処理を実行する。
 *
 * @param testInfo testInfoとして使用する値
 * @param scenarioId 対象を識別するID
 * @param result 処理によって得られた結果
 * @returns 非同期処理の結果
 */
async function attachResult(testInfo: TestInfo, scenarioId: string, result: unknown): Promise<void> {
    await testInfo.attach(`pdf-${scenarioId}-benchmark.json`, {
        body: JSON.stringify(result, null, 2),
        contentType: "application/json",
    });
}
/**
 * formatBytesの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function formatBytes(value: number | null): string {
    return value === null ? "unavailable" : `${(value / 1024 / 1024).toFixed(1)}MiB`;
}
/**
 * formatMillisecondsの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function formatMilliseconds(value: number | null): string {
    return value === null ? "unavailable" : `${value.toFixed(1)}ms`;
}
/**
 * readPageCountsで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function readPageCounts(value: string | undefined): number[] {
    if (value === undefined)
        return [50, 100];
    const values = value.split(",").map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param entry 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem20(entry) {
        return Number(entry.trim());
    }));
    if (values.length === 0 || values.some((/**
     * 条件に一致する要素か判定する。
     *
     * @param entry 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function hasMatchingItem21(entry) {
        return !Number.isInteger(entry) || entry <= 0 || entry > 200;
    }))) {
        throw new Error(`PDF_BENCHMARK_PAGE_COUNTS must contain integers from 1 to 200: ${value}`);
    }
    return [...new Set(values)];
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
        throw new Error(`PDF_BENCHMARK_MAX_GENERATION_MS must be a positive number: ${value}`);
    }
    return parsed;
}
/**
 * readPositiveIntegerで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @param fallback fallbackとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
