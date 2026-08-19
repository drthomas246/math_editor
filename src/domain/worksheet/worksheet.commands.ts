import { STRUCTURE_LIMITS } from "./structure-limits";
import type {
  BasicRichTextDocument,
  ContentBlock,
  ImageBlock,
  ImagePlacement,
  ImageWidthPercent,
  PageSettings,
  ProblemBlock,
  RichTextNode,
  SolutionRichTextDocument,
  SubQuestion,
  Worksheet,
  WorksheetHeader,
} from "./worksheet";
import { createId, createProblem, createSubQuestion, emptySolutionDocument } from "./worksheet.defaults";

export type WorksheetCommandResult =
  | { ok: true; worksheet: Worksheet }
  | { ok: false; worksheet: Worksheet; code: "STRUCTURE_LIMIT_EXCEEDED" | "NOT_FOUND" | "LAST_ITEM" };

export type RichTextDocumentTarget =
  | { kind: "solution" }
  | { kind: "content"; contentId: string; color?: "problem" | "answer" }
  | {
    kind: "subQuestion";
    groupId: string;
    subQuestionId: string;
    field?: "content" | "answerArea";
    color?: "problem" | "answer";
  };

type RichTextDocumentForTarget<T extends RichTextDocumentTarget> =
  T extends { kind: "solution" } ? SolutionRichTextDocument : BasicRichTextDocument;

export type ImageReferenceUpdate = {
  assetId?: string;
  alt: string;
  placement: ImagePlacement;
  widthPercent: ImageWidthPercent;
};

const clone = <T>(value: T): T => structuredClone(value);

function touch(worksheet: Worksheet): Worksheet {
  worksheet.updatedAt = new Date().toISOString();
  return worksheet;
}

function replaceEntityIds(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(replaceEntityIds);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (key === "id" && typeof child === "string") record[key] = createId();
    else replaceEntityIds(child);
  }
}

export function setWorksheetTitle(source: Worksheet, value: string): Worksheet {
  const worksheet = clone(source);
  const title = value.trim() || "無題のプリント";
  worksheet.title = title.slice(0, 100);
  worksheet.header.title = worksheet.title;
  return touch(worksheet);
}

export function applyWorksheetSettings(
  source: Worksheet,
  pageSettings: PageSettings,
  header: Omit<WorksheetHeader, "title">,
): Worksheet {
  const worksheet = clone(source);
  worksheet.pageSettings = clone(pageSettings);
  worksheet.header = { ...clone(header), title: worksheet.title };
  return touch(worksheet);
}

export function addProblem(source: Worksheet, afterProblemId?: string | null): WorksheetCommandResult {
  if (source.problems.length >= STRUCTURE_LIMITS.problemsPerWorksheet) {
    return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
  }
  const worksheet = clone(source);
  const afterIndex = afterProblemId
    ? worksheet.problems.findIndex((problem) => problem.id === afterProblemId)
    : worksheet.problems.length - 1;
  const insertAt = afterIndex < 0 ? worksheet.problems.length : afterIndex + 1;
  worksheet.problems.splice(insertAt, 0, createProblem());
  return { ok: true, worksheet: touch(worksheet) };
}

export function deleteProblem(source: Worksheet, problemId: string): WorksheetCommandResult {
  if (source.problems.length <= 1) return { ok: false, worksheet: source, code: "LAST_ITEM" };
  const worksheet = clone(source);
  const index = worksheet.problems.findIndex((problem) => problem.id === problemId);
  if (index < 0) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  worksheet.problems.splice(index, 1);
  return { ok: true, worksheet: touch(worksheet) };
}

export function duplicateProblem(source: Worksheet, problemId: string): WorksheetCommandResult {
  if (source.problems.length >= STRUCTURE_LIMITS.problemsPerWorksheet) {
    return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
  }
  const worksheet = clone(source);
  const index = worksheet.problems.findIndex((problem) => problem.id === problemId);
  if (index < 0) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  const copy = clone(worksheet.problems[index]!);
  replaceEntityIds(copy);
  worksheet.problems.splice(index + 1, 0, copy);
  return { ok: true, worksheet: touch(worksheet) };
}

export function moveProblem(source: Worksheet, problemId: string, toIndex: number): WorksheetCommandResult {
  const worksheet = clone(source);
  const fromIndex = worksheet.problems.findIndex((problem) => problem.id === problemId);
  if (fromIndex < 0) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  const [problem] = worksheet.problems.splice(fromIndex, 1);
  worksheet.problems.splice(Math.max(0, Math.min(toIndex, worksheet.problems.length)), 0, problem!);
  return { ok: true, worksheet: touch(worksheet) };
}

export function updateProblem(
  source: Worksheet,
  problemId: string,
  change: (problem: ProblemBlock) => void,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  if (!problem) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  change(problem);
  return { ok: true, worksheet: touch(worksheet) };
}

export function addContent(
  source: Worksheet,
  problemId: string,
  content: ContentBlock,
  afterContentId?: string | null,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  if (!problem) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  if (problem.contents.length >= STRUCTURE_LIMITS.contentBlocksPerProblem) {
    return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
  }
  const afterIndex = afterContentId
    ? problem.contents.findIndex((item) => item.id === afterContentId)
    : problem.contents.length - 1;
  problem.contents.splice(afterIndex < 0 ? problem.contents.length : afterIndex + 1, 0, clone(content));
  return { ok: true, worksheet: touch(worksheet) };
}

export function updateContent(
  source: Worksheet,
  problemId: string,
  contentId: string,
  change: (content: ContentBlock) => void,
): WorksheetCommandResult {
  return updateProblem(source, problemId, (problem) => {
    const content = problem.contents.find((item) => item.id === contentId);
    if (content) change(content);
  });
}

export function updateRichTextDocument<T extends RichTextDocumentTarget>(
  source: Worksheet,
  problemId: string,
  target: T,
  change: (document: RichTextDocumentForTarget<T>) => void,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  if (!problem) return { ok: false, worksheet: source, code: "NOT_FOUND" };

  if (target.kind === "solution") {
    problem.solution ??= emptySolutionDocument();
    change(problem.solution as RichTextDocumentForTarget<T>);
  } else if (target.kind === "content") {
    const content = problem.contents.find((item) => item.id === target.contentId);
    if (!content) return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if (content.type === "richText" || content.type === "box") {
      change(content.document as RichTextDocumentForTarget<T>);
    } else if (content.type === "answerArea") {
      change(content.answerArea.document as RichTextDocumentForTarget<T>);
    } else if (content.type === "goal") {
      change(content.document as RichTextDocumentForTarget<T>);
    } else {
      return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
  } else {
    const group = problem.contents.find((item) => item.id === target.groupId);
    if (!group || group.type !== "subQuestionGroup") {
      return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
    const item = group.items.find((entry) => entry.id === target.subQuestionId);
    if (!item) return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if ((target.field ?? "content") === "answerArea") {
      if (!item.answerArea) return { ok: false, worksheet: source, code: "NOT_FOUND" };
      change(item.answerArea.document as RichTextDocumentForTarget<T>);
    } else {
      change(item.content as RichTextDocumentForTarget<T>);
    }
  }

  return { ok: true, worksheet: touch(worksheet) };
}

/** 独立画像または本文・小問内の画像参照を、同じ操作で安全に更新する。 */
export function updateImageReference(
  source: Worksheet,
  problemId: string,
  imageId: string,
  target: RichTextDocumentTarget | null,
  update: ImageReferenceUpdate,
): WorksheetCommandResult {
  if (target) {
    let found = false;
    const result = updateRichTextDocument(source, problemId, target, (document) => {
      const index = document.content.findIndex((node) => node.type === "imageRef" && node.attrs.id === imageId);
      if (index < 0) return;
      const current = document.content[index];
      if (!current || current.type !== "imageRef") return;
      document.content[index] = createUpdatedImageRef(current, update);
      found = true;
    });
    if (found) return result;
    if (target.kind !== "solution" && target.color === "answer") {
      return updateLegacyAnswerImageReference(source, problemId, imageId, target, update);
    }
    return { ok: false, worksheet: source, code: "NOT_FOUND" };
  }

  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  if (!problem) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  const index = problem.contents.findIndex((content) => content.type === "image" && content.id === imageId);
  const current = problem.contents[index];
  if (index < 0 || !current || current.type !== "image") {
    return { ok: false, worksheet: source, code: "NOT_FOUND" };
  }
  problem.contents[index] = createUpdatedImageBlock(current, update);
  return { ok: true, worksheet: touch(worksheet) };
}

function updateLegacyAnswerImageReference(
  source: Worksheet,
  problemId: string,
  imageId: string,
  target: Exclude<RichTextDocumentTarget, { kind: "solution" }>,
  update: ImageReferenceUpdate,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  if (!problem) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  let document: BasicRichTextDocument | null = null;
  if (target.kind === "content") {
    const content = problem.contents.find((item) => item.id === target.contentId);
    if (content?.type === "richText" || content?.type === "box") document = content.answerDocument;
    else if (content?.type === "answerArea") document = content.answerArea.answerDocument;
  } else {
    const group = problem.contents.find((item) => item.id === target.groupId);
    const item = group?.type === "subQuestionGroup"
      ? group.items.find((entry) => entry.id === target.subQuestionId)
      : null;
    document = (target.field ?? "content") === "answerArea"
      ? item?.answerArea?.answerDocument ?? null
      : item?.answerContent ?? null;
  }
  if (!document) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  const index = document.content.findIndex((node) => node.type === "imageRef" && node.attrs.id === imageId);
  const current = document.content[index];
  if (index < 0 || !current || current.type !== "imageRef") {
    return { ok: false, worksheet: source, code: "NOT_FOUND" };
  }
  document.content[index] = createUpdatedImageRef(current, update);
  return { ok: true, worksheet: touch(worksheet) };
}

function createUpdatedImageBlock(current: ImageBlock, update: ImageReferenceUpdate): ImageBlock {
  const base = {
    id: current.id,
    type: "image" as const,
    assetId: update.assetId ?? current.assetId,
    alt: update.alt,
  };
  if (update.placement === "block") {
    return { ...base, placement: "block", widthPercent: update.widthPercent };
  }
  const widthPercent = Math.min(update.widthPercent, 50) as 25 | 33 | 50;
  return update.placement === "floatLeft"
    ? { ...base, placement: "floatLeft", widthPercent }
    : { ...base, placement: "floatRight", widthPercent };
}

function createUpdatedImageRef(
  current: Extract<RichTextNode, { type: "imageRef" }>,
  update: ImageReferenceUpdate,
): Extract<RichTextNode, { type: "imageRef" }> {
  const base = {
    id: current.attrs.id,
    assetId: update.assetId ?? current.attrs.assetId,
    alt: update.alt,
    answerColor: current.attrs.answerColor,
  };
  if (update.placement === "block") {
    return { type: "imageRef", attrs: { ...base, placement: "block", widthPercent: update.widthPercent } };
  }
  const widthPercent = Math.min(update.widthPercent, 50) as 25 | 33 | 50;
  return update.placement === "floatLeft"
    ? { type: "imageRef", attrs: { ...base, placement: "floatLeft", widthPercent } }
    : { type: "imageRef", attrs: { ...base, placement: "floatRight", widthPercent } };
}

export function deleteContent(
  source: Worksheet,
  problemId: string,
  contentId: string,
): WorksheetCommandResult {
  return updateProblem(source, problemId, (problem) => {
    problem.contents = problem.contents.filter((content) => content.id !== contentId);
  });
}

export function moveContent(
  source: Worksheet,
  problemId: string,
  contentId: string,
  delta: -1 | 1,
): WorksheetCommandResult {
  return updateProblem(source, problemId, (problem) => {
    const from = problem.contents.findIndex((content) => content.id === contentId);
    const to = Math.max(0, Math.min(from + delta, problem.contents.length - 1));
    if (from >= 0 && from !== to) {
      const [content] = problem.contents.splice(from, 1);
      problem.contents.splice(to, 0, content!);
    }
  });
}

export function setProblemSolution(
  source: Worksheet,
  problemId: string,
  document: SolutionRichTextDocument | null,
): WorksheetCommandResult {
  return updateProblem(source, problemId, (problem) => {
    problem.solution = document ? clone(document) : null;
  });
}

export function addSubQuestion(
  source: Worksheet,
  problemId: string,
  groupId: string,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  const group = problem?.contents.find((item) => item.id === groupId);
  if (!group || group.type !== "subQuestionGroup") {
    return { ok: false, worksheet: source, code: "NOT_FOUND" };
  }
  if (group.items.length >= STRUCTURE_LIMITS.subQuestionsPerGroup) {
    return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
  }
  group.items.push(createSubQuestion());
  return { ok: true, worksheet: touch(worksheet) };
}

export function updateSubQuestion(
  source: Worksheet,
  problemId: string,
  groupId: string,
  subQuestionId: string,
  change: (item: SubQuestion) => void,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  const group = problem?.contents.find((item) => item.id === groupId);
  if (!group || group.type !== "subQuestionGroup") {
    return { ok: false, worksheet: source, code: "NOT_FOUND" };
  }
  const item = group.items.find((entry) => entry.id === subQuestionId);
  if (!item) return { ok: false, worksheet: source, code: "NOT_FOUND" };
  change(item);
  return { ok: true, worksheet: touch(worksheet) };
}

export function deleteSubQuestion(
  source: Worksheet,
  problemId: string,
  groupId: string,
  subQuestionId: string,
): WorksheetCommandResult {
  const worksheet = clone(source);
  const problem = worksheet.problems.find((item) => item.id === problemId);
  const group = problem?.contents.find((item) => item.id === groupId);
  if (!group || group.type !== "subQuestionGroup") return { ok: false, worksheet: source, code: "NOT_FOUND" };
  if (group.items.length <= 1) return { ok: false, worksheet: source, code: "LAST_ITEM" };
  group.items = group.items.filter((item) => item.id !== subQuestionId);
  return { ok: true, worksheet: touch(worksheet) };
}

export function cloneWorksheetWithNewIds(source: Worksheet, now = new Date()): Worksheet {
  const worksheet = clone(source);
  replaceEntityIds(worksheet);
  const titleSuffix = "のコピー";
  worksheet.title = `${source.title.slice(0, Math.max(1, 100 - titleSuffix.length))}${titleSuffix}`;
  worksheet.header.title = worksheet.title;
  worksheet.createdAt = now.toISOString();
  worksheet.updatedAt = worksheet.createdAt;
  worksheet.deletedAt = null;
  return worksheet;
}
