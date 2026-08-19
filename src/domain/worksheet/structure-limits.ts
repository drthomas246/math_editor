/**
 * schema version 1 の永続構造上限。
 * Zod Schema、Domain Command、UI の境界判定で共用する。
 */
export const STRUCTURE_LIMITS = {
  worksheetsPerArchive: 2_000,
  problemsPerWorksheet: 200,
  contentBlocksPerProblem: 100,
  subQuestionsPerGroup: 100,
  tableRows: 20,
  tableColumns: 20,
  richTextNodesPerDocument: 10_000,
  richTextDepth: 20,
  latexCharacters: 5_000,
  spacerRows: 20,
  answerAreaRows: 20,
} as const;

