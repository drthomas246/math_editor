import { describe, expect, it } from "vitest";
import { getAdjacentManualChapters, getManualChapter, MANUAL_CHAPTERS } from "./manual-chapters";
describe("manual chapters", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("13章を定義順かつ空でない本文で提供する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
        expect(MANUAL_CHAPTERS).toHaveLength(13);
        expect(new Set(MANUAL_CHAPTERS.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param chapter chapterとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem3(chapter) {
            return chapter.slug;
        })))).toHaveProperty("size", 13);
        expect(MANUAL_CHAPTERS.every((/**
         * すべての要素に求める条件を満たすか判定する。
         *
         * @param chapter chapterとして使用する値
         * @param index 対象となる位置
         * @returns 呼び出し元で使用する処理結果
         */
        function isMatchingItem4(chapter, index) {
            return chapter.order === index + 1 && chapter.markdown.trim().length > 0;
        }))).toBe(true);
    }));
    it("章を解決して前後章を返す", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase5() {
        expect(getManualChapter("formulas")?.title).toBe("数式");
        expect(getManualChapter("unknown")).toBeUndefined();
        expect(getAdjacentManualChapters("overview")).toEqual({ next: MANUAL_CHAPTERS[1] });
        expect(getAdjacentManualChapters("formulas")).toMatchObject({ previous: { slug: "editor-basics" }, next: { slug: "images-and-tables" } });
        expect(getAdjacentManualChapters("ai-skills")).toEqual({ previous: MANUAL_CHAPTERS[9], next: MANUAL_CHAPTERS[11] });
        expect(getAdjacentManualChapters("troubleshooting")).toEqual({ previous: MANUAL_CHAPTERS[10], next: MANUAL_CHAPTERS[12] });
        expect(getAdjacentManualChapters("version-and-license")).toEqual({ previous: MANUAL_CHAPTERS[11] });
    }));
}));
