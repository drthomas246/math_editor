import type { EditorPreviewMode } from "../../application/pdf/generate-pdf";
type ScrollAnchor = {
    source: number;
    target: number;
};
/**
 * 単純なスクロール率ではなく、対応する問題の開始位置を基準にプレビューを同期する。
 * 問題間は補間し、移動を滑らかに保つ。
 *
 * @param editorScroll 編集領域のスクロール要素
 * @param previewScroll プレビュー領域のスクロール要素
 * @param previewMode 同期対象となるプレビュー表示モード
 * @returns 同期後のスクロール位置。対応する問題がない場合はnull
 */
export function syncProblemScroll(editorScroll: HTMLElement, previewScroll: HTMLElement, previewMode: EditorPreviewMode): number | null {
    const previewProblems = new Map(Array.from(previewScroll.querySelectorAll<HTMLElement>("[data-preview-problem-id]"))
        .filter((/**
     * 処理対象の要素のdatasetのプレビュー・区画がプレビュー・モードと一致する要素だけを後続処理へ残す。
     *
     * @param element 走査または監視の対象となる要素
     * @returns 処理対象の要素のdatasetのプレビュー・区画がプレビュー・モードと一致する場合はtrue
     */
    function filterItem1(element) {
        return element.dataset.previewSection === previewMode;
    }))
        .map((/**
     * 各処理対象の要素を順序を保った要素一覧へ変換する。
     *
     * @param element 走査または監視の対象となる要素
     * @returns 順序を保った要素一覧
     */
    function mapItem2(element) {
        return [element.dataset.previewProblemId!, element];
    })));
    const editorProblems = Array.from(editorScroll.querySelectorAll<HTMLElement>("[data-editor-problem-id]"));
    const matchingProblems = editorProblems.flatMap((/**
     * 各スクロール位置を求める編集側の問題要素を0件以上の結果へ変換し、一つの配列へ展開する。
     *
     * @param editorProblem スクロール位置を求める編集側の問題要素
     * @returns 条件に応じて選択した値
     */
    function expandItem3(editorProblem) {
        const problemId = editorProblem.dataset.editorProblemId;
        const previewProblem = problemId ? previewProblems.get(problemId) : undefined;
        return previewProblem ? [{ editorProblem, previewProblem }] : [];
    }));
    if (matchingProblems.length === 0)
        return null;
    const sourceMax = Math.max(0, editorScroll.scrollHeight - editorScroll.clientHeight);
    const targetMax = Math.max(0, previewScroll.scrollHeight - previewScroll.clientHeight);
    if (sourceMax === 0 || targetMax === 0) {
        previewScroll.scrollTop = 0;
        return 0;
    }
    const anchors: ScrollAnchor[] = [{ source: 0, target: 0 }];
    for (const { editorProblem, previewProblem } of matchingProblems) {
        const source = getScrollOffset(editorProblem, editorScroll);
        if (source <= 0 || source >= sourceMax)
            continue;
        anchors.push({
            source,
            target: clamp(getScrollOffset(previewProblem, previewScroll), 0, targetMax),
        });
    }
    anchors.push({ source: sourceMax, target: targetMax });
    anchors.sort((/**
     * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
     *
     * @param left 並び順を比較する左側の値
     * @param right 並び順を比較する右側の値
     * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
     */
    function compareItems4(left, right) {
        return left.source - right.source;
    }));
    const target = interpolateScrollPosition(clamp(editorScroll.scrollTop, 0, sourceMax), anchors);
    previewScroll.scrollTop = target;
    return target;
}
/**
 * interpolate・Scroll・Positionを表操作を適用する位置で処理し、その結果を呼び出し元へ反映する。
 *
 * @param position 対象となる位置
 * @param anchors 問題位置とスクロール位置の対応表
 * @returns 0から算出した数値
 */
export function interpolateScrollPosition(position: number, anchors: readonly ScrollAnchor[]): number {
    if (anchors.length === 0)
        return 0;
    if (position <= anchors[0]!.source)
        return anchors[0]!.target;
    for (let index = 1; index < anchors.length; index += 1) {
        const right = anchors[index]!;
        if (position > right.source)
            continue;
        const left = anchors[index - 1]!;
        const distance = right.source - left.source;
        if (distance <= 0)
            return right.target;
        const progress = (position - left.source) / distance;
        return left.target + (right.target - left.target) * progress;
    }
    return anchors.at(-1)!.target;
}
/**
 * Scroll・Offsetを入力データまたは現在の状態から取り出す。
 *
 * @param element 走査または監視の対象となる要素
 * @param scrollContainer 同期先となるスクロール領域
 * Scroll・Offsetを入力データまたは現在の状態から取り出す。
  * @returns get・Bounding・Client・Rectの結果の要素上端の座標とget・Bounding・Client・Rectの結果の要素上端の座標の差と同期先となるスクロール領域のscroll・Topを加算した値から算出した数値
 */
function getScrollOffset(element: HTMLElement, scrollContainer: HTMLElement): number {
    return element.getBoundingClientRect().top
        - scrollContainer.getBoundingClientRect().top
        + scrollContainer.scrollTop;
}
/**
 * clampをminで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value clampで判定または変換する入力値
 * @param minimum 許容する最小値
 * @param maximum 許容する最大値
 * @returns minの結果から算出した数値
 */
function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}
