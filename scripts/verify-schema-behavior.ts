import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  AssetRecordSchema,
  MathWorksheetArchiveSchema,
  MathWorksheetFileSchema,
  TableCellRichTextDocumentSchema,
  WorksheetSchema,
} from "../src/domain/worksheet/worksheet.schema";

const timestamp = "2026-08-09T10:00:00+09:00";

const emptyDocument = () => ({ type: "doc", content: [] });

const createProblem = (id: string) => ({
  id,
  type: "problem",
  numbering: { enabled: true, restartAt: null },
  contents: [],
  solution: null,
  pageBreakBefore: false,
  pageBreakAfter: false,
});

const createWorksheet = (id: string, title = `プリント ${id}`) => ({
  schemaVersion: 1,
  id,
  title,
  pageSettings: {
    size: "B5",
    orientation: "portrait",
    margin: "normal",
    fontFamily: "biz-udp-gothic",
    problemNumberFormat: "plain",
  },
  header: {
    title,
    gradeField: true,
    classField: true,
    numberField: true,
    nameField: true,
    firstPageOnly: true,
  },
  problems: [createProblem(`${id}-problem-1`)],
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
});

const validFile = {
  format: "math-worksheet",
  kind: "single",
  version: 1,
  exportedAt: timestamp,
  worksheet: {
    ...createWorksheet("worksheet-1", "一次方程式"),
    problems: [
      {
        ...createProblem("problem-1"),
        contents: [
          {
            id: "image-block-1",
            type: "image",
            assetId: "asset-1",
            alt: "三角形の図",
            placement: "block",
            widthPercent: 50,
          },
        ],
      },
    ],
  },
  assets: [
    {
      id: "asset-1",
      worksheetId: "worksheet-1",
      mimeType: "image/png",
      dataBase64: "iVBORw==",
      width: 640,
      height: 480,
      createdAt: timestamp,
    },
  ],
} as const;

function expectValid(value: unknown, message: string): void {
  const result = MathWorksheetFileSchema.safeParse(value);
  assert.equal(result.success, true, result.success ? message : `${message}: ${result.error.message}`);
}

function expectInvalid(value: unknown, message: string): void {
  assert.equal(MathWorksheetFileSchema.safeParse(value).success, false, message);
}

expectValid(validFile, "単一バックアップの完成形を受理する必要がある");

const validArchive = {
  format: "math-worksheet",
  kind: "archive",
  version: 1,
  exportedAt: timestamp,
  worksheets: [validFile.worksheet],
  assets: validFile.assets,
} as const;
expectValid(validArchive, "全体バックアップの完成形を受理する必要がある");

const validFloatImageFile = structuredClone(validFile) as Record<string, any>;
validFloatImageFile.worksheet.problems[0].contents[0].placement = "floatLeft";
validFloatImageFile.worksheet.problems[0].contents[0].widthPercent = 50;
expectValid(validFloatImageFile, "50%以下の回り込みImageBlockを受理する必要がある");

const oversizedFloatImageFile = structuredClone(validFloatImageFile) as Record<string, any>;
oversizedFloatImageFile.worksheet.problems[0].contents[0].widthPercent = 66;
expectInvalid(oversizedFloatImageFile, "66%以上の回り込みImageBlockを拒否する必要がある");

const legacyImageFile = structuredClone(validFile) as Record<string, any>;
legacyImageFile.worksheet.problems[0].contents[0].dataUrl = "data:image/png;base64,iVBORw==";
legacyImageFile.worksheet.problems[0].contents[0].mimeType = "image/png";
expectInvalid(legacyImageFile, "ImageBlockは旧dataUrl/mimeTypeを拒否する必要がある");

const missingAssetFile = structuredClone(validFile) as Record<string, any>;
missingAssetFile.assets = [];
expectInvalid(missingAssetFile, "ImageBlock.assetIdの参照先がないファイルを拒否する必要がある");

const wrongWorksheetFile = structuredClone(validFile) as Record<string, any>;
wrongWorksheetFile.assets[0].worksheetId = "worksheet-other";
expectInvalid(wrongWorksheetFile, "BackupAsset.worksheetIdの不一致を拒否する必要がある");

const duplicateAssetFile = structuredClone(validFile) as Record<string, any>;
duplicateAssetFile.assets.push(structuredClone(duplicateAssetFile.assets[0]));
expectInvalid(duplicateAssetFile, "重複したBackupAsset.idを拒否する必要がある");

const unusedAssetFile = structuredClone(validFile) as Record<string, any>;
unusedAssetFile.assets.push({
  ...structuredClone(unusedAssetFile.assets[0]),
  id: "asset-unused",
});
expectInvalid(unusedAssetFile, "参照されない余剰Assetを拒否する必要がある");

const svgFile = structuredClone(validFile) as Record<string, any>;
svgFile.assets[0].mimeType = "image/svg+xml";
expectInvalid(svgFile, "SVG MIME型を拒否する必要がある");

const solutionImageFile = structuredClone(validFile) as Record<string, any>;
solutionImageFile.worksheet.problems[0].contents = [];
solutionImageFile.worksheet.problems[0].solution = {
  type: "doc",
  content: [
    {
      type: "imageRef",
      attrs: {
        id: "solution-image-node-1",
        assetId: "asset-1",
        alt: "解説用画像",
        placement: "block",
        widthPercent: 50,
      },
    },
  ],
};
expectValid(solutionImageFile, "教師用RichText内のimageRefをAsset参照として収集する必要がある");

const oversizedFloatImageRefFile = structuredClone(solutionImageFile) as Record<string, any>;
oversizedFloatImageRefFile.worksheet.problems[0].solution.content[0].attrs.placement = "floatRight";
oversizedFloatImageRefFile.worksheet.problems[0].solution.content[0].attrs.widthPercent = 75;
expectInvalid(
  oversizedFloatImageRefFile,
  "66%以上の回り込みRichText imageRefを拒否する必要がある",
);

const arbitraryNodeFile = structuredClone(validFile) as Record<string, any>;
arbitraryNodeFile.worksheet.problems[0].contents = [];
arbitraryNodeFile.assets = [];
arbitraryNodeFile.worksheet.problems[0].solution = {
  type: "doc",
  content: [{ type: "script", attrs: { src: "https://example.invalid" } }],
};
expectInvalid(arbitraryNodeFile, "任意のRichText node typeを拒否する必要がある");

const imageInBasicDocument = structuredClone(validFile) as Record<string, any>;
imageInBasicDocument.worksheet.problems[0].contents = [
  {
    id: "rich-text-1",
    type: "richText",
    document: solutionImageFile.worksheet.problems[0].solution,
  },
];
expectValid(imageInBasicDocument, "問題本文のRichText内でimageRefを受理する必要がある");

const imageInBoxDocument = structuredClone(validFile) as Record<string, any>;
const boxImageDocument = structuredClone(solutionImageFile.worksheet.problems[0].solution);
boxImageDocument.content[0].attrs.id = "box-image-node-1";
imageInBoxDocument.worksheet.problems[0].contents = [
  {
    id: "box-with-image-1",
    type: "box",
    title: "",
    preset: "simple",
    document: boxImageDocument,
  },
];
expectValid(imageInBoxDocument, "囲み枠内でimageRefを受理する必要がある");

const imageInSubQuestionDocument = structuredClone(validFile) as Record<string, any>;
const subQuestionImageDocument = structuredClone(solutionImageFile.worksheet.problems[0].solution);
subQuestionImageDocument.content[0].attrs.id = "sub-question-image-node-1";
imageInSubQuestionDocument.worksheet.problems[0].contents = [
  {
    id: "sub-question-group-with-image-1",
    type: "subQuestionGroup",
    numbering: { format: "paren" },
    columns: 2,
    items: [
      {
        id: "sub-question-with-image-1",
        content: subQuestionImageDocument,
        answerArea: null,
        solution: null,
        width: "column",
      },
    ],
  },
];
expectValid(imageInSubQuestionDocument, "小問本文内でimageRefを受理する必要がある");

const tableInBasicDocument = structuredClone(validFile) as Record<string, any>;
tableInBasicDocument.assets = [];
tableInBasicDocument.worksheet.problems[0].contents = [
  {
    id: "rich-text-with-table-1",
    type: "richText",
    document: {
      type: "doc",
      content: [
        {
          type: "richTable",
          attrs: {
            id: "rich-table-in-basic-1",
            rows: [
              {
                id: "rich-table-row-in-basic-1",
                cells: [
                  {
                    id: "rich-table-cell-in-basic-1",
                    rowSpan: 1,
                    columnSpan: 1,
                    document: emptyDocument(),
                  },
                ],
              },
            ],
            columnWidthsPercent: [100],
            headerRow: false,
          },
        },
      ],
    },
  },
];
expectValid(tableInBasicDocument, "問題本文のRichText内でrichTableを受理する必要がある");

const imageInTableCellFile = structuredClone(validFile) as Record<string, any>;
const tableCellImageDocument = {
  type: "doc",
  content: [
    {
      type: "imageRef",
      attrs: {
        id: "image-in-table-cell-1",
        assetId: "asset-1",
        alt: "セル内画像",
        placement: "block",
        widthPercent: 50,
      },
    },
  ],
};
imageInTableCellFile.worksheet.problems[0].contents = [
  {
    id: "table-with-cell-image-1",
    type: "table",
    rows: [
      {
        id: "table-with-cell-image-row-1",
        cells: [
          {
            id: "table-with-cell-image-cell-1",
            rowSpan: 1,
            columnSpan: 1,
            document: tableCellImageDocument,
          },
        ],
      },
    ],
    columnWidthsPercent: [100],
    headerRow: false,
  },
];
expectValid(imageInTableCellFile, "表セル内でimageRefを受理する必要がある");

const nestedTableCellDocument = structuredClone(tableCellImageDocument) as Record<string, any>;
nestedTableCellDocument.content = [
  tableInBasicDocument.worksheet.problems[0].contents[0].document.content[0],
];
assert.equal(
  TableCellRichTextDocumentSchema.safeParse(nestedTableCellDocument).success,
  false,
  "表セル内のrichTableを拒否する必要がある",
);

const styledParagraphFile = structuredClone(validFile) as Record<string, any>;
styledParagraphFile.worksheet.problems[0].contents = [];
styledParagraphFile.assets = [];
styledParagraphFile.worksheet.problems[0].solution = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: "left", style: "color:red" },
      content: [],
    },
  ],
};
expectInvalid(styledParagraphFile, "RichTextのstyle属性を拒否する必要がある");

const forbiddenLatexFile = structuredClone(validFile) as Record<string, any>;
forbiddenLatexFile.worksheet.problems[0].contents = [];
forbiddenLatexFile.assets = [];
forbiddenLatexFile.worksheet.problems[0].solution = {
  type: "doc",
  content: [
    {
      type: "blockMath",
      attrs: { latex: "\\href{https://example.invalid}{x}", textSize: "normal" },
    },
  ],
};
expectInvalid(forbiddenLatexFile, "外部参照LaTeX commandを拒否する必要がある");

const selectedTextSizeFile = structuredClone(validFile) as Record<string, any>;
selectedTextSizeFile.worksheet.problems[0].contents = [
  {
    id: "rich-text-size-1",
    type: "richText",
    document: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            { type: "text", text: "標準" },
            {
              type: "text",
              text: "大きい文字",
              marks: [{ type: "textSize", attrs: { size: "large" } }],
            },
            {
              type: "inlineMath",
              attrs: { latex: "x^2", textSize: "xLarge" },
            },
          ],
        },
        {
          type: "blockMath",
          attrs: { latex: "x = 3", textSize: "small" },
        },
      ],
    },
  },
];
selectedTextSizeFile.assets = [];
expectValid(selectedTextSizeFile, "選択文字と数式の意味的な文字サイズを受理する必要がある");

const solutionTextSizeFile = structuredClone(selectedTextSizeFile) as Record<string, any>;
solutionTextSizeFile.worksheet.problems[0].contents = [];
solutionTextSizeFile.worksheet.problems[0].solution = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        {
          type: "text",
          text: "教師用解答の特大文字",
          marks: [{ type: "textSize", attrs: { size: "xLarge" } }],
        },
      ],
    },
  ],
};
expectValid(solutionTextSizeFile, "教師用解答でも選択文字のサイズを受理する必要がある");

const legacyBlockTextSizeFile = structuredClone(selectedTextSizeFile) as Record<string, any>;
legacyBlockTextSizeFile.worksheet.problems[0].contents[0].textSize = "normal";
expectInvalid(
  legacyBlockTextSizeFile,
  "RichTextBlock全体へ置く旧textSizeを拒否する必要がある",
);

const normalTextSizeMarkFile = structuredClone(selectedTextSizeFile) as Record<string, any>;
normalTextSizeMarkFile.worksheet.problems[0].contents[0].document.content[0].content[1].marks[0].attrs.size =
  "normal";
expectInvalid(
  normalTextSizeMarkFile,
  "標準文字サイズはtextSize markを残さず正規化する必要がある",
);

const missingMathTextSizeFile = structuredClone(selectedTextSizeFile) as Record<string, any>;
delete missingMathTextSizeFile.worksheet.problems[0].contents[0].document.content[0].content[2].attrs
  .textSize;
expectInvalid(missingMathTextSizeFile, "数式には意味的な文字サイズが必要である");

const spacerFile = structuredClone(validFile) as Record<string, any>;
spacerFile.worksheet.problems[0].contents = [
  { id: "spacer-1", type: "spacer", rows: 20 },
];
spacerFile.assets = [];
expectValid(spacerFile, "20行のSpacerBlockを受理する必要がある");
spacerFile.worksheet.problems[0].contents[0].rows = 21;
expectInvalid(spacerFile, "21行のSpacerBlockを拒否する必要がある");

const boxPresetFile = structuredClone(validFile) as Record<string, any>;
boxPresetFile.worksheet.problems[0].contents = [
  {
    id: "box-1",
    type: "box",
    title: "ポイント",
    preset: "simple",
    document: emptyDocument(),
  },
];
boxPresetFile.assets = [];
expectValid(boxPresetFile, "新しい囲み枠presetを受理する必要がある");
boxPresetFile.worksheet.problems[0].contents[0].title = "";
expectValid(boxPresetFile, "題名が空欄の囲み枠を受理する必要がある");
boxPresetFile.worksheet.problems[0].contents[0].preset = "default";
expectInvalid(boxPresetFile, "旧囲み枠presetを拒否する必要がある");

const noProblemsFile = structuredClone(validFile) as Record<string, any>;
noProblemsFile.worksheet.problems = [];
noProblemsFile.assets = [];
expectInvalid(noProblemsFile, "0問のWorksheetを拒否する必要がある");

const problemLimitWorksheet = createWorksheet("worksheet-problem-limit");
problemLimitWorksheet.problems = Array.from({ length: 200 }, (_, index) =>
  createProblem(`problem-${index + 1}`),
);
assert.equal(WorksheetSchema.safeParse(problemLimitWorksheet).success, true);
problemLimitWorksheet.problems.push(createProblem("problem-201"));
assert.equal(
  WorksheetSchema.safeParse(problemLimitWorksheet).success,
  false,
  "201問のWorksheetを拒否する必要がある",
);

const contentLimitFile = {
  format: "math-worksheet",
  kind: "single",
  version: 1,
  exportedAt: timestamp,
  worksheet: createWorksheet("worksheet-content-limit"),
  assets: [],
} as Record<string, any>;
contentLimitFile.worksheet.problems[0].contents = Array.from({ length: 100 }, (_, index) => ({
  id: `spacer-${index + 1}`,
  type: "spacer",
  rows: 1,
}));
expectValid(contentLimitFile, "100 ContentBlockを受理する必要がある");
contentLimitFile.worksheet.problems[0].contents.push({
  id: "spacer-101",
  type: "spacer",
  rows: 1,
});
expectInvalid(contentLimitFile, "101 ContentBlockを拒否する必要がある");

const subQuestionLimitFile = {
  format: "math-worksheet",
  kind: "single",
  version: 1,
  exportedAt: timestamp,
  worksheet: createWorksheet("worksheet-sub-question-limit"),
  assets: [],
} as Record<string, any>;
subQuestionLimitFile.worksheet.problems[0].contents = [
  {
    id: "sub-question-group-1",
    type: "subQuestionGroup",
    numbering: { format: "paren" },
    columns: 2,
    items: Array.from({ length: 100 }, (_, index) => ({
      id: `sub-question-${index + 1}`,
      content: emptyDocument(),
      answerArea: null,
      solution: null,
      width: "column",
    })),
  },
];
expectValid(subQuestionLimitFile, "100小問を受理する必要がある");
subQuestionLimitFile.worksheet.problems[0].contents[0].items.push({
  id: "sub-question-101",
  content: emptyDocument(),
  answerArea: null,
  solution: null,
  width: "column",
});
expectInvalid(subQuestionLimitFile, "101小問を拒否する必要がある");
subQuestionLimitFile.worksheet.problems[0].contents[0].items = [];
expectInvalid(subQuestionLimitFile, "0小問のグループを拒否する必要がある");

const mergedTableFile = {
  format: "math-worksheet",
  kind: "single",
  version: 1,
  exportedAt: timestamp,
  worksheet: createWorksheet("worksheet-table"),
  assets: [],
} as Record<string, any>;
mergedTableFile.worksheet.problems[0].contents = [
  {
    id: "table-1",
    type: "table",
    rows: [
      {
        id: "row-1",
        cells: [
          {
            id: "cell-1",
            document: emptyDocument(),
            rowSpan: 2,
            columnSpan: 2,
          },
        ],
      },
      { id: "row-2", cells: [] },
    ],
    columnWidthsPercent: [50, 50],
    headerRow: false,
  },
];
expectValid(mergedTableFile, "20×20以内の結合表を受理する必要がある");
mergedTableFile.worksheet.problems[0].contents[0].columnWidthsPercent = Array.from(
  { length: 21 },
  () => 100 / 21,
);
expectInvalid(mergedTableFile, "21列の表を拒否する必要がある");

const duplicateEntityFile = {
  format: "math-worksheet",
  kind: "single",
  version: 1,
  exportedAt: timestamp,
  worksheet: createWorksheet("duplicate-id"),
  assets: [],
} as Record<string, any>;
duplicateEntityFile.worksheet.problems[0].id = "duplicate-id";
expectInvalid(duplicateEntityFile, "ファイル全体のEntity ID重複を拒否する必要がある");

const mismatchedHeaderFile = structuredClone(validFile) as Record<string, any>;
mismatchedHeaderFile.worksheet.header.title = "異なる題名";
expectInvalid(mismatchedHeaderFile, "Worksheet.titleとheader.titleの不一致を拒否する必要がある");

const trashedArchive = structuredClone(validArchive) as Record<string, any>;
trashedArchive.worksheets[0].deletedAt = timestamp;
expectInvalid(trashedArchive, "全体バックアップにゴミ箱Worksheetを含めてはならない");

const archiveAtLimit = {
  format: "math-worksheet",
  kind: "archive",
  version: 1,
  exportedAt: timestamp,
  worksheets: Array.from({ length: 2_000 }, (_, index) =>
    createWorksheet(`archive-worksheet-${index + 1}`),
  ),
  assets: [],
};
assert.equal(
  MathWorksheetArchiveSchema.safeParse(archiveAtLimit).success,
  true,
  "2,000件の全体バックアップを受理する必要がある",
);
archiveAtLimit.worksheets.push(createWorksheet("archive-worksheet-2001"));
assert.equal(
  MathWorksheetArchiveSchema.safeParse(archiveAtLimit).success,
  false,
  "2,001件の全体バックアップを拒否する必要がある",
);

const unsupportedVersion = structuredClone(validFile) as Record<string, any>;
unsupportedVersion.version = 2;
unsupportedVersion.worksheet.schemaVersion = 2;
expectInvalid(unsupportedVersion, "version 1以外を拒否する必要がある");

assert.equal(
  AssetRecordSchema.safeParse({
    id: "asset-1",
    worksheetId: "worksheet-1",
    mimeType: "image/png",
    blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
    width: 640,
    height: 480,
    createdAt: timestamp,
  }).success,
  true,
);

assert.equal(
  AssetRecordSchema.safeParse({
    id: "asset-svg",
    worksheetId: "worksheet-1",
    mimeType: "image/svg+xml",
    blob: new Blob(["<svg/>"] , { type: "image/svg+xml" }),
    width: 100,
    height: 100,
    createdAt: timestamp,
  }).success,
  false,
  "IndexedDB AssetRecordでもSVGを拒否する必要がある",
);

const generatedSchemaPath = fileURLToPath(
  new URL("../schemas/math-worksheet.schema.json", import.meta.url),
);
const generatedSchema = await readFile(generatedSchemaPath, "utf8");

assert.match(generatedSchema, /"kind"/);
assert.match(generatedSchema, /"archive"/);
assert.match(generatedSchema, /"deletedAt"/);
assert.match(generatedSchema, /"spacer"/);
assert.match(generatedSchema, /"imageRef"/);
assert.match(generatedSchema, /"richTable"/);
assert.match(generatedSchema, /"maxItems": 2000/);
assert.match(generatedSchema, /"assetId"/);
assert.match(generatedSchema, /"dataBase64"/);
assert.doesNotMatch(generatedSchema, /"dataUrl"/);
assert.doesNotMatch(generatedSchema, /"blob"/);
assert.doesNotMatch(generatedSchema, /image\/svg\+xml/);

console.log("schema version 1の構造・バックアップ・参照整合性テストに成功しました。");
