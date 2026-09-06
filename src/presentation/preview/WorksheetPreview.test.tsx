import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "../../application/pdf/pdf-pagination-guard";
import { plainTextToDocument } from "../../domain/worksheet/rich-text";
import { createAnswerAreaBlock, createGoalBlock, createProblem, createSubQuestionGroup, createTableBlock, createWorksheet, emptyDocument } from "../../domain/worksheet/worksheet.defaults";
import { WorksheetPreview } from "./WorksheetPreview";
describe("WorksheetPreview header", (/**
 * 「WorksheetPreview header」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    afterEach((/**
     * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
     */
    function cleanUpTestCase2() {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    }));
    it("places the year, class, and number lines before their labels", (/**
     * 「places the year, class, and number lines before their labels」という仕様を操作結果から検証する。
     */
    function runTestCase3() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「places the year, class, and number lines before their labels」で外部依存から返す1を固定し、検証を決定的にする。
         *
         * @returns 1
         */
        function fnCallback4() {
            return 1;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const { container } = render(<WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()}/>);
        const fields = Array.from(container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-fields span"));
        expect(fields.map((/**
         * 各寸法を書き換える画像フィールドを寸法を書き換える画像フィールドのテキスト・内容へ変換する。
         *
         * @param field 寸法を書き換える画像フィールド
         * @returns 寸法を書き換える画像フィールドのテキスト・内容
         */
        function mapItem5(field) {
            return field.textContent;
        }))).toEqual(["年", "組", "番", "名前"]);
        expect(fields.slice(0, 3).map((/**
         * 各寸法を書き換える画像フィールドを寸法を書き換える画像フィールドのfirst・要素・子要素のtag・名前へ変換する。
         *
         * @param field 寸法を書き換える画像フィールド
         * @returns 寸法を書き換える画像フィールドのfirst・要素・子要素のtag・名前
         */
        function mapItem6(field) {
            return field.firstElementChild?.tagName;
        }))).toEqual(["I", "I", "I"]);
        expect(fields[3]?.lastElementChild?.tagName).toBe("I");
    }));
    it("問題と例題の種類および独立した番号を表示する", (/**
     * 「問題と例題の種類および独立した番号を表示する」という仕様を操作結果から検証する。
     */
    function runTestCase7() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「問題と例題の種類および独立した番号を表示する」で外部依存から返す1を固定し、検証を決定的にする。
         *
         * @returns 1
         */
        function fnCallback8() {
            return 1;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const worksheet = createWorksheet();
        worksheet.problems = [createProblem(), createProblem(), createProblem(), createProblem()];
        worksheet.problems[1]!.kind = "example";
        worksheet.problems[3]!.kind = "example";
        const { container } = render(<WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()}/>);
        const headings = Array.from(container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-problem-number"), (/**
         * 配列位置ごとに処理対象の要素のテキスト・内容を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @param element 走査または監視の対象となる要素
         * @returns 処理対象の要素のテキスト・内容
         */
        function fromCallback9(element) {
            return element.textContent;
        }));
        expect(headings).toEqual(["問1.", "例1.", "問2.", "例2."]);
    }));
    it("プリント設定で選んだ小問番号形式を表示する", (/**
     * 「プリント設定で選んだ小問番号形式を表示する」という仕様を操作結果から検証する。
     */
    function runTestCase10() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「プリント設定で選んだ小問番号形式を表示する」で外部依存から返す1を固定し、検証を決定的にする。
         *
         * @returns 1
         */
        function fnCallback11() {
            return 1;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const worksheet = createWorksheet();
        worksheet.pageSettings.subQuestionNumberFormat = "circled";
        worksheet.problems[0]!.contents = [createSubQuestionGroup()];
        const { container } = render(<WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()}/>);
        const numbers = Array.from(container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-subquestion b"), (/**
         * 配列位置ごとに処理対象の要素のテキスト・内容を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @param element 走査または監視の対象となる要素
         * @returns 処理対象の要素のテキスト・内容
         */
        function fromCallback12(element) {
            return element.textContent;
        }));
        expect(numbers).toEqual(["①", "②"]);
    }));
    it("問題のみは黒だけ、解答付きは黒と赤およびめあてを表示する", (/**
     * 「問題のみは黒だけ、解答付きは黒と赤およびめあてを表示する」という仕様を操作結果から検証する。
     */
    function runTestCase13() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「問題のみは黒だけ、解答付きは黒と赤およびめあてを表示する」で外部依存から返す1を固定し、検証を決定的にする。
         *
         * @returns 1
         */
        function fnCallback14() {
            return 1;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const worksheet = createWorksheet();
        const richText = worksheet.problems[0]!.contents[0]!;
        if (richText.type !== "richText")
            throw new Error("richTextを生成できませんでした");
        const answerTable = createTableBlock(1, 1);
        richText.document = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    attrs: { textAlign: "left" },
                    content: [
                        { type: "text", text: "黒の本文" },
                        { type: "text", text: "赤の解答", marks: [{ type: "answerColor" }] },
                    ],
                },
                { type: "blockMath", attrs: { latex: "x=1", textSize: "normal", answerColor: true } },
                { type: "richTable", attrs: { id: answerTable.id, rows: answerTable.rows, columnWidthsPercent: answerTable.columnWidthsPercent, headerRow: answerTable.headerRow, answerColor: true } },
            ],
        };
        richText.answerDocument = emptyDocument();
        const answerArea = createAnswerAreaBlock();
        answerArea.answerArea.document = {
            type: "doc",
            content: [{
                    type: "paragraph",
                    attrs: { textAlign: "left" },
                    content: [
                        { type: "text", text: "黒の解答欄指示" },
                        { type: "text", text: "赤の解答欄内容", marks: [{ type: "answerColor" }] },
                    ],
                }],
        };
        answerArea.answerArea.answerDocument = emptyDocument();
        const goal = createGoalBlock();
        goal.document = plainTextToDocument("赤のめあて");
        worksheet.problems[0]!.contents.push(answerArea, goal);
        const questions = render(<WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()}/>);
        const questionPage = questions.container.querySelector<HTMLElement>(".preview-page-wrap");
        expect(questionPage).toHaveTextContent("黒の本文");
        expect(questionPage).toHaveTextContent("黒の解答欄指示");
        expect(questionPage).not.toHaveTextContent("赤の解答");
        expect(questionPage).not.toHaveTextContent("赤の解答欄内容");
        expect(questionPage).not.toHaveTextContent("赤のめあて");
        expect(questionPage?.querySelector(".math-formula")).not.toBeInTheDocument();
        expect(questionPage?.querySelector(".paper-table")).not.toBeInTheDocument();
        questions.unmount();
        const withAnswers = render(<WorksheetPreview worksheet={worksheet} mode="withAnswers" zoom={1} assetUrls={new Map()}/>);
        const answerPage = withAnswers.container.querySelector<HTMLElement>(".preview-page-wrap");
        expect(answerPage).toHaveTextContent("黒の本文");
        expect(answerPage).toHaveTextContent("赤の解答");
        expect(answerPage).toHaveTextContent("黒の解答欄指示");
        expect(answerPage).toHaveTextContent("赤の解答欄内容");
        expect(answerPage).toHaveTextContent("赤のめあて");
        expect(answerPage?.querySelector(".answer-color")).toHaveTextContent("赤の解答");
        expect(answerPage?.querySelector(".math-formula")).toBeInTheDocument();
        expect(answerPage?.querySelector(".paper-table")).toBeInTheDocument();
    }));
    it("問題のみでも下線付き解答色テキストの幅と下線を残す", (/**
     * 「問題のみでも下線付き解答色テキストの幅と下線を残す」という仕様を操作結果から検証する。
     */
    function runTestCase15() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「問題のみでも下線付き解答色テキストの幅と下線を残す」で外部依存から返す1を固定し、検証を決定的にする。
         *
         * @returns 1
         */
        function fnCallback16() {
            return 1;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const worksheet = createWorksheet();
        const richText = worksheet.problems[0]!.contents[0]!;
        if (richText.type !== "richText")
            throw new Error("richTextを生成できませんでした");
        richText.document = {
            type: "doc",
            content: [{
                    type: "paragraph",
                    attrs: { textAlign: "left" },
                    content: [
                        { type: "text", text: "問題文" },
                        { type: "text", text: "下線上の解答", marks: [{ type: "underline" }, { type: "answerColor" }] },
                    ],
                }],
        };
        richText.answerDocument = emptyDocument();
        const questions = render(<WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()}/>);
        const placeholder = questions.container.querySelector<HTMLElement>(".preview-page-wrap .paper-answer-placeholder");
        expect(placeholder).toHaveAttribute("aria-hidden", "true");
        expect(placeholder).toHaveTextContent("下線上の解答");
        expect(placeholder?.querySelector("u")).toHaveTextContent("下線上の解答");
        expect(placeholder?.querySelector(".answer-color")).not.toBeInTheDocument();
        questions.unmount();
        const withAnswers = render(<WorksheetPreview worksheet={worksheet} mode="withAnswers" zoom={1} assetUrls={new Map()}/>);
        expect(withAnswers.container.querySelector(".paper-answer-placeholder")).not.toBeInTheDocument();
        expect(withAnswers.container.querySelector(".preview-page-wrap .answer-color")).toHaveTextContent("下線上の解答");
    }));
    it("同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する", (/**
     * 「同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase17() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する」で外部依存から返すset・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param callback 条件成立後に実行する処理
         */
        function fnCallback18(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 連続操作が落ち着いてから、保留中の保存または表示更新を実行する。
             *
             */
            function handleScheduledTask19() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * 「同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する」で外部依存から返すclear・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param id 対象を識別するID
         */
        function fnCallback20(id: number) {
            return window.clearTimeout(id);
        })));
        const worksheet = createWorksheet();
        const view = render(<WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()}/>);
        await waitFor((/**
         * 「同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback21() {
            return expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true");
        }));
        view.rerender(<WorksheetPreview worksheet={worksheet} mode="questionsAndAnswers" zoom={1} assetUrls={new Map()}/>);
        await waitFor((/**
         * 「同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback22() {
            return expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true");
        }));
        expect(view.container.querySelectorAll(".preview-page-wrap")).toHaveLength(2);
    }));
    it("計測DOMを外す前にResizeObserverを停止する", (/**
     * 「計測DOMを外す前にResizeObserverを停止する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase23() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「計測DOMを外す前にResizeObserverを停止する」で外部依存から返すset・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param callback 条件成立後に実行する処理
         */
        function fnCallback24(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 連続操作が落ち着いてから、保留中の保存または表示更新を実行する。
             *
             */
            function handleScheduledTask25() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * 「計測DOMを外す前にResizeObserverを停止する」で外部依存から返すclear・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param id 対象を識別するID
         */
        function fnCallback26(id: number) {
            return window.clearTimeout(id);
        })));
        const disconnect = vi.fn();
        vi.stubGlobal("ResizeObserver", class {
            /**
             * 現在の状態を基にobserveを導出する。
             */
            observe() { }
            /**
             * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
             */
            disconnect() { disconnect(); }
        });
        const view = render(<WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()}/>);
        await waitFor((/**
         * 「計測DOMを外す前にResizeObserverを停止する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback27() {
            return expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true");
        }));
        expect(disconnect).toHaveBeenCalled();
        expect(view.container.querySelector(".preview-measurement")).not.toBeInTheDocument();
    }));
    it("1ページより高いcontentを検出してプレビューに警告する", (/**
     * 「1ページより高いcontentを検出してプレビューに警告する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase28() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「1ページより高いcontentを検出してプレビューに警告する」で外部依存から返すset・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param callback 条件成立後に実行する処理
         */
        function fnCallback29(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 連続操作が落ち着いてから、保留中の保存または表示更新を実行する。
             *
             */
            function handleScheduledTask30() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * 「1ページより高いcontentを検出してプレビューに警告する」で外部依存から返すclear・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param id 対象を識別するID
         */
        function fnCallback31(id: number) {
            return window.clearTimeout(id);
        })));
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation((/**
         * 「1ページより高いcontentを検出してプレビューに警告する」で外部依存から返すrectangleの結果を固定し、検証を決定的にする。
         *
         * @param this 関数を呼び出したオブジェクト
         * @returns rectangleの結果
         */
        function mockImplementationCallback32(this: HTMLElement) {
            if (this.classList.contains("paper-page"))
                return rectangle(1000);
            if (this.classList.contains("paper-header"))
                return rectangle(100);
            if (this.dataset.paginationAtom)
                return rectangle(1200);
            return rectangle(0);
        }));
        const onPaginationErrorChange = vi.fn();
        const view = render(<WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()} onPaginationErrorChange={onPaginationErrorChange}/>);
        const previewPages = view.container.querySelector(".preview-pages");
        await waitFor((/**
         * 「1ページより高いcontentを検出してプレビューに警告する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback33() {
            return expect(previewPages).toHaveAttribute("data-pagination-ready", "true");
        }));
        expect(previewPages).toHaveAttribute("data-pagination-error", OVERSIZED_PAGINATION_ERROR);
        expect(view.getByRole("alert")).toHaveTextContent(OVERSIZED_PAGINATION_MESSAGE);
        expect(onPaginationErrorChange).toHaveBeenLastCalledWith(OVERSIZED_PAGINATION_MESSAGE);
    }));
}));
/**
 * DOM寸法に依存する処理を検証するため、指定値を持つ矩形情報を作る。
 *
 * @param height 要素またはページの高さ
 * @returns 水平方向の座標・垂直方向の座標・要素または列へ適用する幅・要素またはページの高さ・要素上端の座標を持つオブジェクト
 */
function rectangle(height: number): DOMRect {
    return {
        x: 0,
        y: 0,
        width: 0,
        height,
        top: 0,
        right: 0,
        bottom: height,
        left: 0,
        toJSON: (/**
         * を持つオブジェクトを一つの結果へまとめる。
         *
         * @returns を持つオブジェクト
         */
        function toJSONCallback34() {
            return ({});
        }),
    };
}
