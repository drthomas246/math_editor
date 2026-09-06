import type { AnswerAreaBlock, BasicRichTextDocument, BoxBlock, ContentBlock, GoalBlock, PageBreakBlock, ProblemBlock, RichTextBlock, SpacerBlock, SubQuestion, SubQuestionGroupBlock, TableBlock, TableCell, TableRow, Worksheet, } from "./worksheet";
export const createId = (/**
 * Idを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function createIdImplementation1(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
});
export const emptyDocument = (/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
function emptyDocumentImplementation2(): BasicRichTextDocument {
    return ({
        type: "doc",
        content: [
            {
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [],
            },
        ],
    });
});
export const emptySolutionDocument = (/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
function emptySolutionDocumentImplementation3() {
    return ({
        type: "doc" as const,
        content: [
            {
                type: "paragraph" as const,
                attrs: { textAlign: "left" as const },
                content: [],
            },
        ],
    });
});
export const createRichTextBlock = (/**
 * リッチ・テキスト・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・処理対象のリッチテキスト文書・解答・文書を持つオブジェクト
 */
function createRichTextBlockImplementation4(): RichTextBlock {
    return ({
        id: createId(),
        type: "richText",
        document: emptyDocument(),
        answerDocument: emptyDocument(),
    });
});
export const createProblem = (/**
 * 問題を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・問題または例題の種別・numbering・検証または変換するファイル内容を持つオブジェクト
 */
function createProblemImplementation5(): ProblemBlock {
    return ({
        id: createId(),
        type: "problem",
        kind: "problem",
        numbering: { enabled: true, restartAt: null },
        contents: [createRichTextBlock()],
        solution: null,
        pageBreakBefore: false,
        pageBreakAfter: false,
    });
});
export const createWorksheet = (/**
 * プリントを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param now 作成日時と更新日時へ記録する基準時刻
 * @returns schema・Version・対象を一意に特定する識別子・プリントまたはテストへ設定する題名・用紙サイズと余白を含むページ設定・プリントへ適用するヘッダー設定を持つオブジェクト
 */
function createWorksheetImplementation6(now = new Date()): Worksheet {
    const timestamp = now.toISOString();
    return {
        schemaVersion: 1,
        id: createId(),
        title: "無題のプリント",
        pageSettings: {
            size: "B5",
            orientation: "portrait",
            margin: "normal",
            fontFamily: "biz-udp-gothic",
            problemNumberFormat: "dot",
            subQuestionNumberFormat: "paren",
        },
        header: {
            title: "無題のプリント",
            gradeField: true,
            classField: true,
            numberField: true,
            nameField: true,
            firstPageOnly: true,
        },
        problems: [createProblem()],
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
    };
});
export const createBoxBlock = (/**
 * Box・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・プリントまたはテストへ設定する題名・preset・処理対象のリッチテキスト文書を持つオブジェクト
 */
function createBoxBlockImplementation7(): BoxBlock {
    return ({
        id: createId(),
        type: "box",
        title: "",
        preset: "simple",
        document: emptyDocument(),
        answerDocument: emptyDocument(),
    });
});
export const createGoalBlock = (/**
 * Goal・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・処理対象のリッチテキスト文書を持つオブジェクト
 */
function createGoalBlockImplementation8(): GoalBlock {
    return ({
        id: createId(),
        type: "goal",
        document: emptyDocument(),
    });
});
export const createAnswerAreaBlock = (/**
 * 解答・Area・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・解答欄の表示領域を持つオブジェクト
 */
function createAnswerAreaBlockImplementation9(): AnswerAreaBlock {
    return ({
        id: createId(),
        type: "answerArea",
        answerArea: {
            style: "lines",
            rows: 2,
            document: emptyDocument(),
            answerDocument: emptyDocument(),
        },
    });
});
export const createSpacerBlock = (/**
 * Spacer・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・作成または検証する表の行数・行一覧を持つオブジェクト
 */
function createSpacerBlockImplementation10(): SpacerBlock {
    return ({
        id: createId(),
        type: "spacer",
        rows: 2,
    });
});
export const createPageBreakBlock = (/**
 * ページ・Break・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別を持つオブジェクト
 */
function createPageBreakBlockImplementation11(): PageBreakBlock {
    return ({
        id: createId(),
        type: "pageBreak",
    });
});
export const createSubQuestion = (/**
 * Sub・Questionを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・numbering・処理対象の問題本文または解説・解答・内容・解答欄の表示領域を持つオブジェクト
 */
function createSubQuestionImplementation12(): SubQuestion {
    return ({
        id: createId(),
        numbering: { restartAt: null },
        content: emptyDocument(),
        answerContent: emptyDocument(),
        answerArea: {
            style: "lines",
            rows: 1,
            document: emptyDocument(),
            answerDocument: emptyDocument(),
        },
        solution: null,
        width: "column",
    });
});
export const createSubQuestionGroup = (/**
 * Sub・Question・グループを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・numbering・作成する表の列数・itemsを持つオブジェクト
 */
function createSubQuestionGroupImplementation13(): SubQuestionGroupBlock {
    return ({
        id: createId(),
        type: "subQuestionGroup",
        numbering: { format: "paren" },
        columns: 2,
        items: [createSubQuestion(), createSubQuestion()],
    });
});
const createCell = (/**
 * セルを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param text 文書または画面へ設定する文字列
 * @returns 対象を一意に特定する識別子・処理対象のリッチテキスト文書・行・Span・列・Spanを持つオブジェクト
 */
function createCellImplementation14(text = ""): TableCell {
    return ({
        id: createId(),
        document: {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    attrs: { textAlign: "left" },
                    content: text ? [{ type: "text", text }] : [],
                },
            ],
        },
        rowSpan: 1,
        columnSpan: 1,
    });
});
export const createTableBlock = (/**
 * 表・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param rows 作成または検証する表の行数・行一覧
 * @param columns 作成する表の列数
 * @param template 新しい問題へ適用する初期テンプレート
 * @returns 対象を一意に特定する識別子・作成または検証する要素種別・作成または検証する表の行数・行一覧・列・Widths・Percent・ヘッダー・行を持つオブジェクト
 */
function createTableBlockImplementation15(rows = 3, columns = 4, template: "general" | "function" | "frequency" = "general"): TableBlock {
    const rowValues: TableRow[] = Array.from({ length: rows }, (/**
     * 配列位置ごとに対象を一意に特定する識別子・cellsを持つオブジェクトを生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param rowIndex 表内での行位置
     * @returns 対象を一意に特定する識別子・cellsを持つオブジェクト
     */
    function fromCallback16(_, rowIndex) {
        return ({
            id: createId(),
            cells: Array.from({ length: columns }, (/**
             * 配列位置ごとにcreate・セルの結果を生成し、fixtureまたはバイナリの要素として格納する。
             *
             * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
             * @param columnIndex 表内での列位置
             * @returns create・セルの結果
             */
            function fromCallback17(_, columnIndex) {
                if (template === "function" && columnIndex === 0) {
                    return createCell(rowIndex === 0 ? "x" : rowIndex === 1 ? "y" : "");
                }
                if (template === "frequency" && rowIndex === 0) {
                    return createCell(columnIndex === 0 ? "階級" : columnIndex === 1 ? "度数" : "");
                }
                return createCell();
            })),
        });
    }));
    return {
        id: createId(),
        type: "table",
        rows: rowValues,
        columnWidthsPercent: Array.from({ length: columns }, (/**
         * 配列位置ごとに100と作成する表の列数で除算した値を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @returns 100と作成する表の列数で除算した値
         */
        function fromCallback18() {
            return 100 / columns;
        })),
        headerRow: template === "frequency",
    };
});
export const createContentBlock = (/**
 * 内容・ブロックを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param type 作成または検証する要素種別
 * @returns create・リッチ・テキスト・ブロックの結果
 */
function createContentBlockImplementation19(type: ContentBlock["type"]): ContentBlock {
    switch (type) {
        case "richText":
            return createRichTextBlock();
        case "box":
            return createBoxBlock();
        case "goal":
            return createGoalBlock();
        case "subQuestionGroup":
            return createSubQuestionGroup();
        case "answerArea":
            return createAnswerAreaBlock();
        case "spacer":
            return createSpacerBlock();
        case "pageBreak":
            return createPageBreakBlock();
        case "table":
            return createTableBlock();
        case "image":
            throw new Error("画像にはAssetRecordが必要です");
    }
});
