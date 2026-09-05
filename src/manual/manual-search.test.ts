import { describe, expect, it } from "vitest";
import { markdownToPlainTextBlocks, normalizeManualSearchText, searchManual } from "./manual-search";
describe("manual search", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("全角ASCII、空白、英字、大文字小文字を正規化する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
        expect(normalizeManualSearchText("  ＰＤＦ　ＡＢＣ  ")).toBe("pdf abc");
        expect(normalizeManualSearchText("ガイド")).toBe("ガイド");
    }));
    it("Markdownの表示文字を残してURLと記号を除く", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        const blocks = markdownToPlainTextBlocks("## 表\n\n![図](manual-assets/a.png) [説明](/help/overview)\n\n| 項目 | 値 |\n| --- | --- |\n| 用紙 | A4 |");
        expect(blocks.join(" ")).toContain("図 説明");
        expect(blocks.join(" ")).toContain("用紙 A4");
        expect(blocks.join(" ")).not.toContain("manual-assets");
        expect(blocks.join(" ")).not.toContain("/help/overview");
    }));
    it("題名、キーワード、本文をAND部分一致で検索する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase4() {
        expect(searchManual("数式")[0]?.slug).toBe("formulas");
        expect(searchManual("JSON 完全削除").map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param result 処理によって得られた結果
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem5(result) {
            return result.slug;
        }))).toContain("backup-and-trash");
        expect(searchManual("AI 教科書")[0]?.slug).toBe("ai-skills");
        expect(searchManual("Claude")[0]?.slug).toBe("ai-skills");
        expect(searchManual("MathLive ゴミ箱")).toEqual([]);
        expect(searchManual("   ")).toEqual([]);
    }));
    it("同じ検索語を重複加点せず、抜粋を120文字以内にする", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase6() {
        expect(searchManual("MathLive MathLive")).toEqual(searchManual("MathLive"));
        expect(searchManual("バックアップ").every((/**
         * すべての要素に求める条件を満たすか判定する。
         *
         * @param result 処理によって得られた結果
         * @returns 呼び出し元で使用する処理結果
         */
        function isMatchingItem7(result) {
            return result.excerpt.length <= 120;
        }))).toBe(true);
    }));
}));
