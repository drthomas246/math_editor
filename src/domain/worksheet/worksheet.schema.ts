import { z } from "zod";
import { STRUCTURE_LIMITS } from "./structure-limits";
/**
 * 数学プリントの永続データ形式の正本。
 *
 * - TypeScript 型は worksheet.ts で z.infer から導出する。
 * - math-worksheet.schema.json は MathWorksheetFileSchema から生成する。
 * - 画像本体は Worksheet に含めず、ImageBlock.assetId で参照する。
 */
// -----------------------------------------------------------------------------
// 共通プリミティブ
// -----------------------------------------------------------------------------
export const CURRENT_SCHEMA_VERSION = 1 as const;
export const MATH_WORKSHEET_FILE_FORMAT = "math-worksheet" as const;
export const EntityIdSchema = z
    .string()
    .min(1)
    .meta({ title: "EntityId", description: "アプリ内で一意なエンティティID" });
export const ISODateTimeStringSchema = z.iso
    .datetime({ offset: true })
    .meta({ title: "ISODateTimeString", description: "タイムゾーンを含むISO 8601日時" });
export const SchemaVersionSchema = z.literal(CURRENT_SCHEMA_VERSION);
export const NonNegativeIntegerSchema = z.number().int().min(0);
export const PositiveIntegerSchema = z.number().int().min(1);
export const WorksheetTitleSchema = z
    .string()
    .min(1)
    .max(100)
    .regex(/\S/u, "題名には空白以外の文字が必要です");
// -----------------------------------------------------------------------------
// 用紙・ヘッダー設定
// -----------------------------------------------------------------------------
export const PageSizeSchema = z.enum(["A4", "B5"]);
export const PageOrientationSchema = z.literal("portrait");
export const MarginPresetSchema = z.enum(["wide", "normal", "narrow", "veryNarrow"]);
export const FontFamilySchema = z.enum([
    "biz-udp-gothic",
    "biz-ud-gothic",
    "biz-udp-mincho",
    "noto-sans-jp",
    "noto-serif-jp",
]);
export const ProblemNumberFormatSchema = z.enum([
    "plain",
    "dot",
    "rightParen",
    "paren",
    "bracket",
    "question",
]);
export const SubQuestionNumberFormatSchema = z.enum(["paren", "dot", "circled", "kana"]);
export const PageSettingsSchema = z.strictObject({
    size: PageSizeSchema,
    orientation: PageOrientationSchema,
    margin: MarginPresetSchema,
    fontFamily: FontFamilySchema,
    problemNumberFormat: ProblemNumberFormatSchema,
    // 旧データには存在しないため、従来の小問初期値を補う。
    subQuestionNumberFormat: SubQuestionNumberFormatSchema.default("paren"),
});
export const WorksheetHeaderSchema = z.strictObject({
    title: WorksheetTitleSchema,
    gradeField: z.boolean(),
    classField: z.boolean(),
    numberField: z.boolean(),
    nameField: z.boolean(),
    firstPageOnly: z.literal(true),
});
// -----------------------------------------------------------------------------
// 画像・共通表示値
// -----------------------------------------------------------------------------
export const ImageMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);
export const ImagePlacementSchema = z.enum(["block", "floatLeft", "floatRight"]);
export const ImageWidthPercentSchema = z.union([
    z.literal(25),
    z.literal(33),
    z.literal(50),
    z.literal(66),
    z.literal(75),
    z.literal(100),
]);
export const FloatImageWidthPercentSchema = z.union([
    z.literal(25),
    z.literal(33),
    z.literal(50),
]);
export const TextSizeSchema = z.enum(["small", "normal", "large", "xLarge"]);
export const BoxPresetSchema = z.enum(["simple", "heading", "band", "emphasis"]);
export const AnswerAreaStyleSchema = z.enum(["lines", "box"]);
const ImageRefBaseShape = {
    id: EntityIdSchema,
    assetId: EntityIdSchema,
    alt: z.string(),
    answerColor: z.boolean().optional(),
};
export const ImageRefNodeSchema = z.strictObject({
    type: z.literal("imageRef"),
    attrs: z.discriminatedUnion("placement", [
        z.strictObject({
            ...ImageRefBaseShape,
            placement: z.literal("block"),
            widthPercent: ImageWidthPercentSchema,
        }),
        z.strictObject({
            ...ImageRefBaseShape,
            placement: z.literal("floatLeft"),
            widthPercent: FloatImageWidthPercentSchema,
        }),
        z.strictObject({
            ...ImageRefBaseShape,
            placement: z.literal("floatRight"),
            widthPercent: FloatImageWidthPercentSchema,
        }),
    ]),
});
// -----------------------------------------------------------------------------
// 厳格なリッチテキストAST
// -----------------------------------------------------------------------------
export const RichTextMarkSchema = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("bold") }),
    z.strictObject({ type: z.literal("underline") }),
    z.strictObject({ type: z.literal("italic") }),
    z.strictObject({ type: z.literal("answerColor") }),
    z.strictObject({
        type: z.literal("textSize"),
        attrs: z.strictObject({ size: z.enum(["small", "large", "xLarge"]) }),
    }),
]);
const RichTextMarksSchema = z
    .array(RichTextMarkSchema)
    .max(5)
    .superRefine((/**
 * リッチテキストへ適用する文字装飾一覧だけでは表せない識別子・参照・構造上限の整合性を追加検証する。
 *
 * @param marks リッチテキストへ適用する文字装飾一覧
 * @param context 検証エラーを登録するZodコンテキスト
 */
function superRefineCallback1(marks, context) {
    const types = new Set<string>();
    marks.forEach((/**
     * 各処理対象の文字装飾についてhasを実行し、対応関係または検証状態を更新する。
     *
     * @param mark 処理対象の文字装飾
     * @param index 対象となる位置
     */
    function processItem2(mark, index) {
        if (types.has(mark.type)) {
            context.addIssue({
                code: "custom",
                path: [index, "type"],
                message: `markが重複しています: ${mark.type}`,
            });
        }
        types.add(mark.type);
    }));
}));
export const TextNodeSchema = z.strictObject({
    type: z.literal("text"),
    text: z.string(),
    marks: RichTextMarksSchema.optional(),
});
export const HardBreakNodeSchema = z.strictObject({ type: z.literal("hardBreak") });
const FORBIDDEN_LATEX_COMMAND_PATTERN = /\\(?:href|url|includegraphics|html(?:Class|Id|Style|Data)|css(?:Id|Class)|class|style)\b/iu;
export const LatexStringSchema = z
    .string()
    .min(1)
    .max(STRUCTURE_LIMITS.latexCharacters)
    .superRefine((/**
 * 描画または保存するLaTeX式だけでは表せない識別子・参照・構造上限の整合性を追加検証する。
 *
 * @param latex 描画または保存するLaTeX式
 * @param context 検証エラーを登録するZodコンテキスト
 */
function superRefineCallback3(latex, context) {
    if (latex.trim().length === 0) {
        context.addIssue({ code: "custom", message: "LaTeXを空白だけにはできません" });
    }
    if (FORBIDDEN_LATEX_COMMAND_PATTERN.test(latex)) {
        context.addIssue({ code: "custom", message: "外部参照またはHTML/CSS操作を行うLaTeX commandは禁止です" });
    }
}));
export const InlineMathNodeSchema = z.strictObject({
    type: z.literal("inlineMath"),
    attrs: z.strictObject({
        latex: LatexStringSchema,
        textSize: TextSizeSchema,
        answerColor: z.boolean().optional(),
    }),
});
export const BlockMathNodeSchema = z.strictObject({
    type: z.literal("blockMath"),
    attrs: z.strictObject({
        latex: LatexStringSchema,
        textSize: TextSizeSchema,
        answerColor: z.boolean().optional(),
    }),
});
export const InlineRichTextNodeSchema = z.discriminatedUnion("type", [
    TextNodeSchema,
    HardBreakNodeSchema,
    InlineMathNodeSchema,
]);
export const ParagraphNodeSchema = z.strictObject({
    type: z.literal("paragraph"),
    attrs: z.strictObject({ textAlign: z.enum(["left", "center", "right"]) }),
    content: z.array(InlineRichTextNodeSchema).max(STRUCTURE_LIMITS.richTextNodesPerDocument),
});
export const ListItemNodeSchema = z.strictObject({
    type: z.literal("listItem"),
    content: z
        .array(ParagraphNodeSchema)
        .min(1)
        .max(STRUCTURE_LIMITS.richTextNodesPerDocument),
});
export const BulletListNodeSchema = z.strictObject({
    type: z.literal("bulletList"),
    content: z
        .array(ListItemNodeSchema)
        .min(1)
        .max(STRUCTURE_LIMITS.richTextNodesPerDocument),
});
export const OrderedListNodeSchema = z.strictObject({
    type: z.literal("orderedList"),
    attrs: z.strictObject({ start: PositiveIntegerSchema }),
    content: z
        .array(ListItemNodeSchema)
        .min(1)
        .max(STRUCTURE_LIMITS.richTextNodesPerDocument),
});
const TableCellBlockNodeSchema = z.discriminatedUnion("type", [
    ParagraphNodeSchema,
    ImageRefNodeSchema,
]);
/**
 * リッチ・テキスト・Limitsが永続化または画面表示の制約を満たすか検証する。
 *
 * @param document 処理対象のリッチテキスト文書
 * @param context 検証エラーを登録するZodコンテキスト
 */
function validateRichTextLimits(document: {
    content: readonly unknown[];
}, context: z.RefinementCtx): void {
    let nodeCount = 1;
    const stack: Array<{
        node: unknown;
        depth: number;
    }> = document.content.map((/**
     * 各ノードをノード・depthを持つオブジェクトへ変換する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns ノード・depthを持つオブジェクト
     */
    function mapItem4(node) {
        return ({
            node,
            depth: 2,
        });
    }));
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || typeof current.node !== "object" || current.node === null) {
            continue;
        }
        nodeCount += 1;
        if (nodeCount > STRUCTURE_LIMITS.richTextNodesPerDocument) {
            context.addIssue({
                code: "custom",
                path: ["content"],
                message: `リッチテキストは${STRUCTURE_LIMITS.richTextNodesPerDocument.toLocaleString()}ノード以下にしてください`,
            });
            return;
        }
        if (current.depth > STRUCTURE_LIMITS.richTextDepth) {
            context.addIssue({
                code: "custom",
                path: ["content"],
                message: `リッチテキストのネスト深度は${STRUCTURE_LIMITS.richTextDepth}以下にしてください`,
            });
            return;
        }
        const content = (current.node as {
            content?: unknown;
        }).content;
        if (Array.isArray(content)) {
            for (const child of content) {
                stack.push({ node: child, depth: current.depth + 1 });
            }
        }
    }
}
export const TableCellRichTextDocumentSchema = z
    .strictObject({
    type: z.literal("doc"),
    content: z.array(TableCellBlockNodeSchema).max(STRUCTURE_LIMITS.richTextNodesPerDocument),
})
    .superRefine(validateRichTextLimits)
    .meta({
    title: "TableCellRichTextDocument",
    description: "表セル用。段落、文字、改行、行内数式、画像を許可し、表の入れ子を禁止する文書",
});
// -----------------------------------------------------------------------------
// 表
// -----------------------------------------------------------------------------
export const TableCellSchema = z.strictObject({
    id: EntityIdSchema,
    document: TableCellRichTextDocumentSchema,
    rowSpan: PositiveIntegerSchema.max(STRUCTURE_LIMITS.tableRows),
    columnSpan: PositiveIntegerSchema.max(STRUCTURE_LIMITS.tableColumns),
});
export const TableRowSchema = z.strictObject({
    id: EntityIdSchema,
    heightMm: z.number().min(5).max(100).optional(),
    cells: z.array(TableCellSchema).max(STRUCTURE_LIMITS.tableColumns),
});
const TableRowsSchema = z
    .array(TableRowSchema)
    .min(1)
    .max(STRUCTURE_LIMITS.tableRows);
const TableColumnWidthsSchema = z
    .array(z.number().positive().max(100))
    .min(1)
    .max(STRUCTURE_LIMITS.tableColumns);
type TableData = {
    rows: Array<z.infer<typeof TableRowSchema>>;
    columnWidthsPercent: number[];
};
/**
 * 表・データが永続化または画面表示の制約を満たすか検証する。
 *
 * @param table 編集または検証の対象となる表
 * @param context 検証エラーを登録するZodコンテキスト
 * @param pathPrefix 子要素のエラー位置へ付ける親パス
 */
function validateTableData(table: TableData, context: z.RefinementCtx, pathPrefix: Array<string | number> = []): void {
    const rowCount = table.rows.length;
    const columnCount = table.columnWidthsPercent.length;
    const widthTotal = table.columnWidthsPercent.reduce((/**
     * 現在の計算途中の累積値を、それまでの集計結果へ重複なく反映する。
     *
     * @param total 計算途中の累積値
     * @param width 要素または列へ適用する幅
     * @returns 計算途中の累積値を反映した次の累積結果
     */
    function reduceItems5(total, width) {
        return total + width;
    }), 0);
    if (Math.abs(widthTotal - 100) > 0.01) {
        context.addIssue({
            code: "custom",
            path: [...pathPrefix, "columnWidthsPercent"],
            message: "columnWidthsPercentの合計は100である必要があります",
        });
    }
    const occupied = Array.from({ length: rowCount }, (/**
     * 配列位置ごとにfromの結果を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @returns 変換元の結果
     */
    function fromCallback6() {
        return Array.from({ length: columnCount }, (/**
         * 配列位置ごとにfalseを生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @returns 条件不成立を示すfalse
         */
        function fromCallback7() {
            return false;
        }));
    }));
    table.rows.forEach((/**
     * 各処理対象の表の行についてfor・Eachを実行し、対応関係または検証状態を更新する。
     *
     * @param row 処理対象の表の行
     * @param rowIndex 表内での行位置
     */
    function processItem8(row, rowIndex) {
        let columnIndex = 0;
        row.cells.forEach((/**
         * 各処理対象の表セルについてadd・Issueを実行し、対応関係または検証状態を更新する。
         *
         * @param cell 処理対象の表セル
         * @param cellIndex 行内でのセル位置
         */
        function processItem9(cell, cellIndex) {
            while (columnIndex < columnCount && occupied[rowIndex]?.[columnIndex]) {
                columnIndex += 1;
            }
            const cellPath = [...pathPrefix, "rows", rowIndex, "cells", cellIndex];
            if (columnIndex >= columnCount ||
                rowIndex + cell.rowSpan > rowCount ||
                columnIndex + cell.columnSpan > columnCount) {
                context.addIssue({
                    code: "custom",
                    path: cellPath,
                    message: "セルの結合範囲が表の論理グリッドを超えています",
                });
                return;
            }
            let overlaps = false;
            for (let r = rowIndex; r < rowIndex + cell.rowSpan; r += 1) {
                for (let c = columnIndex; c < columnIndex + cell.columnSpan; c += 1) {
                    if (occupied[r]?.[c]) {
                        overlaps = true;
                    }
                }
            }
            if (overlaps) {
                context.addIssue({
                    code: "custom",
                    path: cellPath,
                    message: "セルの結合範囲が別のセルと重複しています",
                });
                return;
            }
            for (let r = rowIndex; r < rowIndex + cell.rowSpan; r += 1) {
                for (let c = columnIndex; c < columnIndex + cell.columnSpan; c += 1) {
                    const occupiedRow = occupied[r];
                    if (occupiedRow) {
                        occupiedRow[c] = true;
                    }
                }
            }
            columnIndex += cell.columnSpan;
        }));
    }));
    if (occupied.some((/**
     * いずれかの処理対象の表の行が要求条件を満たすか判定する。
     *
     * @param row 処理対象の表の行
     * @returns someの結果が真になる場合はtrue
     */
    function hasMatchingItem10(row) {
        return row.some((/**
         * いずれかの処理対象の表セルが要求条件を満たすか判定する。
         *
         * @param cell 処理対象の表セル
         * @returns 処理対象の表セルが存在しない場合はtrue
         */
        function hasMatchingItem11(cell) {
            return !cell;
        }));
    }))) {
        context.addIssue({
            code: "custom",
            path: [...pathPrefix, "rows"],
            message: "表の論理グリッドに未定義のセルがあります",
        });
    }
}
const TableBlockBaseSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("table"),
    rows: TableRowsSchema,
    columnWidthsPercent: TableColumnWidthsSchema,
    headerRow: z.boolean(),
});
export const TableBlockSchema = TableBlockBaseSchema.superRefine((/**
 * 編集または検証の対象となる表だけでは表せない識別子・参照・構造上限の整合性を追加検証する。
 *
 * @param table 編集または検証の対象となる表
 * @param context 検証エラーを登録するZodコンテキスト
 */
function superRefineCallback12(table, context) {
    validateTableData(table, context);
}));
// -----------------------------------------------------------------------------
// リッチテキスト用途別プロファイル
// -----------------------------------------------------------------------------
const RichTableNodeBaseSchema = z.strictObject({
    type: z.literal("richTable"),
    attrs: z.strictObject({
        id: EntityIdSchema,
        rows: TableRowsSchema,
        columnWidthsPercent: TableColumnWidthsSchema,
        headerRow: z.boolean(),
        answerColor: z.boolean().optional(),
    }),
});
export const RichTableNodeSchema = RichTableNodeBaseSchema.superRefine((/**
 * ノードだけでは表せない識別子・参照・構造上限の整合性を追加検証する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @param context 検証エラーを登録するZodコンテキスト
 */
function superRefineCallback13(node, context) {
    validateTableData(node.attrs, context, ["attrs"]);
}));
export const RichTextSpacerNodeSchema = z.strictObject({
    type: z.literal("spacer"),
    attrs: z.strictObject({
        id: EntityIdSchema,
        rows: z.number().int().min(1).max(STRUCTURE_LIMITS.spacerRows),
    }),
});
export const BasicRichTextBlockNodeSchema = z.discriminatedUnion("type", [
    ParagraphNodeSchema,
    BulletListNodeSchema,
    OrderedListNodeSchema,
    BlockMathNodeSchema,
    ImageRefNodeSchema,
    RichTableNodeSchema,
]);
export const SolutionRichTextBlockNodeSchema = z.discriminatedUnion("type", [
    ParagraphNodeSchema,
    BulletListNodeSchema,
    OrderedListNodeSchema,
    BlockMathNodeSchema,
    ImageRefNodeSchema,
    RichTableNodeSchema,
    RichTextSpacerNodeSchema,
]);
export const BasicRichTextDocumentSchema = z
    .strictObject({
    type: z.literal("doc"),
    content: z.array(BasicRichTextBlockNodeSchema).max(STRUCTURE_LIMITS.richTextNodesPerDocument),
})
    .superRefine(validateRichTextLimits)
    .meta({
    title: "BasicRichTextDocument",
    description: "問題本文、囲み枠、小問本文用の構造化リッチテキスト文書",
});
export const SolutionRichTextDocumentSchema = z
    .strictObject({
    type: z.literal("doc"),
    content: z
        .array(SolutionRichTextBlockNodeSchema)
        .max(STRUCTURE_LIMITS.richTextNodesPerDocument),
})
    .superRefine(validateRichTextLimits)
    .meta({
    title: "SolutionRichTextDocument",
    description: "教師用の解説用の構造化リッチテキスト文書",
});
/** 全許可ノードを扱う汎用名。用途別フィールドでは専用Schemaを使用する。 */
export const RichTextDocumentSchema = SolutionRichTextDocumentSchema;
export const RichTextNodeSchema = z.discriminatedUnion("type", [
    TextNodeSchema,
    HardBreakNodeSchema,
    InlineMathNodeSchema,
    ParagraphNodeSchema,
    ListItemNodeSchema,
    BulletListNodeSchema,
    OrderedListNodeSchema,
    BlockMathNodeSchema,
    ImageRefNodeSchema,
    RichTableNodeSchema,
    RichTextSpacerNodeSchema,
]);
const createEmptyBasicDocument = (/**
 * Empty・Basic・文書を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
function createEmptyBasicDocumentImplementation14() {
    return ({
        type: "doc" as const,
        content: [{
                type: "paragraph" as const,
                attrs: { textAlign: "left" as const },
                content: [],
            }],
    });
});
/**
 * 生徒用解答欄は、欄の見た目に加えて問題色・解答色の文書を持つ。
 * defaultにより従来の罫線だけの保存データもそのまま読み込める。
 */
export const AnswerAreaSchema = z.strictObject({
    style: AnswerAreaStyleSchema,
    rows: z.number().int().min(1).max(STRUCTURE_LIMITS.answerAreaRows),
    document: BasicRichTextDocumentSchema.default(createEmptyBasicDocument),
    answerDocument: BasicRichTextDocumentSchema.default(createEmptyBasicDocument),
});
// -----------------------------------------------------------------------------
// 問題内コンテンツ
// -----------------------------------------------------------------------------
export const RichTextBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("richText"),
    document: BasicRichTextDocumentSchema,
    answerDocument: BasicRichTextDocumentSchema.default(createEmptyBasicDocument),
});
export const BoxBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("box"),
    title: z.string(),
    preset: BoxPresetSchema,
    document: BasicRichTextDocumentSchema,
    answerDocument: BasicRichTextDocumentSchema.default(createEmptyBasicDocument),
});
export const GoalBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("goal"),
    document: BasicRichTextDocumentSchema,
});
export const AnswerAreaBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("answerArea"),
    answerArea: AnswerAreaSchema,
});
export const SpacerBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("spacer"),
    rows: z.number().int().min(1).max(STRUCTURE_LIMITS.spacerRows),
});
export const PageBreakBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("pageBreak"),
});
const ImageBlockBaseShape = {
    id: EntityIdSchema,
    type: z.literal("image"),
    assetId: EntityIdSchema,
    alt: z.string(),
};
export const ImageBlockSchema = z
    .discriminatedUnion("placement", [
    z.strictObject({
        ...ImageBlockBaseShape,
        placement: z.literal("block"),
        widthPercent: ImageWidthPercentSchema,
    }),
    z.strictObject({
        ...ImageBlockBaseShape,
        placement: z.literal("floatLeft"),
        widthPercent: FloatImageWidthPercentSchema,
    }),
    z.strictObject({
        ...ImageBlockBaseShape,
        placement: z.literal("floatRight"),
        widthPercent: FloatImageWidthPercentSchema,
    }),
])
    .meta({
    title: "ImageBlock",
    description: "画像本体を含まない参照情報。assetIdはIndexedDB assetsまたはバックアップassetsのidを参照する。",
});
// -----------------------------------------------------------------------------
// 小問
// -----------------------------------------------------------------------------
export const SubQuestionWidthSchema = z.enum(["column", "full"]);
export const SubQuestionSchema = z.strictObject({
    id: EntityIdSchema,
    numbering: z.strictObject({
        restartAt: z.number().int().min(1).nullable(),
    }).default({ restartAt: null }),
    content: BasicRichTextDocumentSchema,
    answerContent: BasicRichTextDocumentSchema.default(createEmptyBasicDocument),
    answerArea: AnswerAreaSchema.nullable(),
    solution: SolutionRichTextDocumentSchema.nullable(),
    width: SubQuestionWidthSchema,
});
export const SubQuestionGroupBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("subQuestionGroup"),
    numbering: z.strictObject({
        format: SubQuestionNumberFormatSchema,
    }),
    columns: z.union([z.literal(1), z.literal(2)]),
    items: z
        .array(SubQuestionSchema)
        .min(1)
        .max(STRUCTURE_LIMITS.subQuestionsPerGroup),
});
// -----------------------------------------------------------------------------
// 問題・Worksheet
// -----------------------------------------------------------------------------
export const ContentBlockSchema = z.union([
    RichTextBlockSchema,
    BoxBlockSchema,
    GoalBlockSchema,
    SubQuestionGroupBlockSchema,
    AnswerAreaBlockSchema,
    SpacerBlockSchema,
    ImageBlockSchema,
    TableBlockSchema,
    PageBreakBlockSchema,
]);
export const ProblemNumberingSchema = z.strictObject({
    enabled: z.boolean(),
    restartAt: z.number().int().min(1).nullable(),
});
export const ProblemKindSchema = z.enum(["problem", "example"]);
export const ProblemBlockSchema = z.strictObject({
    id: EntityIdSchema,
    type: z.literal("problem"),
    // 旧バージョンで保存された問題は通常の「問題」として読み込む。
    kind: ProblemKindSchema.default("problem"),
    numbering: ProblemNumberingSchema,
    contents: z.array(ContentBlockSchema).max(STRUCTURE_LIMITS.contentBlocksPerProblem),
    solution: SolutionRichTextDocumentSchema.nullable(),
    pageBreakBefore: z.boolean(),
    pageBreakAfter: z.boolean(),
});
const WorksheetObjectSchema = z.strictObject({
    schemaVersion: SchemaVersionSchema,
    id: EntityIdSchema,
    title: WorksheetTitleSchema,
    pageSettings: PageSettingsSchema,
    header: WorksheetHeaderSchema,
    problems: z
        .array(ProblemBlockSchema)
        .min(1)
        .max(STRUCTURE_LIMITS.problemsPerWorksheet),
    createdAt: ISODateTimeStringSchema,
    updatedAt: ISODateTimeStringSchema,
    deletedAt: ISODateTimeStringSchema.nullable(),
});
/**
 * プリント・ヘッダー・題名が永続化または画面表示の制約を満たすか検証する。
 *
 * @param worksheet 処理対象となるプリント
 * @param context 検証エラーを登録するZodコンテキスト
 */
function validateWorksheetHeaderTitle(worksheet: {
    title: string;
    header: {
        title: string;
    };
}, context: z.RefinementCtx): void {
    if (worksheet.header.title !== worksheet.title) {
        context.addIssue({
            code: "custom",
            path: ["header", "title"],
            message: "header.titleはWorksheet.titleと一致する必要があります",
        });
    }
}
/**
 * Unique・Entity・Idsが永続化または画面表示の制約を満たすか検証する。
 *
 * @param value validate・Unique・Entity・Idsで判定または変換する入力値
 * @param context 検証エラーを登録するZodコンテキスト
 */
function validateUniqueEntityIds(value: unknown, context: z.RefinementCtx): void {
    const seenIds = new Map<string, Array<string | number>>();
    const visit = (/**
     * 入れ子の文書・表・問題構造を再帰走査し、対象値を漏れなく収集または検証する。
     *
     * @param current 更新前または現在の状態
     * @param path 検証エラーが指すデータ位置
     */
    function visitImplementation15(current: unknown, path: Array<string | number>): void {
        if (Array.isArray(current)) {
            current.forEach((/**
             * 各要素についてvisitを実行し、対応関係または検証状態を更新する。
             *
             * @param item 配列処理で現在参照している要素
             * @param index 対象となる位置
             */
            function processItem16(item, index) {
                return visit(item, [...path, index]);
            }));
            return;
        }
        if (typeof current !== "object" || current === null) {
            return;
        }
        Object.entries(current).forEach((/**
         * 各保存先または要素を特定するキーと走査中の子ノードの組についてストアの最新状態を取得する関数を実行し、対応関係または検証状態を更新する。
         *
         * @param callbackInput コールバックの呼び出し元から渡される入力情報
         */
        function processItem17(callbackInput) {
            let [key, child] = callbackInput;
            const childPath = [...path, key];
            if (key === "id" && typeof child === "string") {
                const previousPath = seenIds.get(child);
                if (previousPath) {
                    context.addIssue({
                        code: "custom",
                        path: childPath,
                        message: `エンティティIDが重複しています: ${child}（先行: ${previousPath.join(".")}）`,
                    });
                }
                else {
                    seenIds.set(child, childPath);
                }
            }
            visit(child, childPath);
        }));
    });
    visit(value, []);
}
/**
 * プリントが永続化または画面表示の制約を満たすか検証する。
 *
 * @param worksheet 処理対象となるプリント
 * @param context 検証エラーを登録するZodコンテキスト
 */
function validateWorksheet(worksheet: z.infer<typeof WorksheetObjectSchema>, context: z.RefinementCtx) {
    validateWorksheetHeaderTitle(worksheet, context);
    validateUniqueEntityIds(worksheet, context);
}
export const WorksheetSchema = WorksheetObjectSchema.superRefine(validateWorksheet).meta({
    title: "Worksheet",
    description: "画像本体を含まない数学プリントの永続データ",
});
const ActiveWorksheetSchema = WorksheetObjectSchema.extend({
    deletedAt: z.null(),
}).superRefine(validateWorksheet);
// -----------------------------------------------------------------------------
// IndexedDB assets テーブル用レコード
// -----------------------------------------------------------------------------
export const BlobSchema = z.custom<Blob>((/**
 * 変換・検証・保存の対象となる値を基にcustomを導出する。
 *
 * @param value customで判定または変換する入力値
 * @returns 二つの値を比較した結果
 */
function customCallback18(value) {
    return typeof Blob !== "undefined" && value instanceof Blob;
}), "Blobである必要があります");
export const AssetRecordSchema = z
    .strictObject({
    id: EntityIdSchema,
    worksheetId: EntityIdSchema,
    mimeType: ImageMimeTypeSchema,
    blob: BlobSchema,
    width: PositiveIntegerSchema,
    height: PositiveIntegerSchema,
    createdAt: ISODateTimeStringSchema,
})
    .meta({
    title: "AssetRecord",
    description: "IndexedDBのassetsテーブルへBlobとして保存する画像レコード",
});
// -----------------------------------------------------------------------------
// JSONバックアップ用アセットとファイル形式
// -----------------------------------------------------------------------------
export const Base64StringSchema = z
    .string()
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
    .meta({ title: "Base64String", description: "data URLプレフィックスを含まないBase64文字列" });
export const BackupAssetSchema = z
    .strictObject({
    id: EntityIdSchema,
    worksheetId: EntityIdSchema,
    mimeType: ImageMimeTypeSchema,
    dataBase64: Base64StringSchema,
    width: PositiveIntegerSchema,
    height: PositiveIntegerSchema,
    createdAt: ISODateTimeStringSchema,
})
    .meta({
    title: "BackupAsset",
    description: "バックアップ時にAssetRecord.blobをBase64へ変換したJSON表現",
});
const MathWorksheetSingleFileObjectSchema = z
    .strictObject({
    format: z.literal(MATH_WORKSHEET_FILE_FORMAT),
    kind: z.literal("single"),
    version: SchemaVersionSchema,
    exportedAt: ISODateTimeStringSchema,
    worksheet: WorksheetSchema,
    assets: z.array(BackupAssetSchema),
})
    .meta({
    title: "MathWorksheetSingleFile",
    description: "単一プリントと参照画像を格納する再編集可能なバックアップファイル",
});
const MathWorksheetArchiveObjectSchema = z
    .strictObject({
    format: z.literal(MATH_WORKSHEET_FILE_FORMAT),
    kind: z.literal("archive"),
    version: SchemaVersionSchema,
    exportedAt: ISODateTimeStringSchema,
    worksheets: z
        .array(ActiveWorksheetSchema)
        .min(1)
        .max(STRUCTURE_LIMITS.worksheetsPerArchive),
    assets: z.array(BackupAssetSchema),
})
    .meta({
    title: "MathWorksheetArchive",
    description: "ゴミ箱を除く全プリントと参照画像を格納する全体バックアップファイル",
});
const MathWorksheetFileUnionSchema = z.discriminatedUnion("kind", [
    MathWorksheetSingleFileObjectSchema,
    MathWorksheetArchiveObjectSchema,
]);
type WorksheetValue = z.infer<typeof WorksheetObjectSchema>;
type BackupFileValue = z.infer<typeof MathWorksheetFileUnionSchema>;
type EntityPath = Array<string | number>;
/**
 * visitRichTextDocumentで定義された一連の処理を実行する。
 *
 * @param document 処理対象のリッチテキスト文書
 * @param path 検証エラーが指すデータ位置
 * @param worksheetId 対象を識別するID
 * @param registerId 対象を識別するID
 * @param registerAssetReference 検出したアセット参照を登録する処理
 */
function visitRichTextDocument(document: {
    content: readonly unknown[];
}, path: EntityPath, worksheetId: string, registerId: (id: string, path: EntityPath) => void, registerAssetReference: (assetId: string, worksheetId: string, path: EntityPath) => void): void {
    const visitNode = (/**
     * visitNodeで定義された一連の処理を実行する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @param nodePath リッチテキスト内でのノード位置
     */
    function visitNodeImplementation19(node: unknown, nodePath: EntityPath): void {
        if (typeof node !== "object" || node === null) {
            return;
        }
        const value = node as {
            type?: unknown;
            attrs?: Record<string, unknown>;
            content?: unknown[];
        };
        if (value.type === "imageRef" && value.attrs) {
            if (typeof value.attrs.id === "string") {
                registerId(value.attrs.id, [...nodePath, "attrs", "id"]);
            }
            if (typeof value.attrs.assetId === "string") {
                registerAssetReference(value.attrs.assetId, worksheetId, [
                    ...nodePath,
                    "attrs",
                    "assetId",
                ]);
            }
        }
        if (value.type === "spacer" && value.attrs && typeof value.attrs.id === "string") {
            registerId(value.attrs.id, [...nodePath, "attrs", "id"]);
        }
        if (value.type === "richTable" && value.attrs) {
            if (typeof value.attrs.id === "string") {
                registerId(value.attrs.id, [...nodePath, "attrs", "id"]);
            }
            const rows = value.attrs.rows;
            if (Array.isArray(rows)) {
                visitTableRows(rows as Array<z.infer<typeof TableRowSchema>>, [...nodePath, "attrs", "rows"], worksheetId, registerId, registerAssetReference);
            }
        }
        if (Array.isArray(value.content)) {
            value.content.forEach((/**
             * 各走査中の子ノードについてvisit・ノードを実行し、対応関係または検証状態を更新する。
             *
             * @param child 走査中の子ノード
             * @param index 対象となる位置
             */
            function processItem20(child, index) {
                return visitNode(child, [...nodePath, "content", index]);
            }));
        }
    });
    document.content.forEach((/**
     * 各ノードについてvisit・ノードを実行し、対応関係または検証状態を更新する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @param index 対象となる位置
     */
    function processItem21(node, index) {
        return visitNode(node, [...path, "content", index]);
    }));
}
/**
 * visitTableRowsで定義された一連の処理を実行する。
 *
 * @param rows 作成または検証する表の行数・行一覧
 * @param path 検証エラーが指すデータ位置
 * @param worksheetId 対象を識別するID
 * @param registerId 対象を識別するID
 * @param registerAssetReference 検出したアセット参照を登録する処理
 */
function visitTableRows(rows: Array<z.infer<typeof TableRowSchema>>, path: EntityPath, worksheetId: string, registerId: (id: string, path: EntityPath) => void, registerAssetReference: (assetId: string, worksheetId: string, path: EntityPath) => void): void {
    rows.forEach((/**
     * 各処理対象の表の行についてregister・Idを実行し、対応関係または検証状態を更新する。
     *
     * @param row 処理対象の表の行
     * @param rowIndex 表内での行位置
     */
    function processItem22(row, rowIndex) {
        registerId(row.id, [...path, rowIndex, "id"]);
        row.cells.forEach((/**
         * 各処理対象の表セルについてregister・Idを実行し、対応関係または検証状態を更新する。
         *
         * @param cell 処理対象の表セル
         * @param cellIndex 行内でのセル位置
         */
        function processItem23(cell, cellIndex) {
            const cellPath = [...path, rowIndex, "cells", cellIndex];
            registerId(cell.id, [...cellPath, "id"]);
            visitRichTextDocument(cell.document, [...cellPath, "document"], worksheetId, registerId, registerAssetReference);
        }));
    }));
}
/**
 * visitWorksheetで定義された一連の処理を実行する。
 *
 * @param worksheet 処理対象となるプリント
 * @param path 検証エラーが指すデータ位置
 * @param registerId 対象を識別するID
 * @param registerAssetReference 検出したアセット参照を登録する処理
 */
function visitWorksheet(worksheet: WorksheetValue, path: EntityPath, registerId: (id: string, path: EntityPath) => void, registerAssetReference: (assetId: string, worksheetId: string, path: EntityPath) => void): void {
    registerId(worksheet.id, [...path, "id"]);
    worksheet.problems.forEach((/**
     * 各処理対象の問題または例題についてregister・Idを実行し、対応関係または検証状態を更新する。
     *
     * @param problem 処理対象の問題または例題
     * @param problemIndex プリント内での問題位置
     */
    function processItem24(problem, problemIndex) {
        const problemPath = [...path, "problems", problemIndex];
        registerId(problem.id, [...problemPath, "id"]);
        problem.contents.forEach((/**
         * 各処理対象の問題本文または解説についてregister・Idを実行し、対応関係または検証状態を更新する。
         *
         * @param content 処理対象の問題本文または解説
         * @param contentIndex 問題内での本文・解説の位置
         */
        function processItem25(content, contentIndex) {
            const contentPath = [...problemPath, "contents", contentIndex];
            registerId(content.id, [...contentPath, "id"]);
            switch (content.type) {
                case "richText":
                case "box":
                    visitRichTextDocument(content.document, [...contentPath, "document"], worksheet.id, registerId, registerAssetReference);
                    visitRichTextDocument(content.answerDocument, [...contentPath, "answerDocument"], worksheet.id, registerId, registerAssetReference);
                    break;
                case "goal":
                    visitRichTextDocument(content.document, [...contentPath, "document"], worksheet.id, registerId, registerAssetReference);
                    break;
                case "answerArea":
                    visitRichTextDocument(content.answerArea.document, [...contentPath, "answerArea", "document"], worksheet.id, registerId, registerAssetReference);
                    visitRichTextDocument(content.answerArea.answerDocument, [...contentPath, "answerArea", "answerDocument"], worksheet.id, registerId, registerAssetReference);
                    break;
                case "subQuestionGroup":
                    content.items.forEach((/**
                     * 各要素についてregister・識別子を実行し、対応関係または検証状態を更新する。
                     *
                     * @param item 配列処理で現在参照している要素
                     * @param itemIndex 配列内での要素位置
                     */
                    function processItem26(item, itemIndex) {
                        const itemPath = [...contentPath, "items", itemIndex];
                        registerId(item.id, [...itemPath, "id"]);
                        visitRichTextDocument(item.content, [...itemPath, "content"], worksheet.id, registerId, registerAssetReference);
                        visitRichTextDocument(item.answerContent, [...itemPath, "answerContent"], worksheet.id, registerId, registerAssetReference);
                        if (item.answerArea) {
                            visitRichTextDocument(item.answerArea.document, [...itemPath, "answerArea", "document"], worksheet.id, registerId, registerAssetReference);
                            visitRichTextDocument(item.answerArea.answerDocument, [...itemPath, "answerArea", "answerDocument"], worksheet.id, registerId, registerAssetReference);
                        }
                        if (item.solution) {
                            visitRichTextDocument(item.solution, [...itemPath, "solution"], worksheet.id, registerId, registerAssetReference);
                        }
                    }));
                    break;
                case "image":
                    registerAssetReference(content.assetId, worksheet.id, [...contentPath, "assetId"]);
                    break;
                case "table":
                    visitTableRows(content.rows, [...contentPath, "rows"], worksheet.id, registerId, registerAssetReference);
                    break;
                default:
                    break;
            }
        }));
        if (problem.solution) {
            visitRichTextDocument(problem.solution, [...problemPath, "solution"], worksheet.id, registerId, registerAssetReference);
        }
    }));
}
/**
 * Backup・ファイルが永続化または画面表示の制約を満たすか検証する。
 *
 * @param file 読み込みまたは検証の対象ファイル
 * @param context 検証エラーを登録するZodコンテキスト
 */
function validateBackupFile(file: BackupFileValue, context: z.RefinementCtx): void {
    const seenEntityIds = new Map<string, EntityPath>();
    const assetReferences = new Map<string, Array<{
        worksheetId: string;
        path: EntityPath;
    }>>();
    const registerId = (/**
     * register・識別子をストアの最新状態を取得する関数で処理し、その結果を呼び出し元へ反映する。
     *
     * @param id 対象を識別するID
     * @param path 検証エラーが指すデータ位置
     */
    function registerIdImplementation27(id: string, path: EntityPath): void {
        const previousPath = seenEntityIds.get(id);
        if (previousPath) {
            context.addIssue({
                code: "custom",
                path,
                message: `エンティティIDが重複しています: ${id}（先行: ${previousPath.join(".")}）`,
            });
            return;
        }
        seenEntityIds.set(id, path);
    });
    const registerAssetReference = (/**
     * 検出したアセット参照を登録する処理をストアの最新状態を取得する関数で処理し、その結果を呼び出し元へ反映する。
     *
     * @param assetId 対象を識別するID
     * @param worksheetId 対象を識別するID
     * @param path 検証エラーが指すデータ位置
     */
    function registerAssetReferenceImplementation28(assetId: string, worksheetId: string, path: EntityPath): void {
        const references = assetReferences.get(assetId) ?? [];
        references.push({ worksheetId, path });
        assetReferences.set(assetId, references);
    });
    const worksheets = file.kind === "single" ? [file.worksheet] : file.worksheets;
    const worksheetIds = new Set(worksheets.map((/**
     * 各処理対象となるプリントを処理対象となるプリントの対象を一意に特定する識別子へ変換する。
     *
     * @param worksheet 処理対象となるプリント
     * @returns 処理対象となるプリントの対象を一意に特定する識別子
     */
    function mapItem29(worksheet) {
        return worksheet.id;
    })));
    worksheets.forEach((/**
     * 各処理対象となるプリントについてvisit・プリントを実行し、対応関係または検証状態を更新する。
     *
     * @param worksheet 処理対象となるプリント
     * @param index 対象となる位置
     */
    function processItem30(worksheet, index) {
        visitWorksheet(worksheet, file.kind === "single" ? ["worksheet"] : ["worksheets", index], registerId, registerAssetReference);
    }));
    const assetsById = new Map<string, z.infer<typeof BackupAssetSchema>>();
    file.assets.forEach((/**
     * 各処理対象の画像アセットについてregister・Idを実行し、対応関係または検証状態を更新する。
     *
     * @param asset 処理対象の画像アセット
     * @param index 対象となる位置
     */
    function processItem31(asset, index) {
        const assetPath: EntityPath = ["assets", index];
        registerId(asset.id, [...assetPath, "id"]);
        assetsById.set(asset.id, asset);
        if (!worksheetIds.has(asset.worksheetId)) {
            context.addIssue({
                code: "custom",
                path: [...assetPath, "worksheetId"],
                message: "worksheetIdに対応するWorksheetがファイル内にありません",
            });
        }
        if (!assetReferences.has(asset.id)) {
            context.addIssue({
                code: "custom",
                path: [...assetPath, "id"],
                message: "参照されていない余剰Assetはバックアップへ含められません",
            });
        }
    }));
    for (const [assetId, references] of assetReferences) {
        const asset = assetsById.get(assetId);
        if (!asset) {
            context.addIssue({
                code: "custom",
                path: references[0]?.path ?? ["assets"],
                message: `参照するアセットがありません: ${assetId}`,
            });
            continue;
        }
        references.forEach((/**
         * 各検証対象のアセット参照についてadd・Issueを実行し、対応関係または検証状態を更新する。
         *
         * @param reference 検証対象のアセット参照
         */
        function processItem32(reference) {
            if (asset.worksheetId !== reference.worksheetId) {
                context.addIssue({
                    code: "custom",
                    path: reference.path,
                    message: `AssetのworksheetIdが参照元Worksheetと一致しません: ${assetId}`,
                });
            }
        }));
    }
}
export const MathWorksheetSingleFileSchema = MathWorksheetSingleFileObjectSchema.superRefine(validateBackupFile);
export const MathWorksheetArchiveSchema = MathWorksheetArchiveObjectSchema.superRefine(validateBackupFile);
export const MathWorksheetFileSchema = z
    .discriminatedUnion("kind", [MathWorksheetSingleFileSchema, MathWorksheetArchiveSchema])
    .meta({
    title: "MathWorksheetFile",
    description: "単一プリントまたは全体バックアップをkindで判別する数学プリントJSON形式",
});
/** 用途を表す公開別名。 */
export const MathWorksheetBackupSchema = MathWorksheetFileSchema;
