import { describe, expect, it } from "vitest";
import { WorksheetSchema } from "../../domain/worksheet/worksheet";
import { createComplexPdfBenchmarkFixture, createWorksheetListFixtures, summarizeWorksheetComplexity, } from "./performance-benchmark-fixtures";
describe("performance benchmark fixtures", (/**
 * 「performance benchmark fixtures」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    it("一覧用のminimal・typical・heavyを段階的に複雑化する", (/**
     * 「一覧用のminimal・typical・heavyを段階的に複雑化する」という仕様を操作結果から検証する。
     */
    function runTestCase2() {
        const minimal = createWorksheetListFixtures("minimal", 2)[0]!;
        const typical = createWorksheetListFixtures("typical", 2)[0]!;
        const heavy = createWorksheetListFixtures("heavy", 2)[0]!;
        const minimalComplexity = summarizeWorksheetComplexity(minimal);
        const typicalComplexity = summarizeWorksheetComplexity(typical);
        const heavyComplexity = summarizeWorksheetComplexity(heavy);
        expect(WorksheetSchema.safeParse(minimal).success).toBe(true);
        expect(WorksheetSchema.safeParse(typical).success).toBe(true);
        expect(WorksheetSchema.safeParse(heavy).success).toBe(true);
        expect(typicalComplexity.problems).toBeGreaterThan(minimalComplexity.problems);
        expect(typicalComplexity.contentBlocks).toBeGreaterThan(minimalComplexity.contentBlocks);
        expect(heavyComplexity.problems).toBeGreaterThan(typicalComplexity.problems);
        expect(heavyComplexity.contentBlocks).toBeGreaterThan(typicalComplexity.contentBlocks);
        expect(heavyComplexity.tableCells).toBeGreaterThan(typicalComplexity.tableCells);
        expect(heavyComplexity.subQuestions).toBeGreaterThan(0);
    }));
    it("complex PDF fixtureへ数式・表・画像と実Assetを含める", (/**
     * 「complex PDF fixtureへ数式・表・画像と実Assetを含める」という仕様を操作結果から検証する。
     */
    function runTestCase3() {
        const fixture = createComplexPdfBenchmarkFixture(3);
        const serialized = JSON.stringify(fixture.worksheet);
        expect(WorksheetSchema.safeParse(fixture.worksheet).success).toBe(true);
        expect(fixture.worksheet.problems).toHaveLength(3);
        expect(fixture.worksheet.problems.slice(1).every((/**
         * すべての処理対象の問題または例題に共通して要求する条件を検証する。
         *
         * @param problem 処理対象の問題または例題
         * @returns 処理対象の問題または例題のページ・Break・Beforeが真になる場合はtrue
         */
        function isMatchingItem4(problem) {
            return problem.pageBreakBefore;
        }))).toBe(true);
        expect(serialized).toContain("inlineMath");
        expect(serialized).toContain("blockMath");
        expect(serialized).toContain("imageRef");
        expect(fixture.worksheet.problems.every((/**
         * すべての処理対象の問題または例題に共通して要求する条件を検証する。
         *
         * @param problem 処理対象の問題または例題
         * @returns someの結果が真になる場合はtrue
         */
        function isMatchingItem5(problem) {
            return problem.contents.some((/**
             * いずれかの処理対象の問題本文または解説が要求条件を満たすか判定する。
             *
             * @param content 処理対象の問題本文または解説
             * @returns 処理対象の問題本文または解説の作成または検証する要素種別が「table」と一致する場合はtrue
             */
            function hasMatchingItem6(content) {
                return content.type === "table";
            }));
        }))).toBe(true);
        expect(fixture.assets).toHaveLength(1);
        expect(fixture.assets[0]).toMatchObject({ mimeType: "image/png", width: 1, height: 1 });
    }));
}));
