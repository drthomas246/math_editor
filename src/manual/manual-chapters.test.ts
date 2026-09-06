import { describe, expect, it } from "vitest";
import { getAdjacentManualChapters, getManualChapter, MANUAL_CHAPTERS } from "./manual-chapters";
describe("manual chapters", (/**
 * 「manual chapters」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    it("13章を定義順かつ空でない本文で提供する", (/**
     * 「13章を定義順かつ空でない本文で提供する」という仕様を操作結果から検証する。
     */
    function runTestCase2() {
        expect(MANUAL_CHAPTERS).toHaveLength(13);
        expect(new Set(MANUAL_CHAPTERS.map((/**
         * 各検索または表示の対象となるマニュアル章を検索または表示の対象となるマニュアル章のマニュアル章をURL上で特定する識別子へ変換する。
         *
         * @param chapter 検索または表示の対象となるマニュアル章
         * @returns 検索または表示の対象となるマニュアル章のマニュアル章をURL上で特定する識別子
         */
        function mapItem3(chapter) {
            return chapter.slug;
        })))).toHaveProperty("size", 13);
        expect(MANUAL_CHAPTERS.every((/**
         * すべての検索または表示の対象となるマニュアル章に共通して要求する条件を検証する。
         *
         * @param chapter 検索または表示の対象となるマニュアル章
         * @param index 対象となる位置
         * すべての検索または表示の対象となるマニュアル章について、検索または表示の対象となるマニュアル章のorderが位置と1を加算した値と一致するかつtrimの結果のlengthが0より大きいか検証する。
          * @returns 検索または表示の対象となるマニュアル章のorderが位置と1を加算した値と一致するかつtrimの結果のlengthが0より大きい場合はtrue
         */
        function isMatchingItem4(chapter, index) {
            return chapter.order === index + 1 && chapter.markdown.trim().length > 0;
        }))).toBe(true);
    }));
    it("章を解決して前後章を返す", (/**
     * 「章を解決して前後章を返す」という仕様を操作結果から検証する。
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
