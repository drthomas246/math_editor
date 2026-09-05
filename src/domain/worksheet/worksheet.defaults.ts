import type { AnswerAreaBlock, BasicRichTextDocument, BoxBlock, ContentBlock, GoalBlock, PageBreakBlock, ProblemBlock, RichTextBlock, SpacerBlock, SubQuestion, SubQuestionGroupBlock, TableBlock, TableCell, TableRow, Worksheet, } from "./worksheet";
export const createId = (/**
 * createIdで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function createIdImplementation1(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
});
export const emptyDocument = (/**
 * emptyDocumentに必要な処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * emptySolutionDocumentに必要な処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createRichTextBlockで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createProblemで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createWorksheetで必要な値を作成する。
 *
 * @param now nowとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * createBoxBlockで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createGoalBlockで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function createGoalBlockImplementation8(): GoalBlock {
    return ({
        id: createId(),
        type: "goal",
        document: emptyDocument(),
    });
});
export const createAnswerAreaBlock = (/**
 * createAnswerAreaBlockで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createSpacerBlockで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function createSpacerBlockImplementation10(): SpacerBlock {
    return ({
        id: createId(),
        type: "spacer",
        rows: 2,
    });
});
export const createPageBreakBlock = (/**
 * createPageBreakBlockで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function createPageBreakBlockImplementation11(): PageBreakBlock {
    return ({
        id: createId(),
        type: "pageBreak",
    });
});
export const createSubQuestion = (/**
 * createSubQuestionで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createSubQuestionGroupで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
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
 * createCellで必要な値を作成する。
 *
 * @param text textとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * createTableBlockで必要な値を作成する。
 *
 * @param rows rowsとして使用する値
 * @param columns columnsとして使用する値
 * @param template templateとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createTableBlockImplementation15(rows = 3, columns = 4, template: "general" | "function" | "frequency" = "general"): TableBlock {
    const rowValues: TableRow[] = Array.from({ length: rows }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param rowIndex rowIndexとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback16(_, rowIndex) {
        return ({
            id: createId(),
            cells: Array.from({ length: columns }, (/**
             * fromへ渡す処理を実行する。
             *
             * @param _ _として使用する値
             * @param columnIndex columnIndexとして使用する値
             * @returns 呼び出し元で使用する処理結果
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
         * fromへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback18() {
            return 100 / columns;
        })),
        headerRow: template === "frequency",
    };
});
export const createContentBlock = (/**
 * createContentBlockで必要な値を作成する。
 *
 * @param type typeとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
