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
 * マニュアル・検索・テキストを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value normalize・マニュアル・検索・テキストで判定または変換する入力値
 * @returns trimの結果として得た文字列。変換できない場合は関数固有の既定値
 */
export function normalizeManualSearchText(value: string): string {
    return value
        .normalize("NFC")
        .replace(/\u3000/gu, " ")
        .replace(/[\uFF01-\uFF5E]/gu, (/**
     * 正規表現に一致した文字列を検索比較用の正規形へ置き換える。
     *
     * @param character 検査中の一文字
     * @returns 変換元・Char・コードの結果
     */
    function replaceCallback1(character) {
        return String.fromCharCode(character.charCodeAt(0) - 0xfee0);
    }))
        .toLocaleLowerCase("ja-JP")
        .replace(/\s+/gu, " ")
        .trim();
}
/**
 * markdown・To・Plain・テキスト・Blocksをreplaceで処理し、その結果を呼び出し元へ反映する。
 *
 * @param markdown 検索または表示の対象となるMarkdown本文
 * @returns 条件に合う要素だけを残した配列として得た文字列。変換できない場合は関数固有の既定値
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
     * 各処理対象のリッチテキストブロックをtrimの結果へ変換する。
     *
     * @param block 処理対象のリッチテキストブロック
     * @returns trimの結果
     */
    function mapItem2(block) {
        return block.replace(/\s+/gu, " ").trim();
    }))
        .filter(Boolean);
}
const searchableChapters: readonly SearchableManualChapter[] = MANUAL_CHAPTERS.map((/**
 * 各検索または表示の対象となるマニュアル章を検索または表示の対象となるマニュアル章・normalized・題名・normalized・Summary・normalized・Keywords・plain・テキスト・Blocksを持つオブジェクトへ変換する。
 *
 * @param chapter 検索または表示の対象となるマニュアル章
 * @returns 検索または表示の対象となるマニュアル章・normalized・題名・normalized・Summary・normalized・Keywords・plain・テキスト・Blocksを持つオブジェクト
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
 * truncate・Excerptをtrim・Endで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value truncate・Excerptで判定または変換する入力値
 * @param limit 返却する検索結果の上限件数
 * @returns 変換・検証・保存の対象となる値として得た文字列。変換できない場合は関数固有の既定値
 */
function truncateExcerpt(value: string, limit = 120): string {
    if (value.length <= limit)
        return value;
    return `${value.slice(0, limit - 1).trimEnd()}…`;
}
/**
 * マニュアル・Excerptを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param item 配列処理で現在参照している要素
 * @param tokens 検索クエリから抽出した照合語一覧
 * @returns truncate・Excerptの結果として得た文字列。変換できない場合は関数固有の既定値
 */
function createManualExcerpt(item: SearchableManualChapter, tokens: readonly string[]): string {
    let bestIndex = -1;
    let bestMatches = 0;
    item.normalizedBlocks.forEach((/**
     * 各処理対象のリッチテキストブロックについてfilterを実行し、対応関係または検証状態を更新する。
     *
     * @param block 処理対象のリッチテキストブロック
     * @param index 対象となる位置
     */
    function processItem4(block, index) {
        const matches = tokens.filter((/**
         * 処理対象のリッチテキストブロックに検索照合に使う正規化済みの語が含まれる要素だけを後続処理へ残す。
         *
         * @param token 検索照合に使う正規化済みの語
         * @returns 処理対象のリッチテキストブロックに検索照合に使う正規化済みの語が含まれる場合はtrue
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
 * 検索・マニュアルをnormalize・マニュアル・検索・テキストで処理し、その結果を呼び出し元へ反映する。
 *
 * @param query マニュアル検索へ入力された文字列
 * @returns 順序を保った要素一覧として得た要素一覧
 */
export function searchManual(query: string): readonly ManualSearchResult[] {
    const normalizedQuery = normalizeManualSearchText(query);
    const tokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
    if (tokens.length === 0)
        return [];
    return searchableChapters
        .flatMap((/**
     * 各要素を順序を保った要素一覧へ変換し、空の結果を除いて一つの配列へ展開する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 順序を保った要素一覧
     */
    function expandItem6(item): ManualSearchResult[] {
        const containsToken = (/**
         * 要素のnormalized・題名に検索照合に使う正規化済みの語が含まれるまたは要素のnormalized・Summaryに検索照合に使う正規化済みの語が含まれるまたはsomeの結果が真になるまたは要素のnormalized・Bodyに検索照合に使う正規化済みの語が含まれるかを判定する。
         *
         * @param token 検索照合に使う正規化済みの語
         * @returns 二つの値を比較した結果
         */
        function containsTokenImplementation7(token: string) {
            return item.normalizedTitle.includes(token)
                || item.normalizedSummary.includes(token)
                || item.normalizedKeywords.some((/**
                 * いずれかの検索対象として照合する語が要求条件を満たすか判定する。
                 *
                 * @param keyword 検索対象として照合する語
                 * @returns 検索対象として照合する語に検索照合に使う正規化済みの語が含まれる場合はtrue
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
         * 各検索照合に使う正規化済みの語についてincludesを実行し、対応関係または検証状態を更新する。
         *
         * @param token 検索照合に使う正規化済みの語
         */
        function processItem9(token) {
            if (item.normalizedTitle.includes(token))
                score += 100;
            if (item.normalizedKeywords.some((/**
             * いずれかの検索対象として照合する語が要求条件を満たすか判定する。
             *
             * @param keyword 検索対象として照合する語
             * @returns 検索対象として照合する語に検索照合に使う正規化済みの語が含まれる場合はtrue
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
     * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
     *
     * @param a 左側の要素
     * @param b 右側の要素
     * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
     */
    function compareItems11(a, b) {
        return b.score - a.score || a.order - b.order;
    }));
}
