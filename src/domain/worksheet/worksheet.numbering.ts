import type { ProblemKind, ProblemNumberFormat, SubQuestionGroupBlock, SubQuestionNumberFormat, Worksheet } from "./worksheet";

export function formatProblemNumber(value: number, format: ProblemNumberFormat): string {
  switch (format) {
    case "plain":
      return String(value);
    case "dot":
      return `${value}.`;
    case "rightParen":
      return `${value})`;
    case "paren":
      return `(${value})`;
    case "bracket":
      return `[${value}]`;
    case "question":
      return `問${value}`;
  }
}

export function getProblemNumbers(worksheet: Worksheet): Map<string, string | null> {
  const current: Record<ProblemKind, number> = { problem: 0, example: 0 };
  const result = new Map<string, string | null>();
  for (const problem of worksheet.problems) {
    if (!problem.numbering.enabled) {
      result.set(problem.id, null);
      continue;
    }
    current[problem.kind] = problem.numbering.restartAt ?? current[problem.kind] + 1;
    result.set(problem.id, formatProblemNumber(current[problem.kind], worksheet.pageSettings.problemNumberFormat));
  }
  return result;
}

export function formatProblemHeading(
  kind: ProblemKind,
  number: string,
  format: ProblemNumberFormat,
): string {
  if (format === "question") {
    return kind === "example" ? number.replace(/^問/u, "例") : number;
  }
  return `${kind === "example" ? "例" : "問"}${number}`;
}

export function formatSubQuestionNumber(value: number, format: SubQuestionNumberFormat): string {
  if (format === "dot") return `${value}.`;
  if (format === "circled" && value <= 20) return String.fromCodePoint(0x245f + value);
  if (format === "kana") {
    const kana = "アイウエオカキクケコサシスセソタチツテトナニヌネノ";
    return kana[value - 1] ?? `(${value})`;
  }
  return `(${value})`;
}

export function getSubQuestionNumbers(
  group: SubQuestionGroupBlock,
  format: SubQuestionNumberFormat = group.numbering.format,
): Map<string, string> {
  let current = 0;
  const result = new Map<string, string>();
  for (const item of group.items) {
    current = item.numbering.restartAt ?? current + 1;
    result.set(item.id, formatSubQuestionNumber(current, format));
  }
  return result;
}
