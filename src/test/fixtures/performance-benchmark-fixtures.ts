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
 * プリント・一覧・Fixturesを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param profile 生成する負荷データの規模区分
 * @param count 生成または検査する要素数
 * @returns fromの結果として得た要素一覧
 */
export function createWorksheetListFixtures(profile: WorksheetListFixtureProfile, count: number): Worksheet[] {
    if (!Number.isInteger(count) || count <= 0 || count > STRUCTURE_LIMITS.worksheetsPerArchive) {
        throw new Error(`一覧benchmarkのfixture件数が範囲外です: ${count}`);
    }
    const baseTime = Date.parse("2026-08-28T00:00:00.000Z");
    return Array.from({ length: count }, (/**
     * 配列位置ごとに処理対象となるプリントを生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param worksheetIndex fixture一覧内でのプリント位置
     * @returns 処理対象となるプリント
     */
    function fromCallback1(_, worksheetIndex) {
        const worksheet = createWorksheet(new Date(baseTime + worksheetIndex * 1000));
        worksheet.title = worksheetListFixtureTitle(profile, worksheetIndex, count);
        worksheet.header.title = worksheet.title;
        if (profile !== "minimal") {
            const assetId = createId();
            worksheet.problems = Array.from({ length: LIST_PROFILE_PROBLEM_COUNTS[profile] }, (/**
             * 配列位置ごとにcreate・一覧・問題の結果を生成し、fixtureまたはバイナリの要素として格納する。
             *
             * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
             * @param problemIndex プリント内での問題位置
             * @returns create・一覧・問題の結果
             */
            function fromCallback2(_, problemIndex) {
                return createListProblem(profile, worksheetIndex, problemIndex, assetId);
            }));
        }
        return worksheet;
    }));
}
/**
 * 一覧性能fixtureの規模と通し番号を、人が識別できる題名へ整形する。
 *
 * @param profile 生成する負荷データの規模区分
 * @param index 対象となる位置
 * @param count 生成または検査する要素数
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
export function worksheetListFixtureTitle(profile: WorksheetListFixtureProfile, index: number, count: number): string {
    return index === count - 1
        ? "検索対象プリント"
        : `${profile}一覧性能テスト ${String(index).padStart(4, "0")}`;
}
/**
 * プリント内の問題・本文・表セル・画像の件数を走査して負荷規模を集計する。
 *
 * @param worksheet 処理対象となるプリント
 * @returns problems・内容・Blocks・表・Cells・sub・Questionsを持つオブジェクトから算出した数値
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
     * 各処理対象の問題または例題についてfor・Eachを実行し、対応関係または検証状態を更新する。
     *
     * @param problem 処理対象の問題または例題
     */
    function processItem3(problem) {
        contentBlocks += problem.contents.length;
        problem.contents.forEach((/**
         * 各処理対象の問題本文または解説についてreduceを実行し、対応関係または検証状態を更新する。
         *
         * @param content 処理対象の問題本文または解説
         */
        function processItem4(content) {
            if (content.type === "table") {
                tableCells += content.rows.reduce((/**
                 * 現在の計算途中の累積値を、それまでの集計結果へ重複なく反映する。
                 *
                 * @param total 計算途中の累積値
                 * @param row 処理対象の表の行
                 * @returns 計算途中の累積値を反映した次の累積結果
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
 * Simple・PDF・Benchmark・Fixtureを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param pageCount 生成するPDFのページ数
 * @returns 処理対象となるプリント・プリントに関連付ける画像アセット一覧を持つオブジェクト
 */
export function createSimplePdfBenchmarkFixture(pageCount: number): PdfBenchmarkFixture {
    const worksheet = createWorksheet(new Date("2026-08-28T00:00:00.000Z"));
    worksheet.title = `${pageCount}ページPDF性能テスト`;
    worksheet.header.title = worksheet.title;
    worksheet.problems = Array.from({ length: pageCount }, (/**
     * 配列位置ごとに処理対象の問題または例題を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param index 対象となる位置
     * @returns 処理対象の問題または例題
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
 * Complex・PDF・Benchmark・Fixtureを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param pageCount 生成するPDFのページ数
 * @returns 処理対象となるプリント・プリントに関連付ける画像アセット一覧を持つオブジェクト
 */
export function createComplexPdfBenchmarkFixture(pageCount = COMPLEX_PDF_BENCHMARK_PAGE_COUNT): PdfBenchmarkFixture {
    const createdAt = "2026-08-28T00:00:00.000Z";
    const worksheet = createWorksheet(new Date(createdAt));
    const assetId = createId();
    worksheet.title = `${pageCount}ページ複合PDF性能テスト`;
    worksheet.header.title = worksheet.title;
    worksheet.pageSettings.margin = "narrow";
    worksheet.problems = Array.from({ length: pageCount }, (/**
     * 配列位置ごとに処理対象の問題または例題を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param index 対象となる位置
     * @returns 処理対象の問題または例題
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
 * 一覧・問題を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param profile 生成する負荷データの規模区分
 * @param worksheetIndex fixture一覧内でのプリント位置
 * @param problemIndex プリント内での問題位置
 * @param assetId 対象を識別するID
 * @returns 処理対象の問題または例題
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
     * 配列位置ごとに要素を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param itemIndex 配列内での要素位置
     * @returns 要素
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
 * 性能試験で文字装飾・数式・改行を同時に含むリッチテキスト文書を作る。
 *
 * @param label 画面表示やテスト識別に使う名称
 * @param number 表示やデータ生成に使う通し番号
 * @param assetId 対象を識別するID
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * 性能試験で指定式を含む数式中心のリッチテキスト文書を作る。
 *
 * @param label 画面表示やテスト識別に使う名称
 * @param number 表示やデータ生成に使う通し番号
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * 性能試験で指定文字列を含む段落文書を作る。
 *
 * @param text 文書または画面へ設定する文字列
 * @returns 処理対象のリッチテキスト文書
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
 * 性能試験の表セルへ格納する短いリッチテキスト文書を作る。
 *
 * @param text 文書または画面へ設定する文字列
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * 性能試験で本文・数式・表を含む解説文書を作る。
 *
 * @param label 画面表示やテスト識別に使う名称
 * @param number 表示やデータ生成に使う通し番号
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
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
 * 指定行列数の全セルへfixture文書を設定した表を作る。
 *
 * @param number 表示やデータ生成に使う通し番号
 * @param rows 作成または検証する表の行数・行一覧
 * @param columns 作成する表の列数
 * @returns 編集または検証の対象となる表
 */
function populatedTable(number: number, rows: number, columns: number): TableBlock {
    const table = createTableBlock(rows, columns);
    table.headerRow = true;
    table.rows.forEach((/**
     * 各処理対象の表の行についてfor・Eachを実行し、対応関係または検証状態を更新する。
     *
     * @param row 処理対象の表の行
     * @param rowIndex 表内での行位置
     */
    function processItem9(row, rowIndex) {
        row.cells.forEach((/**
         * 各処理対象の表セルについて表・セル・文書を実行し、対応関係または検証状態を更新する。
         *
         * @param cell 処理対象の表セル
         * @param columnIndex 表内での列位置
         */
        function processItem10(cell, columnIndex) {
            cell.document = tableCellDocument(`${number}-${rowIndex + 1}-${columnIndex + 1}`);
        }));
    }));
    return table;
}
