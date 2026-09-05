export type MeasuredPaginationItem = {
    key: string;
    height: number;
    startsProblem: boolean;
    breakBefore: boolean;
    breakAfter: boolean;
};
export type MeasuredPaginationPlan = {
    pages: string[][];
    oversizedItemKeys: string[];
};
/**
 * 計測済みのプレビュー断片を固定高のページへ配置する。
 *
 * @param items 配置する計測済み断片
 * @param firstPageCapacity ヘッダーを除いた先頭ページの利用可能高
 * @param followingPageCapacity 2ページ目以降の利用可能高
 * @param problemGap 問題の境界に設ける間隔
 * @returns ページごとの断片キー一覧
 */
export function paginateMeasuredItems(items: readonly MeasuredPaginationItem[], firstPageCapacity: number, followingPageCapacity: number, problemGap: number): string[][] {
    return planMeasuredPagination(items, firstPageCapacity, followingPageCapacity, problemGap).pages;
}
/**
 * 改ページを計画し、どのページにも収まらない断片を報告する。
 *
 * @param items 配置する計測済み断片
 * @param firstPageCapacity ヘッダーを除いた先頭ページの利用可能高
 * @param followingPageCapacity 2ページ目以降の利用可能高
 * @param problemGap 問題の境界に設ける間隔
 * @returns ページ構成と収容不能な断片キー
 */
export function planMeasuredPagination(items: readonly MeasuredPaginationItem[], firstPageCapacity: number, followingPageCapacity: number, problemGap: number): MeasuredPaginationPlan {
    const pages: string[][] = [];
    const oversizedItemKeys: string[] = [];
    let current: string[] = [];
    let used = 0;
    const capacity = (/**
     * capacityに必要な処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function capacityImplementation1() {
        return pages.length === 0 ? firstPageCapacity : followingPageCapacity;
    });
    const finishPage = (/**
     * finishPageに必要な処理を実行する。
     *
     * @param allowEmpty allowEmptyとして使用する値
     */
    function finishPageImplementation2(allowEmpty = false) {
        if (current.length > 0 || allowEmpty)
            pages.push(current);
        current = [];
        used = 0;
    });
    for (const item of items) {
        if (item.breakBefore && current.length > 0)
            finishPage();
        let gap = current.length > 0 && item.startsProblem ? problemGap : 0;
        if (current.length > 0 && used + gap + item.height > capacity() + 0.5) {
            finishPage();
            gap = 0;
        }
        // 先頭ページにはヘッダーがある。断片がヘッダーのない次ページなら収まる場合は、
        // 先頭ページ下端で切らずに送るため、先頭ページをヘッダーだけの状態で確定する。
        if (current.length === 0
            && pages.length === 0
            && item.height > firstPageCapacity + 0.5
            && followingPageCapacity > firstPageCapacity) {
            finishPage(true);
        }
        if (item.height > capacity() + 0.5)
            oversizedItemKeys.push(item.key);
        current.push(item.key);
        used += gap + item.height;
        if (item.breakAfter)
            finishPage();
    }
    finishPage();
    return {
        pages: pages.length > 0 ? pages : [[]],
        oversizedItemKeys,
    };
}
