import { z } from "zod";
import * as schema from "./worksheet.schema";

/**
 * アプリが利用するTypeScript型の公開窓口。
 * すべての型は worksheet.schema.ts のZod Schemaから導出し、手書きの
 * interface/type定義を正本として持たない。
 */

export * from "./worksheet.schema";
export * from "./structure-limits";

export type EntityId = z.infer<typeof schema.EntityIdSchema>;
export type ISODateTimeString = z.infer<typeof schema.ISODateTimeStringSchema>;
export type SchemaVersion = z.infer<typeof schema.SchemaVersionSchema>;

export type RichTextMark = z.infer<typeof schema.RichTextMarkSchema>;
export type RichTextNode = z.infer<typeof schema.RichTextNodeSchema>;
export type RichTextDocument = z.infer<typeof schema.RichTextDocumentSchema>;
export type BasicRichTextDocument = z.infer<typeof schema.BasicRichTextDocumentSchema>;
export type SolutionRichTextDocument = z.infer<typeof schema.SolutionRichTextDocumentSchema>;
export type TableCellRichTextDocument = z.infer<typeof schema.TableCellRichTextDocumentSchema>;

export type PageSize = z.infer<typeof schema.PageSizeSchema>;
export type PageOrientation = z.infer<typeof schema.PageOrientationSchema>;
export type MarginPreset = z.infer<typeof schema.MarginPresetSchema>;
export type FontFamily = z.infer<typeof schema.FontFamilySchema>;
export type ProblemNumberFormat = z.infer<typeof schema.ProblemNumberFormatSchema>;
export type SubQuestionNumberFormat = z.infer<typeof schema.SubQuestionNumberFormatSchema>;
export type PageSettings = z.infer<typeof schema.PageSettingsSchema>;
export type WorksheetHeader = z.infer<typeof schema.WorksheetHeaderSchema>;

export type TextSize = z.infer<typeof schema.TextSizeSchema>;
export type BoxPreset = z.infer<typeof schema.BoxPresetSchema>;
export type AnswerAreaStyle = z.infer<typeof schema.AnswerAreaStyleSchema>;
export type AnswerArea = z.infer<typeof schema.AnswerAreaSchema>;
export type RichTextBlock = z.infer<typeof schema.RichTextBlockSchema>;
export type BoxBlock = z.infer<typeof schema.BoxBlockSchema>;
export type GoalBlock = z.infer<typeof schema.GoalBlockSchema>;
export type AnswerAreaBlock = z.infer<typeof schema.AnswerAreaBlockSchema>;
export type SpacerBlock = z.infer<typeof schema.SpacerBlockSchema>;
export type PageBreakBlock = z.infer<typeof schema.PageBreakBlockSchema>;

export type ImageMimeType = z.infer<typeof schema.ImageMimeTypeSchema>;
export type ImagePlacement = z.infer<typeof schema.ImagePlacementSchema>;
export type ImageWidthPercent = z.infer<typeof schema.ImageWidthPercentSchema>;
export type FloatImageWidthPercent = z.infer<typeof schema.FloatImageWidthPercentSchema>;
export type ImageBlock = z.infer<typeof schema.ImageBlockSchema>;

export type TableCell = z.infer<typeof schema.TableCellSchema>;
export type TableRow = z.infer<typeof schema.TableRowSchema>;
export type TableBlock = z.infer<typeof schema.TableBlockSchema>;

export type SubQuestionWidth = z.infer<typeof schema.SubQuestionWidthSchema>;
export type SubQuestion = z.infer<typeof schema.SubQuestionSchema>;
export type SubQuestionGroupBlock = z.infer<typeof schema.SubQuestionGroupBlockSchema>;

export type ContentBlock = z.infer<typeof schema.ContentBlockSchema>;
export type ProblemNumbering = z.infer<typeof schema.ProblemNumberingSchema>;
export type ProblemKind = z.infer<typeof schema.ProblemKindSchema>;
export type ProblemBlock = z.infer<typeof schema.ProblemBlockSchema>;
export type Worksheet = z.infer<typeof schema.WorksheetSchema>;

/** IndexedDB assetsテーブル専用。WorksheetやJSONへBlobを埋め込まない。 */
export type AssetRecord = z.infer<typeof schema.AssetRecordSchema>;

/** JSONバックアップ専用。Blobをdata URLではなく純粋なBase64へ変換した表現。 */
export type BackupAsset = z.infer<typeof schema.BackupAssetSchema>;
export type MathWorksheetFile = z.infer<typeof schema.MathWorksheetFileSchema>;
export type MathWorksheetSingleFile = z.infer<typeof schema.MathWorksheetSingleFileSchema>;
export type MathWorksheetArchive = z.infer<typeof schema.MathWorksheetArchiveSchema>;
export type MathWorksheetBackup = MathWorksheetFile;
