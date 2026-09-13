import { describe, expect, it } from "vitest";
import { markdownToPlainTextBlocks, normalizeManualSearchText, searchManual } from "./manual-search";
describe("manual search", (/**
 * 「manual search」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    it("全角ASCII、空白、英字、大文字小文字を正規化する", (/**
     * 「全角ASCII、空白、英字、大文字小文字を正規化する」という仕様を操作結果から検証する。
     */
    function runTestCase2() {
        expect(normalizeManualSearchText("  ＰＤＦ　ＡＢＣ  ")).toBe("pdf abc");
        expect(normalizeManualSearchText("ガイド")).toBe("ガイド");
    }));
    it("Markdownの表示文字を残してURLと記号を除く", (/**
     * 「Markdownの表示文字を残してURLと記号を除く」という仕様を操作結果から検証する。
     */
    function runTestCase3() {
        const blocks = markdownToPlainTextBlocks("## 表\n\n![図](manual-assets/a.png) [説明](/help/overview)\n\n| 項目 | 値 |\n| --- | --- |\n| 用紙 | A4 |");
        expect(blocks.join(" ")).toContain("図 説明");
        expect(blocks.join(" ")).toContain("用紙 A4");
        expect(blocks.join(" ")).not.toContain("manual-assets");
        expect(blocks.join(" ")).not.toContain("/help/overview");
    }));
    it("題名、キーワード、本文をAND部分一致で検索する", (/**
     * 「題名、キーワード、本文をAND部分一致で検索する」という仕様を操作結果から検証する。
     */
    function runTestCase4() {
        expect(searchManual("数式")[0]?.slug).toBe("formulas");
        expect(searchManual("JSON 完全削除").map((/**
         * 各結果を結果のマニュアル章をURL上で特定する識別子へ変換する。
         *
         * @param result 処理によって得られた結果
         * @returns 結果のマニュアル章をURL上で特定する識別子
         */
        function mapItem5(result) {
            return result.slug;
        }))).toContain("backup-and-trash");
        expect(searchManual("AI 教科書")[0]?.slug).toBe("ai-skills");
        expect(searchManual("WebMCP Runtime")[0]?.slug).toBe("ai-skills");
        expect(searchManual("MathLive ゴミ箱")).toEqual([]);
        expect(searchManual("   ")).toEqual([]);
    }));
    it("同じ検索語を重複加点せず、抜粋を120文字以内にする", (/**
     * 「同じ検索語を重複加点せず、抜粋を120文字以内にする」という仕様を操作結果から検証する。
     */
    function runTestCase6() {
        expect(searchManual("MathLive MathLive")).toEqual(searchManual("MathLive"));
        expect(searchManual("バックアップ").every((/**
         * すべての結果に共通して要求する条件を検証する。
         *
         * @param result 処理によって得られた結果
         * @returns 結果のexcerptのlengthが120以下である場合はtrue
         */
        function isMatchingItem7(result) {
            return result.excerpt.length <= 120;
        }))).toBe(true);
    }));
}));
