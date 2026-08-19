import type {
  AnswerAreaBlock,
  BasicRichTextDocument,
  BoxBlock,
  ContentBlock,
  GoalBlock,
  PageBreakBlock,
  ProblemBlock,
  RichTextBlock,
  SpacerBlock,
  SubQuestion,
  SubQuestionGroupBlock,
  TableBlock,
  TableCell,
  TableRow,
  Worksheet,
} from "./worksheet";

export const createId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const emptyDocument = (): BasicRichTextDocument => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [],
    },
  ],
});

export const emptySolutionDocument = () => ({
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      attrs: { textAlign: "left" as const },
      content: [],
    },
  ],
});

export const createRichTextBlock = (): RichTextBlock => ({
  id: createId(),
  type: "richText",
  document: emptyDocument(),
  answerDocument: emptyDocument(),
});

export const createProblem = (): ProblemBlock => ({
  id: createId(),
  type: "problem",
  kind: "problem",
  numbering: { enabled: true, restartAt: null },
  contents: [createRichTextBlock()],
  solution: null,
  pageBreakBefore: false,
  pageBreakAfter: false,
});

export const createWorksheet = (now = new Date()): Worksheet => {
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
};

export const createBoxBlock = (): BoxBlock => ({
  id: createId(),
  type: "box",
  title: "",
  preset: "simple",
  document: emptyDocument(),
  answerDocument: emptyDocument(),
});

export const createGoalBlock = (): GoalBlock => ({
  id: createId(),
  type: "goal",
  document: emptyDocument(),
});

export const createAnswerAreaBlock = (): AnswerAreaBlock => ({
  id: createId(),
  type: "answerArea",
  answerArea: {
    style: "lines",
    rows: 2,
    document: emptyDocument(),
    answerDocument: emptyDocument(),
  },
});

export const createSpacerBlock = (): SpacerBlock => ({
  id: createId(),
  type: "spacer",
  rows: 2,
});

export const createPageBreakBlock = (): PageBreakBlock => ({
  id: createId(),
  type: "pageBreak",
});

export const createSubQuestion = (): SubQuestion => ({
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

export const createSubQuestionGroup = (): SubQuestionGroupBlock => ({
  id: createId(),
  type: "subQuestionGroup",
  numbering: { format: "paren" },
  columns: 2,
  items: [createSubQuestion(), createSubQuestion()],
});

const createCell = (text = ""): TableCell => ({
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

export const createTableBlock = (
  rows = 3,
  columns = 4,
  template: "general" | "function" | "frequency" = "general",
): TableBlock => {
  const rowValues: TableRow[] = Array.from({ length: rows }, (_, rowIndex) => ({
    id: createId(),
    cells: Array.from({ length: columns }, (_, columnIndex) => {
      if (template === "function" && columnIndex === 0) {
        return createCell(rowIndex === 0 ? "x" : rowIndex === 1 ? "y" : "");
      }
      if (template === "frequency" && rowIndex === 0) {
        return createCell(columnIndex === 0 ? "階級" : columnIndex === 1 ? "度数" : "");
      }
      return createCell();
    }),
  }));
  return {
    id: createId(),
    type: "table",
    rows: rowValues,
    columnWidthsPercent: Array.from({ length: columns }, () => 100 / columns),
    headerRow: template === "frequency",
  };
};

export const createContentBlock = (type: ContentBlock["type"]): ContentBlock => {
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
};
