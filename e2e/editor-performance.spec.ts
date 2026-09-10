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
         * 入力後に2回の描画フレームを待ち、開始マークから描画が落ち着くまでの時間を計測する。
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
         * @returns 入力開始から2回目の描画フレームまでの経過時間（ミリ秒）
         */
        async function evaluateCallback3() {
            await new Promise<void>((/**
             * レイアウト確定後の描画フレームを、呼び出し側がawaitできるPromiseへ変換する。
             *
             * @param resolve 非同期処理を正常完了させるPromise関数
             */
            function settlePromise4(resolve) {
                return requestAnimationFrame((/**
                 * 入力直後の描画を待ったうえで、計測終了用の次フレームを予約する。
                 *
                 */
                function handleAnimationFrame5() {
                    return requestAnimationFrame((/**
                     * 2回目の描画フレームで待機を終え、描画のばらつきを計測へ含める。
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
     * 入力遅延を昇順に並べ、95パーセンタイルを選べるようにする。
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
 * @returns 作成したプリントのID
 */
async function openNewWorksheet(page: Page): Promise<string> {
    await page.goto("/");
    await page.getByRole("button", { name: "新しいプリント" }).first().click();
    await expect(page).toHaveURL(/\/worksheets\/[^/]+$/u);
    return new URL(page.url()).pathname.split("/").at(-1)!;
}
/**
 * 対象プリントを指定件数の問題へ複製し、入力性能を測定できる状態にする。
 *
 * @param page ブラウザー操作と描画確認に使うPlaywrightページ
 * @param worksheetId 問題を追加するプリントのID
 * @param count 用意する問題数
 * @returns IndexedDBへの登録が完了したときに解決するPromise
 */
async function seedProblems(page: Page, worksheetId: string, count: number): Promise<void> {
    await page.evaluate((/**
     * ブラウザーのIndexedDBへ性能測定用fixtureを登録し、トランザクション完了まで待機する。
     *
     * @param callbackInput 対象プリントのIDと用意する問題数
     * @returns 性能測定用データの保存が完了したときに解決するPromise
     */
    async function evaluateCallback8(callbackInput) {
        let { id, problemCount } = callbackInput;
        const database = await new Promise<IDBDatabase>((/**
         * テスト対象アプリのIndexedDB接続要求をPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise9(resolve, reject) {
            const request = indexedDB.open("math-worksheet-db");
            request.addEventListener("success", (/**
             * 接続に成功したデータベースを後続の登録処理へ渡す。
             *
             */
            function handleDomEvent10() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * IndexedDB接続エラーを呼び出し元へ伝える。
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
         * プリント取得要求をPromiseへ変換し、既存データを複製処理へ渡す。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise12(resolve, reject) {
            const request = store.get(id);
            request.addEventListener("success", (/**
             * IndexedDBから取得したプリントを複製処理へ渡す。
             *
             */
            function handleDomEvent13() {
                return resolve(request.result);
            }), { once: true });
            request.addEventListener("error", (/**
             * プリント取得エラーを呼び出し元へ伝える。
             *
             */
            function handleDomEvent14() {
                return reject(request.error);
            }), { once: true });
        }));
        const template = worksheet.problems[0]!;
        worksheet.problems = Array.from({ length: problemCount }, (/**
         * 元の問題を複製し、性能測定用の一意な問題として初期化する。
         *
         * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
         * @param index 対象となる位置
         * @returns 一意なIDと表示文を設定した問題
         */
        function fromCallback15(_, index) {
            const problem = structuredClone(template);
            problem.id = crypto.randomUUID();
            problem.contents.forEach((/**
             * 複製した本文・解説が互いに衝突しないよう新しいIDを割り当てる。
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
         * 更新トランザクションの完了または失敗をPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise17(resolve, reject) {
            transaction.addEventListener("complete", (/**
             * すべての変更が永続化された時点で待機を終了する。
             *
             */
            function handleDomEvent18() {
                return resolve();
            }), { once: true });
            transaction.addEventListener("error", (/**
             * トランザクション中のエラーを呼び出し元へ伝える。
             *
             */
            function handleDomEvent19() {
                return reject(transaction.error);
            }), { once: true });
            transaction.addEventListener("abort", (/**
             * 中断されたトランザクションを失敗として呼び出し元へ伝える。
             *
             */
            function handleDomEvent20() {
                return reject(transaction.error);
            }), { once: true });
        }));
        database.close();
    }), { id: worksheetId, problemCount: count });
}
