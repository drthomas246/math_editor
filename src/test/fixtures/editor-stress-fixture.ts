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
     * 配列位置ごとにcreate・Idの結果を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @returns create・識別子の結果
     */
    function fromCallback1() {
        return createId();
    }));
    worksheet.title = `${problemCount}問・複合コンテンツ入力性能テスト`;
    worksheet.header.title = worksheet.title;
    worksheet.problems = Array.from({ length: problemCount }, (/**
     * 配列位置ごとにcreate・負荷・問題の結果を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param problemIndex プリント内での問題位置
     * @returns create・負荷・問題の結果
     */
    function fromCallback2(_, problemIndex) {
        return (createStressProblem(problemIndex, assetIds[problemIndex % assetIds.length]!));
    }));
    return {
        worksheet: WorksheetSchema.parse(worksheet),
        assets: assetIds.map((/**
         * 各対象を一意に特定する識別子を対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・要素または列へ適用する幅・要素またはページの高さを持つオブジェクトへ変換する。
         *
         * @param id 対象を識別するID
         * @returns 対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・要素または列へ適用する幅・要素またはページの高さを持つオブジェクト
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
 * 負荷・問題を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param problemIndex プリント内での問題位置
 * @param assetId 対象を識別するID
 * @returns 処理対象の問題または例題
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
     * 配列位置ごとに要素を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param subQuestionIndex 問題グループ内での小問位置
     * @returns 要素
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
 * Mixed・文書を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param problemNumber 表示またはfixture生成に使う問題番号
 * @param assetId 対象を識別するID
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * 数式・文書を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param label 画面表示やテスト識別に使う名称
 * @param latex 描画または保存するLaTeX式
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * 表・セル・文書を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param text 文書または画面へ設定する文字列
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * テキスト・文書を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param text 文書または画面へ設定する文字列
 * @param answerColor 解答へ適用する文字色
 * @returns 処理対象のリッチテキスト文書
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
 * Solution・文書を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param label 画面表示やテスト識別に使う名称
 * @param assetId 対象を識別するID
 * @param problemNumber 表示またはfixture生成に使う問題番号
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * Populated・表を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param problemNumber 表示またはfixture生成に使う問題番号
 * @param rows 作成または検証する表の行数・行一覧
 * @param columns 作成する表の列数
 * @returns 編集または検証の対象となる表
 */
function createPopulatedTable(problemNumber: number, rows: number, columns: number): TableBlock {
    const table = createTableBlock(rows, columns);
    table.headerRow = true;
    table.rows.forEach((/**
     * 各処理対象の表の行についてfor・Eachを実行し、対応関係または検証状態を更新する。
     *
     * @param row 処理対象の表の行
     * @param rowIndex 表内での行位置
     */
    function processItem5(row, rowIndex) {
        row.cells.forEach((/**
         * 各処理対象の表セルについてcreate・表・セル・文書を実行し、対応関係または検証状態を更新する。
         *
         * @param cell 処理対象の表セル
         * @param columnIndex 表内での列位置
         */
        function processItem6(cell, columnIndex) {
            cell.document = createTableCellDocument(`${problemNumber}-${rowIndex + 1}-${columnIndex + 1}`);
        }));
    }));
    return table;
}
