import { WorksheetSchema, type AssetRecord, type BasicRichTextDocument, type SolutionRichTextDocument, type TableBlock, type TableCellRichTextDocument, type Worksheet, } from "../../domain/worksheet/worksheet";
import { createAnswerAreaBlock, createBoxBlock, createId, createProblem, createRichTextBlock, createSubQuestion, createSubQuestionGroup, createTableBlock, createWorksheet, emptyDocument, } from "../../domain/worksheet/worksheet.defaults";
import { STRUCTURE_LIMITS } from "../../domain/worksheet/structure-limits";
export type WorksheetListFixtureProfile = "minimal" | "typical" | "heavy";
export const WORKSHEET_LIST_BENCHMARK_SCENARIOS: ReadonlyArray<{
    profile: WorksheetListFixtureProfile;
    worksheetCount: number;
    description: string;
}> = [
    { profile: "minimal", worksheetCount: 2000, description: "最小構成" },
    { profile: "typical", worksheetCount: 2000, description: "標準的な複合コンテンツ" },
    { profile: "heavy", worksheetCount: 250, description: "高密度な複合コンテンツ" },
];
export const COMPLEX_PDF_BENCHMARK_PAGE_COUNT = 12;
export type SerializableBenchmarkAsset = Omit<AssetRecord, "blob"> & {
    dataBase64: string;
};
export type PdfBenchmarkFixture = {
    worksheet: Worksheet;
    assets: SerializableBenchmarkAsset[];
};
const LIST_PROFILE_PROBLEM_COUNTS: Record<WorksheetListFixtureProfile, number> = {
    minimal: 1,
    typical: 4,
    heavy: 30,
};
// Playwrightのpage.evaluate境界を越えて直列化した後、ブラウザー側でBlobを再構築するための
// 正常な透過1×1 PNGデータ。
const TRANSPARENT_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
/**
 * createWorksheetListFixturesで必要な値を作成する。
 *
 * @param profile profileとして使用する値
 * @param count countとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function createWorksheetListFixtures(profile: WorksheetListFixtureProfile, count: number): Worksheet[] {
    if (!Number.isInteger(count) || count <= 0 || count > STRUCTURE_LIMITS.worksheetsPerArchive) {
        throw new Error(`一覧benchmarkのfixture件数が範囲外です: ${count}`);
    }
    const baseTime = Date.parse("2026-08-28T00:00:00.000Z");
    return Array.from({ length: count }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param worksheetIndex worksheetIndexとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback1(_, worksheetIndex) {
        const worksheet = createWorksheet(new Date(baseTime + worksheetIndex * 1000));
        worksheet.title = worksheetListFixtureTitle(profile, worksheetIndex, count);
        worksheet.header.title = worksheet.title;
        if (profile !== "minimal") {
            const assetId = createId();
            worksheet.problems = Array.from({ length: LIST_PROFILE_PROBLEM_COUNTS[profile] }, (/**
             * fromへ渡す処理を実行する。
             *
             * @param _ _として使用する値
             * @param problemIndex problemIndexとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function fromCallback2(_, problemIndex) {
                return createListProblem(profile, worksheetIndex, problemIndex, assetId);
            }));
        }
        return worksheet;
    }));
}
/**
 * worksheetListFixtureTitleに必要な処理を実行する。
 *
 * @param profile profileとして使用する値
 * @param index 対象となる位置
 * @param count countとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function worksheetListFixtureTitle(profile: WorksheetListFixtureProfile, index: number, count: number): string {
    return index === count - 1
        ? "検索対象プリント"
        : `${profile}一覧性能テスト ${String(index).padStart(4, "0")}`;
}
/**
 * summarizeWorksheetComplexityに必要な処理を実行する。
 *
 * @param worksheet worksheetとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function summarizeWorksheetComplexity(worksheet: Worksheet): {
    problems: number;
    contentBlocks: number;
    tableCells: number;
    subQuestions: number;
} {
    let contentBlocks = 0;
    let tableCells = 0;
    let subQuestions = 0;
    worksheet.problems.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param problem problemとして使用する値
     */
    function processItem3(problem) {
        contentBlocks += problem.contents.length;
        problem.contents.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param content contentとして使用する値
         */
        function processItem4(content) {
            if (content.type === "table") {
                tableCells += content.rows.reduce((/**
                 * 各要素を一つの集計結果へまとめる。
                 *
                 * @param total totalとして使用する値
                 * @param row rowとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function reduceItems5(total, row) {
                    return total + row.cells.length;
                }), 0);
            }
            if (content.type === "subQuestionGroup")
                subQuestions += content.items.length;
        }));
    }));
    return { problems: worksheet.problems.length, contentBlocks, tableCells, subQuestions };
}
/**
 * createSimplePdfBenchmarkFixtureで必要な値を作成する。
 *
 * @param pageCount pageCountとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function createSimplePdfBenchmarkFixture(pageCount: number): PdfBenchmarkFixture {
    const worksheet = createWorksheet(new Date("2026-08-28T00:00:00.000Z"));
    worksheet.title = `${pageCount}ページPDF性能テスト`;
    worksheet.header.title = worksheet.title;
    worksheet.problems = Array.from({ length: pageCount }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback6(_, index) {
        const problem = createProblem();
        problem.pageBreakBefore = index > 0;
        const content = problem.contents[0];
        if (content?.type !== "richText")
            throw new Error("PDF性能テスト用本文を作成できませんでした");
        content.document = textDocument(`PDF性能テスト問題 ${index + 1}`);
        return problem;
    }));
    return { worksheet: WorksheetSchema.parse(worksheet), assets: [] };
}
/**
 * createComplexPdfBenchmarkFixtureで必要な値を作成する。
 *
 * @param pageCount pageCountとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function createComplexPdfBenchmarkFixture(pageCount = COMPLEX_PDF_BENCHMARK_PAGE_COUNT): PdfBenchmarkFixture {
    const createdAt = "2026-08-28T00:00:00.000Z";
    const worksheet = createWorksheet(new Date(createdAt));
    const assetId = createId();
    worksheet.title = `${pageCount}ページ複合PDF性能テスト`;
    worksheet.header.title = worksheet.title;
    worksheet.pageSettings.margin = "narrow";
    worksheet.problems = Array.from({ length: pageCount }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback7(_, index) {
        const problem = createProblem();
        const number = index + 1;
        problem.pageBreakBefore = index > 0;
        const richText = createRichTextBlock();
        richText.document = mixedDocument(`複合PDF問題 ${number}`, number, assetId);
        richText.answerDocument = textDocument(`複合PDF問題 ${number} の解答`);
        problem.contents = [richText, populatedTable(number, 3, 4)];
        return problem;
    }));
    return {
        worksheet: WorksheetSchema.parse(worksheet),
        assets: [{
                id: assetId,
                worksheetId: worksheet.id,
                mimeType: "image/png",
                width: 1,
                height: 1,
                createdAt,
                dataBase64: TRANSPARENT_PNG_BASE64,
            }],
    };
}
/**
 * createListProblemで必要な値を作成する。
 *
 * @param profile profileとして使用する値
 * @param worksheetIndex worksheetIndexとして使用する値
 * @param problemIndex problemIndexとして使用する値
 * @param assetId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
function createListProblem(profile: Exclude<WorksheetListFixtureProfile, "minimal">, worksheetIndex: number, problemIndex: number, assetId: string) {
    const problem = createProblem();
    const label = `${worksheetIndex + 1}-${problemIndex + 1}`;
    const richText = createRichTextBlock();
    richText.document = profile === "heavy"
        ? mixedDocument(`高密度問題 ${label}`, problemIndex + 1, assetId)
        : mathDocument(`標準問題 ${label}`, problemIndex + 1);
    richText.answerDocument = textDocument(`問題 ${label} の解答`);
    const answerArea = createAnswerAreaBlock();
    answerArea.answerArea.rows = profile === "heavy" ? 4 : 2;
    answerArea.answerArea.document = textDocument(`問題 ${label} の記述欄`);
    answerArea.answerArea.answerDocument = textDocument(`問題 ${label} の模範解答`);
    if (profile === "typical") {
        problem.contents = [richText, populatedTable(problemIndex + 1, 2, 3), answerArea];
        problem.solution = solutionDocument(`問題 ${label} の解説`, problemIndex + 1);
        return problem;
    }
    const subQuestions = createSubQuestionGroup();
    subQuestions.items = Array.from({ length: 4 }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param itemIndex itemIndexとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback8(_, itemIndex) {
        const item = createSubQuestion();
        item.content = mathDocument(`小問 ${label}-${itemIndex + 1}`, itemIndex + 1);
        item.answerContent = textDocument(`小問 ${label}-${itemIndex + 1} の解答`);
        return item;
    }));
    const box = createBoxBlock();
    box.title = `要点 ${label}`;
    box.document = mathDocument(`問題 ${label} で用いる公式`, problemIndex + 1);
    box.answerDocument = textDocument(`問題 ${label} の要点`);
    problem.contents = [
        richText,
        populatedTable(problemIndex + 1, 4, 5),
        subQuestions,
        answerArea,
        box,
    ];
    problem.solution = solutionDocument(`問題 ${label} の教師用解説`, problemIndex + 1);
    return problem;
}
/**
 * mixedDocumentに必要な処理を実行する。
 *
 * @param label labelとして使用する値
 * @param number numberとして使用する値
 * @param assetId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
function mixedDocument(label: string, number: number, assetId: string): BasicRichTextDocument {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [
                    { type: "text", text: `${label}: `, marks: [{ type: "bold" }] },
                    { type: "inlineMath", attrs: { latex: `x^2+${number}x+1`, textSize: "normal" } },
                    { type: "text", text: " を計算し、表と図を使って説明しなさい。" },
                ],
            },
            { type: "blockMath", attrs: { latex: `\\frac{x+${number}}{2}=y`, textSize: "large" } },
            {
                type: "imageRef",
                attrs: {
                    id: createId(),
                    assetId,
                    alt: `${label}の図`,
                    placement: "block",
                    widthPercent: 25,
                },
            },
        ],
    };
}
/**
 * mathDocumentに必要な処理を実行する。
 *
 * @param label labelとして使用する値
 * @param number numberとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function mathDocument(label: string, number: number): BasicRichTextDocument {
    return {
        type: "doc",
        content: [{
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [
                    { type: "text", text: `${label}: ` },
                    { type: "inlineMath", attrs: { latex: `x+${number}=2x`, textSize: "normal" } },
                ],
            }],
    };
}
/**
 * textDocumentに必要な処理を実行する。
 *
 * @param text textとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function textDocument(text: string): BasicRichTextDocument {
    const document = emptyDocument();
    document.content[0] = {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [{ type: "text", text }],
    };
    return document;
}
/**
 * tableCellDocumentに必要な処理を実行する。
 *
 * @param text textとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function tableCellDocument(text: string): TableCellRichTextDocument {
    return {
        type: "doc",
        content: [{
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [{ type: "text", text }],
            }],
    };
}
/**
 * solutionDocumentに必要な処理を実行する。
 *
 * @param label labelとして使用する値
 * @param number numberとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function solutionDocument(label: string, number: number): SolutionRichTextDocument {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [{ type: "text", text: label, marks: [{ type: "answerColor" }] }],
            },
            {
                type: "blockMath",
                attrs: { latex: `x=\\frac{${number}+1}{2}`, textSize: "normal", answerColor: true },
            },
        ],
    };
}
/**
 * populatedTableに必要な処理を実行する。
 *
 * @param number numberとして使用する値
 * @param rows rowsとして使用する値
 * @param columns columnsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function populatedTable(number: number, rows: number, columns: number): TableBlock {
    const table = createTableBlock(rows, columns);
    table.headerRow = true;
    table.rows.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param row rowとして使用する値
     * @param rowIndex rowIndexとして使用する値
     */
    function processItem9(row, rowIndex) {
        row.cells.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param cell cellとして使用する値
         * @param columnIndex columnIndexとして使用する値
         */
        function processItem10(cell, columnIndex) {
            cell.document = tableCellDocument(`${number}-${rowIndex + 1}-${columnIndex + 1}`);
        }));
    }));
    return table;
}
