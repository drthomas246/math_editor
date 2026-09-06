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
 * 「200問の複合Worksheetでも入力レイテンシを上限内に保つ」という仕様を操作結果から検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @param testInfo 実行中のテスト情報
 * @returns テスト内の操作と検証が完了したときに解決するPromise
 */
async function runTestCase1({ page }, testInfo) {
    test.setTimeout(300000);
    const worksheetId = await openNewWorksheet(page);
    const fixture = createEditorStressFixture();
    fixture.worksheet.id = worksheetId;
    fixture.assets.forEach((/**
     * 各処理対象の画像アセットについて更新を実行し、対応関係または検証状態を更新する。
     *
     * @param asset 処理対象の画像アセット
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
         * ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す。
         *
         * @returns ブラウザー内で取得または計測した値
         */
        function evaluateCallback3() {
            return performance.mark("editor-stress-input-start");
        }));
        await page.keyboard.type(String(index % 10));
        durationsMs.push(await page.evaluate((/**
         * ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す。
         *
         * @returns ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す処理の完了時に解決するPromise
         */
        async function evaluateCallback4() {
            await new Promise<void>((/**
             * レイアウト確定後の描画フレームを、呼び出し側がawaitできるPromiseへ変換する。
             *
             * @param resolve 非同期処理を正常完了させるPromise関数
             */
            function settlePromise5(resolve) {
                return requestAnimationFrame((/**
                 * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
                 *
                 */
                function handleAnimationFrame6() {
                    return requestAnimationFrame((/**
                     * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
                     *
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
     * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
     *
     * @param left 並び順を比較する左側の値
     * @param right 並び順を比較する右側の値
     * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
     */
    function compareItems8(left, right) {
        return left - right;
    }));
    const p95Ms = sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1]
        ?? Number.POSITIVE_INFINITY;
    const browserStats = await page.evaluate((/**
     * ブラウザーの対応APIからheap使用量を取得し、未対応時はnullを返す。
     *
     * @returns ブラウザー内で取得または計測した値
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
 * 一覧から新規プリントを作成し、編集画面が操作可能になるまで待機する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns 一覧から新規プリントを作成し、編集画面が操作可能になるまで待機する処理の完了時に解決するPromise
 */
async function openNewWorksheet(page: Page): Promise<string> {
    await page.goto("/");
    await page.getByRole("button", { name: "新しいプリント" }).first().click();
    await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
    return new URL(page.url()).pathname.split("/").at(-1)!;
}
/**
 * 大規模編集ベンチマーク用のプリントと画像をブラウザーへ登録する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @param fixture ブラウザーへ投入する性能測定用データ一式
 * @returns IndexedDBへの登録が完了したときに解決するPromise
 */
async function seedStressFixture(page: Page, fixture: ReturnType<typeof createEditorStressFixture>): Promise<void> {
    await page.evaluate((/**
     * ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する。
     *
     * @param callbackInput プリント、画像アセット一覧、PNGバイト列
     * @returns 性能測定用データの保存が完了したときに解決するPromise
     */
    async function evaluateCallback10(callbackInput) {
        let { worksheet, assets, pngBytes } = callbackInput;
        const database = await new Promise<IDBDatabase>((/**
         * テスト対象アプリのIndexedDB接続要求をPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise11(resolve, reject) {
            const request = indexedDB.open("math-worksheet-db");
            request.addEventListener("success", (/**
             * 接続に成功したデータベースを後続の登録処理へ渡す。
             *
             */
            function handleDomEvent12() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * IndexedDB接続エラーを呼び出し元へ伝える。
             *
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
         * 更新トランザクションの完了または失敗をPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise14(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * プリントと画像が永続化された時点で待機を終了する。
             *
             */
            function handleDomEvent15() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * トランザクション中のエラーを呼び出し元へ伝える。
             *
             */
            function handleDomEvent16() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * 中断されたトランザクションを失敗として呼び出し元へ伝える。
             *
             */
            function handleDomEvent17() {
                return reject(transaction.error);
            }), { once: true });
        }));
        database.close();
    }), { ...fixture, pngBytes: PNG_BYTES });
}
/**
 * レイアウトと描画の反映を計測前に完了させるため、連続する2フレームを待機する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @returns レイアウトと描画の反映を計測前に完了させるため、連続する2フレームを待機する処理の完了時に解決するPromise
 */
async function waitForTwoAnimationFrames(page: Page): Promise<void> {
    await page.evaluate((/**
     * ブラウザー内のDOMまたはWeb APIを操作し、Node側では取得できない検証値を返す。
     *
     * @returns ブラウザー内のDOMまたはWeb APIを操作し、Node側では取得できない検証値を返す処理の完了時に解決するPromise
     */
    async function evaluateCallback18() {
        await new Promise<void>((/**
         * レイアウト確定後の描画フレームを、呼び出し側がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         */
        function settlePromise19(resolve) {
            return requestAnimationFrame((/**
             * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
             *
             */
            function handleAnimationFrame20() {
                return requestAnimationFrame((/**
                 * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
                 *
                 */
                function handleAnimationFrame21() {
                    return resolve();
                }));
            }));
        }));
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
        throw new Error(`EDITOR_STRESS_MAX_P95_MS must be a positive number: ${value}`);
    }
    return parsed;
}
