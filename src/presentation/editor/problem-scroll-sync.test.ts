import { describe, expect, it } from "vitest";
import { interpolateScrollPosition, syncProblemScroll } from "./problem-scroll-sync";
describe("problem scroll sync", (/**
 * 「problem scroll sync」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    it("問題アンカーの間を補間する", (/**
     * 「問題アンカーの間を補間する」という仕様を操作結果から検証する。
     */
    function runTestCase2() {
        expect(interpolateScrollPosition(250, [
            { source: 0, target: 0 },
            { source: 100, target: 200 },
            { source: 400, target: 800 },
        ])).toBe(500);
    }));
    it("編集側の問題位置を同じプレビュー問題位置へ合わせる", (/**
     * 「編集側の問題位置を同じプレビュー問題位置へ合わせる」という仕様を操作結果から検証する。
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
     * 「解答付きでは解答用プレビューのアンカーを使う」という仕様を操作結果から検証する。
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
 * Scroll・Containerを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param scrollHeight スクロール領域全体の高さ
 * @param clientHeight 表示領域として利用できる高さ
 * @returns 処理対象の要素
 */
function createScrollContainer(scrollHeight: number, clientHeight: number): HTMLElement {
    const element = document.createElement("div");
    Object.defineProperties(element, {
        scrollHeight: { configurable: true, value: scrollHeight },
        clientHeight: { configurable: true, value: clientHeight },
    });
    element.getBoundingClientRect = (/**
     * 非同期処理の完了後に、登録時の後始末または状態更新を実行する。
     *
     * @returns 要素上端の座標・bottom・並び順を比較する左側の値・並び順を比較する右側の値・要素または列へ適用する幅を持つオブジェクト
     */
    function applyDeferredOperation5() {
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
             * to・JSONを比較・保存・表示先が要求する形式へ変換する。
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
 * 処理対象の要素のdatasetのエディタ・問題・識別子を問題・識別子へ更新する。
 *
 * @param container イベント境界または表示領域となる要素
 * @param problemId 対象を識別するID
 * @param side 計測する要素の上下端
 * @param offset 対象となる位置
 * @param section 改ページまたは表示の対象となる問題区画
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
     * 非同期処理の完了後に、登録時の後始末または状態更新を実行する。
     *
     * @returns 要素上端の座標・bottom・並び順を比較する左側の値・並び順を比較する右側の値・要素または列へ適用する幅を持つオブジェクト
     */
    function applyDeferredOperation7() {
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
             * to・JSONを比較・保存・表示先が要求する形式へ変換する。
             */
            function toJSONCallback8() {
                return undefined;
            }),
        });
    });
    container.append(element);
}
