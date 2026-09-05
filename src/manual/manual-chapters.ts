import { MANUAL_CONTENT } from "./manual-content";
import { MANUAL_CHAPTER_MANIFEST, type ManualChapterSlug } from "./manual-manifest";
import type { ManualChapterMetadata } from "./manual-types";
export type ManualChapter = ManualChapterMetadata & {
    slug: ManualChapterSlug;
    order: number;
    markdown: string;
};
export const MANUAL_CHAPTERS: readonly ManualChapter[] = MANUAL_CHAPTER_MANIFEST.map((/**
 * 各要素を画面表示または別形式へ変換する。
 *
 * @param metadata metadataとして使用する値
 * @param index 対象となる位置
 * @returns 呼び出し元で使用する処理結果
 */
function mapItem1(metadata, index) {
    return ({ ...metadata, order: index + 1, markdown: MANUAL_CONTENT[metadata.slug] });
}));
export const MANUAL_CHAPTER_BY_SLUG = new Map(MANUAL_CHAPTERS.map((/**
 * 各要素を画面表示または別形式へ変換する。
 *
 * @param chapter chapterとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function mapItem2(chapter) {
    return [chapter.slug, chapter];
})));
/**
 * getManualChapterで必要な値を取得する。
 *
 * @param slug slugとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function getManualChapter(slug: string): ManualChapter | undefined {
    return MANUAL_CHAPTER_BY_SLUG.get(slug as ManualChapterSlug);
}
/**
 * isManualChapterSlugで表される条件を判定する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function isManualChapterSlug(value: string): value is ManualChapterSlug {
    return MANUAL_CHAPTER_BY_SLUG.has(value as ManualChapterSlug);
}
/**
 * getAdjacentManualChaptersで必要な値を取得する。
 *
 * @param slug slugとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function getAdjacentManualChapters(slug: ManualChapterSlug): {
    previous?: ManualChapter;
    next?: ManualChapter;
} {
    const index = MANUAL_CHAPTERS.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param chapter chapterとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex3(chapter) {
        return chapter.slug === slug;
    }));
    const previous = MANUAL_CHAPTERS[index - 1];
    const next = MANUAL_CHAPTERS[index + 1];
    return {
        ...(previous ? { previous } : {}),
        ...(next ? { next } : {}),
    };
}
