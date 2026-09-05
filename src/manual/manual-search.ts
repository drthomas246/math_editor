import { MANUAL_CHAPTERS, type ManualChapter } from "./manual-chapters";
import type { ManualChapterSlug } from "./manual-manifest";
export type ManualSearchResult = {
    slug: ManualChapterSlug;
    title: string;
    summary: string;
    excerpt: string;
    score: number;
    order: number;
};
type SearchableManualChapter = {
    chapter: ManualChapter;
    normalizedTitle: string;
    normalizedSummary: string;
    normalizedKeywords: readonly string[];
    plainTextBlocks: readonly string[];
    normalizedBlocks: readonly string[];
    normalizedBody: string;
};
/**
 * normalizeManualSearchTextの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function normalizeManualSearchText(value: string): string {
    return value
        .normalize("NFC")
        .replace(/\u3000/gu, " ")
        .replace(/[\uFF01-\uFF5E]/gu, (/**
     * replaceへ渡す処理を実行する。
     *
     * @param character characterとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function replaceCallback1(character) {
        return String.fromCharCode(character.charCodeAt(0) - 0xfee0);
    }))
        .toLocaleLowerCase("ja-JP")
        .replace(/\s+/gu, " ")
        .trim();
}
/**
 * markdownToPlainTextBlocksの対象となる状態を更新する。
 *
 * @param markdown markdownとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function markdownToPlainTextBlocks(markdown: string): readonly string[] {
    const text = markdown
        .replace(/\r\n?/gu, "\n")
        .replace(/^```[^\n]*$/gmu, "")
        .replace(/^~~~[^\n]*$/gmu, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
        .replace(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/gmu, "")
        .replace(/<\/?[A-Za-z][^>]*>/gu, "")
        .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gmu, "")
        .replace(/[*_~`]+/gu, "")
        .replace(/\|/gu, " ");
    return text
        .split(/\n\s*\n/gu)
        .map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param block blockとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem2(block) {
        return block.replace(/\s+/gu, " ").trim();
    }))
        .filter(Boolean);
}
const searchableChapters: readonly SearchableManualChapter[] = MANUAL_CHAPTERS.map((/**
 * 各要素を画面表示または別形式へ変換する。
 *
 * @param chapter chapterとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function mapItem3(chapter) {
    const plainTextBlocks = markdownToPlainTextBlocks(chapter.markdown);
    const normalizedBlocks = plainTextBlocks.map(normalizeManualSearchText);
    return {
        chapter,
        normalizedTitle: normalizeManualSearchText(chapter.title),
        normalizedSummary: normalizeManualSearchText(chapter.summary),
        normalizedKeywords: chapter.keywords.map(normalizeManualSearchText),
        plainTextBlocks,
        normalizedBlocks,
        normalizedBody: normalizedBlocks.join(" "),
    };
}));
/**
 * truncateExcerptに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @param limit limitとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function truncateExcerpt(value: string, limit = 120): string {
    if (value.length <= limit)
        return value;
    return `${value.slice(0, limit - 1).trimEnd()}…`;
}
/**
 * createManualExcerptで必要な値を作成する。
 *
 * @param item 処理対象の値
 * @param tokens tokensとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createManualExcerpt(item: SearchableManualChapter, tokens: readonly string[]): string {
    let bestIndex = -1;
    let bestMatches = 0;
    item.normalizedBlocks.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param block blockとして使用する値
     * @param index 対象となる位置
     */
    function processItem4(block, index) {
        const matches = tokens.filter((/**
         * 対象要素を結果へ残すか判定する。
         *
         * @param token tokenとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function filterItem5(token) {
            return block.includes(token);
        })).length;
        if (matches > bestMatches) {
            bestMatches = matches;
            bestIndex = index;
        }
    }));
    return truncateExcerpt(bestIndex >= 0 ? (item.plainTextBlocks[bestIndex] ?? item.chapter.summary) : item.chapter.summary);
}
/**
 * searchManualに必要な処理を実行する。
 *
 * @param query queryとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function searchManual(query: string): readonly ManualSearchResult[] {
    const normalizedQuery = normalizeManualSearchText(query);
    const tokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
    if (tokens.length === 0)
        return [];
    return searchableChapters
        .flatMap((/**
     * 各要素を変換しながら一つの配列へ展開する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function expandItem6(item): ManualSearchResult[] {
        const containsToken = (/**
         * containsTokenで表される条件を判定する。
         *
         * @param token tokenとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function containsTokenImplementation7(token: string) {
            return item.normalizedTitle.includes(token)
                || item.normalizedSummary.includes(token)
                || item.normalizedKeywords.some((/**
                 * 条件に一致する要素か判定する。
                 *
                 * @param keyword keywordとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function hasMatchingItem8(keyword) {
                    return keyword.includes(token);
                }))
                || item.normalizedBody.includes(token);
        });
        if (!tokens.every(containsToken))
            return [];
        let score = item.normalizedTitle === normalizedQuery
            ? 500
            : item.normalizedTitle.includes(normalizedQuery) ? 300 : 0;
        tokens.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param token tokenとして使用する値
         */
        function processItem9(token) {
            if (item.normalizedTitle.includes(token))
                score += 100;
            if (item.normalizedKeywords.some((/**
             * 条件に一致する要素か判定する。
             *
             * @param keyword keywordとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function hasMatchingItem10(keyword) {
                return keyword.includes(token);
            })))
                score += 60;
            if (item.normalizedSummary.includes(token))
                score += 30;
            if (item.normalizedBody.includes(token))
                score += 10;
        }));
        return [{
                slug: item.chapter.slug,
                title: item.chapter.title,
                summary: item.chapter.summary,
                excerpt: createManualExcerpt(item, tokens),
                score,
                order: item.chapter.order,
            }];
    }))
        .sort((/**
     * 表示順を決めるため二つの要素を比較する。
     *
     * @param a aとして使用する値
     * @param b bとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function compareItems11(a, b) {
        return b.score - a.score || a.order - b.order;
    }));
}
