import { WorksheetSchema, type AssetRecord, type BasicRichTextDocument, type ContentBlock, type SolutionRichTextDocument, type TableBlock, type TableCellRichTextDocument, type Worksheet, } from "../../domain/worksheet/worksheet";
import { createAnswerAreaBlock, createId, createProblem, createRichTextBlock, createSubQuestion, createSubQuestionGroup, createTableBlock, createWorksheet, emptyDocument, } from "../../domain/worksheet/worksheet.defaults";
export const EDITOR_STRESS_PROBLEM_COUNT = 200;
export const EDITOR_STRESS_CONTENTS_PER_PROBLEM = 5;
export const EDITOR_STRESS_SUBQUESTIONS_PER_GROUP = 2;
export const EDITOR_STRESS_ASSET_COUNT = 20;
export type EditorStressAsset = Omit<AssetRecord, "blob">;
export type EditorStressFixture = {
    worksheet: Worksheet;
    assets: EditorStressAsset[];
};
/**
 * 任意実行のブラウザーベンチマーク向けに、Schemaへ適合する最大問題数のデータを作成する。
 * Playwrightのpage.evaluate境界を越えて直列化できるよう、Blobはブラウザー側で追加する。
 *
 * @param problemCount 生成する問題数
 * @returns エディタ負荷試験用のプリントとアセット情報
 */
export function createEditorStressFixture(problemCount = EDITOR_STRESS_PROBLEM_COUNT): EditorStressFixture {
    const createdAt = "2026-08-28T00:00:00.000Z";
    const worksheet = createWorksheet(new Date(createdAt));
    const assetIds = Array.from({ length: EDITOR_STRESS_ASSET_COUNT }, (/**
     * fromへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback1() {
        return createId();
    }));
    worksheet.title = `${problemCount}問・複合コンテンツ入力性能テスト`;
    worksheet.header.title = worksheet.title;
    worksheet.problems = Array.from({ length: problemCount }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param problemIndex problemIndexとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback2(_, problemIndex) {
        return (createStressProblem(problemIndex, assetIds[problemIndex % assetIds.length]!));
    }));
    return {
        worksheet: WorksheetSchema.parse(worksheet),
        assets: assetIds.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param id 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem3(id): EditorStressAsset {
            return ({
                id,
                worksheetId: worksheet.id,
                mimeType: "image/png",
                width: 1,
                height: 1,
                createdAt,
            });
        })),
    };
}
/**
 * createStressProblemで必要な値を作成する。
 *
 * @param problemIndex problemIndexとして使用する値
 * @param assetId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
function createStressProblem(problemIndex: number, assetId: string) {
    const number = problemIndex + 1;
    const problem = createProblem();
    const richText = createRichTextBlock();
    richText.document = createMixedDocument(number, assetId);
    richText.answerDocument = createTextDocument(`解答 ${number}: x = ${number + 1}`);
    const table = createPopulatedTable(number, 2, 3);
    const image: Extract<ContentBlock, {
        type: "image";
    }> = {
        id: createId(),
        type: "image",
        assetId,
        alt: `性能テスト用の図 ${number}`,
        placement: "block",
        widthPercent: 50,
    };
    const subQuestions = createSubQuestionGroup();
    subQuestions.items = Array.from({ length: EDITOR_STRESS_SUBQUESTIONS_PER_GROUP }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param subQuestionIndex subQuestionIndexとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback4(_, subQuestionIndex) {
        const item = createSubQuestion();
        const label = `${number}-${subQuestionIndex + 1}`;
        item.content = createMathDocument(`小問 ${label}`, `x+${subQuestionIndex + 1}`);
        item.answerContent = createTextDocument(`小問 ${label} の解答`, true);
        if (item.answerArea) {
            item.answerArea.rows = 2;
            item.answerArea.document = createTextDocument(`途中式 ${label}`);
            item.answerArea.answerDocument = createTextDocument(`結果 ${label}`, true);
        }
        item.solution = createSolutionDocument(`小問 ${label} の解説`, assetId, number);
        item.width = subQuestionIndex === 1 ? "full" : "column";
        return item;
    }));
    const answerArea = createAnswerAreaBlock();
    answerArea.answerArea.style = "box";
    answerArea.answerArea.rows = 4;
    answerArea.answerArea.document = createTextDocument(`問題 ${number} の記述欄`);
    answerArea.answerArea.answerDocument = createTextDocument(`模範解答 ${number}`, true);
    problem.kind = problemIndex % 10 === 0 ? "example" : "problem";
    problem.contents = [richText, table, image, subQuestions, answerArea];
    problem.solution = createSolutionDocument(`問題 ${number} の教師用解説`, assetId, number);
    return problem;
}
/**
 * createMixedDocumentで必要な値を作成する。
 *
 * @param problemNumber problemNumberとして使用する値
 * @param assetId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
function createMixedDocument(problemNumber: number, assetId: string): BasicRichTextDocument {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [
                    { type: "text", text: `性能テスト問題 ${problemNumber}: `, marks: [{ type: "bold" }] },
                    { type: "inlineMath", attrs: { latex: `x^2+${problemNumber}x+1`, textSize: "normal" } },
                    { type: "text", text: " を計算し、理由も説明しなさい。" },
                ],
            },
            {
                type: "blockMath",
                attrs: { latex: `\\frac{x+${problemNumber}}{2}=y`, textSize: "large" },
            },
            {
                type: "imageRef",
                attrs: {
                    id: createId(),
                    assetId,
                    alt: `本文内の図 ${problemNumber}`,
                    placement: "floatRight",
                    widthPercent: 33,
                },
            },
        ],
    };
}
/**
 * createMathDocumentで必要な値を作成する。
 *
 * @param label labelとして使用する値
 * @param latex latexとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createMathDocument(label: string, latex: string): TableCellRichTextDocument {
    return {
        type: "doc",
        content: [{
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [
                    { type: "text", text: `${label}: ` },
                    { type: "inlineMath", attrs: { latex, textSize: "normal" } },
                ],
            }],
    };
}
/**
 * createTableCellDocumentで必要な値を作成する。
 *
 * @param text textとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createTableCellDocument(text: string): TableCellRichTextDocument {
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
 * createTextDocumentで必要な値を作成する。
 *
 * @param text textとして使用する値
 * @param answerColor answerColorとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createTextDocument(text: string, answerColor = false): BasicRichTextDocument {
    const document = emptyDocument();
    document.content[0] = {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [{
                type: "text",
                text,
                ...(answerColor ? { marks: [{ type: "answerColor" as const }] } : {}),
            }],
    };
    return document;
}
/**
 * createSolutionDocumentで必要な値を作成する。
 *
 * @param label labelとして使用する値
 * @param assetId 対象を識別するID
 * @param problemNumber problemNumberとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createSolutionDocument(label: string, assetId: string, problemNumber: number): SolutionRichTextDocument {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [
                    { type: "text", text: `${label}: ` },
                    {
                        type: "text",
                        text: "赤字の解答を確認する。",
                        marks: [{ type: "answerColor" }],
                    },
                ],
            },
            {
                type: "blockMath",
                attrs: {
                    latex: `x=\\frac{${problemNumber}+1}{2}`,
                    textSize: "normal",
                    answerColor: true,
                },
            },
            {
                type: "imageRef",
                attrs: {
                    id: createId(),
                    assetId,
                    alt: `${label}の図`,
                    placement: "block",
                    widthPercent: 25,
                    answerColor: true,
                },
            },
            { type: "spacer", attrs: { id: createId(), rows: 1 } },
        ],
    };
}
/**
 * createPopulatedTableで必要な値を作成する。
 *
 * @param problemNumber problemNumberとして使用する値
 * @param rows rowsとして使用する値
 * @param columns columnsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createPopulatedTable(problemNumber: number, rows: number, columns: number): TableBlock {
    const table = createTableBlock(rows, columns);
    table.headerRow = true;
    table.rows.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param row rowとして使用する値
     * @param rowIndex rowIndexとして使用する値
     */
    function processItem5(row, rowIndex) {
        row.cells.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param cell cellとして使用する値
         * @param columnIndex columnIndexとして使用する値
         */
        function processItem6(cell, columnIndex) {
            cell.document = createTableCellDocument(`${problemNumber}-${rowIndex + 1}-${columnIndex + 1}`);
        }));
    }));
    return table;
}
