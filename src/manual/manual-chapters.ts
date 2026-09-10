import { MANUAL_CONTENT } from "./manual-content";
import { MANUAL_CHAPTER_MANIFEST, type ManualChapterSlug } from "./manual-manifest";
import type { ManualChapterMetadata } from "./manual-types";
export type ManualChapter = ManualChapterMetadata & {
    slug: ManualChapterSlug;
    order: number;
    markdown: string;
};
export const MANUAL_CHAPTERS: readonly ManualChapter[] = MANUAL_CHAPTER_MANIFEST.map((/**
 * 各復元または検証に使う付随情報を値・order・検索または表示の対象となるMarkdown本文を持つオブジェクトへ変換する。
 *
 * @param metadata 復元または検証に使う付随情報
 * @param index 対象となる位置
 * @returns 値・order・検索または表示の対象となるMarkdown本文を持つオブジェクト
 */
function mapItem1(metadata, index) {
    return ({ ...metadata, order: index + 1, markdown: MANUAL_CONTENT[metadata.slug] });
}));
export const MANUAL_CHAPTER_BY_SLUG = new Map(MANUAL_CHAPTERS.map((/**
 * 各検索または表示の対象となるマニュアル章を順序を保った要素一覧へ変換する。
 *
 * @param chapter 検索または表示の対象となるマニュアル章
 * @returns 順序を保った要素一覧
 */
function mapItem2(chapter) {
    return [chapter.slug, chapter];
})));
/**
 * マニュアル・章を入力データまたは現在の状態から取り出す。
 *
 * @param slug マニュアル章をURL上で特定する識別子
 * @returns ストアの最新状態を取得する関数の結果
 */
export function getManualChapter(slug: string): ManualChapter | undefined {
    return MANUAL_CHAPTER_BY_SLUG.get(slug as ManualChapterSlug);
}
/**
 * マニュアル・章・Slugが仕様上の条件を満たすか判定する。
 *
 * @param value is・マニュアル・章・Slugで判定または変換する入力値
 * @returns マニュアル・章・BY・SLUGに変換・検証・保存の対象となる値が登録されている場合はtrue
 */
export function isManualChapterSlug(value: string): value is ManualChapterSlug {
    return MANUAL_CHAPTER_BY_SLUG.has(value as ManualChapterSlug);
}
/**
 * 値・値を持つオブジェクトを一つの結果へまとめる。
 *
 * @param slug マニュアル章をURL上で特定する識別子
 * @returns 値・値を持つオブジェクト
 */
export function getAdjacentManualChapters(slug: ManualChapterSlug): {
    previous?: ManualChapter;
    next?: ManualChapter;
} {
    const index = MANUAL_CHAPTERS.findIndex((/**
     * 各検索または表示の対象となるマニュアル章が探している位置の要素か判定する。
     *
     * @param chapter 検索または表示の対象となるマニュアル章
     * @returns 検索または表示の対象となるマニュアル章のマニュアル章をURL上で特定する識別子がマニュアル章をURL上で特定する識別子と一致する場合はtrue
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
