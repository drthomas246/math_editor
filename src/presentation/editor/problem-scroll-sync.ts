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
     * 対象要素を結果へ残すか判定する。
     *
     * @param element 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem1(element) {
        return element.dataset.previewSection === previewMode;
    }))
        .map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param element 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem2(element) {
        return [element.dataset.previewProblemId!, element];
    })));
    const editorProblems = Array.from(editorScroll.querySelectorAll<HTMLElement>("[data-editor-problem-id]"));
    const matchingProblems = editorProblems.flatMap((/**
     * 各要素を変換しながら一つの配列へ展開する。
     *
     * @param editorProblem editorProblemとして使用する値
     * @returns 呼び出し元で使用する処理結果
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
     * 表示順を決めるため二つの要素を比較する。
     *
     * @param left leftとして使用する値
     * @param right rightとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function compareItems4(left, right) {
        return left.source - right.source;
    }));
    const target = interpolateScrollPosition(clamp(editorScroll.scrollTop, 0, sourceMax), anchors);
    previewScroll.scrollTop = target;
    return target;
}
/**
 * interpolateScrollPositionに必要な処理を実行する。
 *
 * @param position 対象となる位置
 * @param anchors anchorsとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * getScrollOffsetで必要な値を取得する。
 *
 * @param element 処理対象の値
 * @param scrollContainer scrollContainerとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function getScrollOffset(element: HTMLElement, scrollContainer: HTMLElement): number {
    return element.getBoundingClientRect().top
        - scrollContainer.getBoundingClientRect().top
        + scrollContainer.scrollTop;
}
/**
 * clampに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @param minimum minimumとして使用する値
 * @param maximum maximumとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}
