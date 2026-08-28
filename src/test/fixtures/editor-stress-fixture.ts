import {
  WorksheetSchema,
  type AssetRecord,
  type BasicRichTextDocument,
  type ContentBlock,
  type SolutionRichTextDocument,
  type TableBlock,
  type TableCellRichTextDocument,
  type Worksheet,
} from "../../domain/worksheet/worksheet";
import {
  createAnswerAreaBlock,
  createId,
  createProblem,
  createRichTextBlock,
  createSubQuestion,
  createSubQuestionGroup,
  createTableBlock,
  createWorksheet,
  emptyDocument,
} from "../../domain/worksheet/worksheet.defaults";

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
 * Builds a schema-valid, maximum-problem-count fixture for the opt-in browser
 * benchmark. Blobs are added in the browser so this value remains serializable
 * through Playwright's page.evaluate boundary.
 */
export function createEditorStressFixture(
  problemCount = EDITOR_STRESS_PROBLEM_COUNT,
): EditorStressFixture {
  const createdAt = "2026-08-28T00:00:00.000Z";
  const worksheet = createWorksheet(new Date(createdAt));
  const assetIds = Array.from({ length: EDITOR_STRESS_ASSET_COUNT }, () => createId());

  worksheet.title = `${problemCount}問・複合コンテンツ入力性能テスト`;
  worksheet.header.title = worksheet.title;
  worksheet.problems = Array.from({ length: problemCount }, (_, problemIndex) => (
    createStressProblem(problemIndex, assetIds[problemIndex % assetIds.length]!)
  ));

  return {
    worksheet: WorksheetSchema.parse(worksheet),
    assets: assetIds.map((id): EditorStressAsset => ({
      id,
      worksheetId: worksheet.id,
      mimeType: "image/png",
      width: 1,
      height: 1,
      createdAt,
    })),
  };
}

function createStressProblem(problemIndex: number, assetId: string) {
  const number = problemIndex + 1;
  const problem = createProblem();
  const richText = createRichTextBlock();
  richText.document = createMixedDocument(number, assetId);
  richText.answerDocument = createTextDocument(`解答 ${number}: x = ${number + 1}`);

  const table = createPopulatedTable(number, 2, 3);
  const image: Extract<ContentBlock, { type: "image" }> = {
    id: createId(),
    type: "image",
    assetId,
    alt: `性能テスト用の図 ${number}`,
    placement: "block",
    widthPercent: 50,
  };

  const subQuestions = createSubQuestionGroup();
  subQuestions.items = Array.from(
    { length: EDITOR_STRESS_SUBQUESTIONS_PER_GROUP },
    (_, subQuestionIndex) => {
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
    },
  );

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

function createSolutionDocument(
  label: string,
  assetId: string,
  problemNumber: number,
): SolutionRichTextDocument {
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

function createPopulatedTable(
  problemNumber: number,
  rows: number,
  columns: number,
): TableBlock {
  const table = createTableBlock(rows, columns);
  table.headerRow = true;
  table.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, columnIndex) => {
      cell.document = createTableCellDocument(
        `${problemNumber}-${rowIndex + 1}-${columnIndex + 1}`,
      );
    });
  });
  return table;
}
