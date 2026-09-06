import { expect, test, type Page } from "@playwright/test";
const PROBLEM_COUNT = 100;
const MEASURED_KEYSTROKES = 12;
const MAX_P95_INPUT_LATENCY_MS = 250;
test("100問で本文や複数の解説を開いても編集中のTipTapを1個に保つ", (/**
 * 「100問で本文や複数の解説を開いても編集中のTipTapを1個に保つ」という仕様を操作結果から検証する。
 *
 * @param page Playwrightが提供するブラウザーページ
 * @param testInfo 実行中のテスト情報
 * @returns テスト内の操作と検証が完了したときに解決するPromise
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
         * ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す。
         *
         * @returns ブラウザー内で取得または計測した値
         */
        function evaluateCallback2() {
            return performance.mark("editor-input-start");
        }));
        await page.keyboard.type(String(index % 10));
        durations.push(await page.evaluate((/**
         * ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す。
         *
         * @returns ブラウザーのPerformance APIで描画または入力遅延を計測し、経過時間を返す処理の完了時に解決するPromise
         */
        async function evaluateCallback3() {
            await new Promise<void>((/**
             * レイアウト確定後の描画フレームを、呼び出し側がawaitできるPromiseへ変換する。
             *
             * @param resolve 非同期処理を正常完了させるPromise関数
             */
            function settlePromise4(resolve) {
                return requestAnimationFrame((/**
                 * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
                 *
                 */
                function handleAnimationFrame5() {
                    return requestAnimationFrame((/**
                     * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
                     *
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
     * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
     *
     * @param left 並び順を比較する左側の値
     * @param right 並び順を比較する右側の値
     * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
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
 * seed・Problemsをevaluateで処理し、その結果を呼び出し元へ反映する。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @param worksheetId 対象を識別するID
 * @param count 生成または検査する要素数
 * @returns seed・Problemsをevaluateで処理し、その結果を呼び出し元へ反映する処理の完了時に解決するPromise
 */
async function seedProblems(page: Page, worksheetId: string, count: number): Promise<void> {
    await page.evaluate((/**
     * ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する。
     *
     * @param callbackInput let・{・id・問題・Countをまとめて受け取るコールバック入力
     * @returns ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する処理の完了時に解決するPromise
     */
    async function evaluateCallback8(callbackInput) {
        let { id, problemCount } = callbackInput;
        const database = await new Promise<IDBDatabase>((/**
         * 画像の読み込み完了と失敗イベントを、レイアウト処理がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise9(resolve, reject) {
            const request = indexedDB.open("math-worksheet-db");
            request.addEventListener("success", (/**
             * 「success」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
             */
            function handleDomEvent10() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * 「error」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
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
         * 画像の読み込み完了と失敗イベントを、レイアウト処理がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise12(resolve, reject) {
            const request = store.get(id);
            request.addEventListener("success", (/**
             * 「success」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
             */
            function handleDomEvent13() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * 「error」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
             */
            function handleDomEvent14() {
                return reject(request.error);
            }), { once: true });
        }));
        const template = worksheet.problems[0]!;
        worksheet.problems = Array.from({ length: problemCount }, (/**
         * 配列位置ごとに処理対象の問題または例題を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
         * @param index 対象となる位置
         * @returns 処理対象の問題または例題
         */
        function fromCallback15(_, index) {
            const problem = structuredClone(template);
            problem.id = crypto.randomUUID();
            problem.contents.forEach((/**
             * 各処理対象の問題本文または解説についてrandom・UUIDを実行し、対応関係または検証状態を更新する。
             *
             * @param content 処理対象の問題本文または解説
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
         * 画像の読み込み完了と失敗イベントを、レイアウト処理がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise17(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * 「complete」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
             */
            function handleDomEvent18() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * 「error」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
             */
            function handleDomEvent19() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * 「abort」イベントを受け、現在のDOMまたは編集状態へ反映する。
             *
             */
            function handleDomEvent20() {
                return reject(transaction.error);
            }), { once: true });
        }));
        database.close();
    }), { id: worksheetId, problemCount: count });
}
