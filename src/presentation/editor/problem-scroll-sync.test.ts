import { describe, expect, it } from "vitest";
import { interpolateScrollPosition, syncProblemScroll } from "./problem-scroll-sync";
describe("problem scroll sync", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("問題アンカーの間を補間する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
        expect(interpolateScrollPosition(250, [
            { source: 0, target: 0 },
            { source: 100, target: 200 },
            { source: 400, target: 800 },
        ])).toBe(500);
    }));
    it("編集側の問題位置を同じプレビュー問題位置へ合わせる", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        const editor = createScrollContainer(1000, 200);
        const preview = createScrollContainer(1600, 300);
        addProblemAnchor(editor, "first", "editor", 100);
        addProblemAnchor(editor, "second", "editor", 400);
        addProblemAnchor(editor, "third", "editor", 700);
        addProblemAnchor(preview, "first", "preview", 200, "questions");
        addProblemAnchor(preview, "second", "preview", 800, "questions");
        addProblemAnchor(preview, "third", "preview", 1200, "questions");
        editor.scrollTop = 400;
        expect(syncProblemScroll(editor, preview, "questions")).toBe(800);
        expect(preview.scrollTop).toBe(800);
    }));
    it("解答付きでは解答用プレビューのアンカーを使う", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase4() {
        const editor = createScrollContainer(800, 200);
        const preview = createScrollContainer(2000, 300);
        addProblemAnchor(editor, "second", "editor", 300);
        addProblemAnchor(preview, "second", "preview", 500, "questions");
        addProblemAnchor(preview, "second", "preview", 1400, "withAnswers");
        editor.scrollTop = 300;
        expect(syncProblemScroll(editor, preview, "withAnswers")).toBe(1400);
    }));
}));
/**
 * createScrollContainerで必要な値を作成する。
 *
 * @param scrollHeight scrollHeightとして使用する値
 * @param clientHeight clientHeightとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createScrollContainer(scrollHeight: number, clientHeight: number): HTMLElement {
    const element = document.createElement("div");
    Object.defineProperties(element, {
        scrollHeight: { configurable: true, value: scrollHeight },
        clientHeight: { configurable: true, value: clientHeight },
    });
    element.getBoundingClientRect = (/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function commentRuleCallback5() {
        return ({
            top: 10,
            bottom: 10 + clientHeight,
            left: 0,
            right: 100,
            width: 100,
            height: clientHeight,
            x: 0,
            y: 10,
            toJSON: (/**
             * toJSONの入力値を必要な形式へ変換する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function toJSONCallback6() {
                return undefined;
            }),
        });
    });
    document.body.append(element);
    return element;
}
/**
 * addProblemAnchorの対象となる要素を追加する。
 *
 * @param container containerとして使用する値
 * @param problemId 対象を識別するID
 * @param side sideとして使用する値
 * @param offset 対象となる位置
 * @param section sectionとして使用する値
 */
function addProblemAnchor(container: HTMLElement, problemId: string, side: "editor" | "preview", offset: number, section?: "questions" | "withAnswers") {
    const element = document.createElement("div");
    if (side === "editor")
        element.dataset.editorProblemId = problemId;
    else {
        element.dataset.previewProblemId = problemId;
        if (section)
            element.dataset.previewSection = section;
    }
    element.getBoundingClientRect = (/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function commentRuleCallback7() {
        return ({
            top: 10 + offset - container.scrollTop,
            bottom: 20 + offset - container.scrollTop,
            left: 0,
            right: 100,
            width: 100,
            height: 10,
            x: 0,
            y: 10 + offset - container.scrollTop,
            toJSON: (/**
             * toJSONの入力値を必要な形式へ変換する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function toJSONCallback8() {
                return undefined;
            }),
        });
    });
    container.append(element);
}
