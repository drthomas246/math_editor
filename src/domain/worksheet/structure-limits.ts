/**
 * schema version 1 の永続構造上限。
 * Zod Schema、Domain Command、UI の境界判定で共用する。
 */
export const STRUCTURE_LIMITS = {
    worksheetsPerArchive: 2000,
    problemsPerWorksheet: 200,
    contentBlocksPerProblem: 100,
    subQuestionsPerGroup: 100,
    tableRows: 20,
    tableColumns: 20,
    richTextNodesPerDocument: 10000,
    richTextDepth: 20,
    latexCharacters: 5000,
    spacerRows: 20,
    answerAreaRows: 20,
} as const;
