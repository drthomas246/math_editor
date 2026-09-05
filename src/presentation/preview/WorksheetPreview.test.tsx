import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "../../application/pdf/pdf-pagination-guard";
import { plainTextToDocument } from "../../domain/worksheet/rich-text";
import { createAnswerAreaBlock, createGoalBlock, createProblem, createSubQuestionGroup, createTableBlock, createWorksheet, emptyDocument } from "../../domain/worksheet/worksheet.defaults";
import { WorksheetPreview } from "./WorksheetPreview";
describe("WorksheetPreview header", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    afterEach((/**
     * 各テストケースで使用した状態を後片付けする。
     */
    function cleanUpTestCase2() {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    }));
    it("places the year, class, and number lines before their labels", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback4() {
            return 1;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const { container } = render(<WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()}/>);
        const fields = Array.from(container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-fields span"));
        expect(fields.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param field fieldとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem5(field) {
            return field.textContent;
        }))).toEqual(["年", "組", "番", "名前"]);
        expect(fields.slice(0, 3).map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param field fieldとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem6(field) {
            return field.firstElementChild?.tagName;
        }))).toEqual(["I", "I", "I"]);
        expect(fields[3]?.lastElementChild?.tagName).toBe("I");
    }));
    it("問題と例題の種類および独立した番号を表示する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase7() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
         * fromへ渡す処理を実行する。
         *
         * @param element 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback9(element) {
            return element.textContent;
        }));
        expect(headings).toEqual(["問1.", "例1.", "問2.", "例2."]);
    }));
    it("プリント設定で選んだ小問番号形式を表示する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase10() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
         * fromへ渡す処理を実行する。
         *
         * @param element 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback12(element) {
            return element.textContent;
        }));
        expect(numbers).toEqual(["①", "②"]);
    }));
    it("問題のみは黒だけ、解答付きは黒と赤およびめあてを表示する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase13() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
     * 期待する振る舞いを検証する。
     */
    function runTestCase15() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase17() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param callback callbackとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback18(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 指定時間後に必要な処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleScheduledTask19() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param id 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback20(id: number) {
            return window.clearTimeout(id);
        })));
        const worksheet = createWorksheet();
        const view = render(<WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()}/>);
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback21() {
            return expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true");
        }));
        view.rerender(<WorksheetPreview worksheet={worksheet} mode="questionsAndAnswers" zoom={1} assetUrls={new Map()}/>);
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback22() {
            return expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true");
        }));
        expect(view.container.querySelectorAll(".preview-page-wrap")).toHaveLength(2);
    }));
    it("計測DOMを外す前にResizeObserverを停止する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase23() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param callback callbackとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback24(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 指定時間後に必要な処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleScheduledTask25() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param id 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback26(id: number) {
            return window.clearTimeout(id);
        })));
        const disconnect = vi.fn();
        vi.stubGlobal("ResizeObserver", class {
            /**
             * observeに必要な処理を実行する。
             */
            observe() { }
            /**
             * disconnectに必要な処理を実行する。
             */
            disconnect() { disconnect(); }
        });
        const view = render(<WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()}/>);
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback27() {
            return expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true");
        }));
        expect(disconnect).toHaveBeenCalled();
        expect(view.container.querySelector(".preview-measurement")).not.toBeInTheDocument();
    }));
    it("1ページより高いcontentを検出してプレビューに警告する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase28() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param callback callbackとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback29(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 指定時間後に必要な処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleScheduledTask30() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param id 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback31(id: number) {
            return window.clearTimeout(id);
        })));
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param this 関数を呼び出したオブジェクト
         * @returns 呼び出し元で使用する処理結果
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
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
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
 * rectangleに必要な処理を実行する。
 *
 * @param height heightとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
         * toJSONの入力値を必要な形式へ変換する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function toJSONCallback34() {
            return ({});
        }),
    };
}
