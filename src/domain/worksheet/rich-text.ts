import type { BasicRichTextDocument, RichTextDocument, RichTextNode } from "./worksheet";

type AnyDocument = BasicRichTextDocument | RichTextDocument;

export type ContentColor = "problem" | "answer";

export function documentToPlainText(document: AnyDocument | null): string {
  if (!document) return "";
  const visit = (node: RichTextNode | { type: string; content?: unknown[]; attrs?: Record<string, unknown> }): string => {
    if (node.type === "text" && "text" in node) return String(node.text);
    if (node.type === "hardBreak") return "\n";
    if ((node.type === "inlineMath" || node.type === "blockMath") && node.attrs) {
      return String(node.attrs.latex ?? "");
    }
    if (node.type === "imageRef") return "[画像]";
    if (node.type === "richTable") return "[表]";
    if (node.type === "spacer") return "\n";
    const value = node as { content?: unknown[] };
    const content: unknown[] = Array.isArray(value.content) ? value.content : [];
    const separator = ["paragraph", "listItem", "bulletList", "orderedList"].includes(node.type) ? "\n" : "";
    return content.map((child: unknown) => visit(child as never)).join(separator);
  };
  return document.content.map((node) => visit(node as never)).join("\n").trimEnd();
}

export function plainTextToDocument(value: string): BasicRichTextDocument {
  const lines = value.split(/\r?\n/u);
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph" as const,
      attrs: { textAlign: "left" as const },
      content: line ? [{ type: "text" as const, text: line }] : [],
    })),
  };
}

export function hasVisibleDocument(document: RichTextDocument | null): boolean {
  if (!document) return false;
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const value = node as { type?: string; text?: string; content?: unknown[] };
    if (value.type === "text") return Boolean(value.text?.trim());
    if (["inlineMath", "blockMath", "imageRef", "richTable", "spacer"].includes(value.type ?? "")) return true;
    return value.content?.some(visit) ?? false;
  };
  return document.content.some(visit);
}

/**
 * 以前の「問題色文書＋解答色文書」を、色属性を含む1文書へ統合する。
 * 既存データの解答色文書は末尾へ追加し、全ての可視ノードを解答色にする。
 */
export function mergeColoredDocuments(
  problemDocument: BasicRichTextDocument,
  answerDocument: BasicRichTextDocument,
): BasicRichTextDocument {
  const problemContent = hasVisibleDocument(problemDocument)
    ? structuredClone(problemDocument.content)
    : [];
  const answerContent = hasVisibleDocument(answerDocument)
    ? colorDocumentAsAnswer(answerDocument).content
    : [];
  const content = [...problemContent, ...answerContent];
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
  };
}

export function colorDocumentAsAnswer(document: BasicRichTextDocument): BasicRichTextDocument {
  const cloned = structuredClone(document) as unknown as { type: "doc"; content: unknown[] };
  cloned.content = cloned.content.map(colorNodeAsAnswer);
  return cloned as BasicRichTextDocument;
}

function colorNodeAsAnswer(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const value = node as {
    type?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<Record<string, unknown>>;
    content?: unknown[];
  };
  const next: typeof value = { ...value };
  if (value.type === "text") {
    const marks = [...(value.marks ?? [])];
    if (!marks.some((mark) => mark.type === "answerColor")) marks.push({ type: "answerColor" });
    next.marks = marks;
  } else if (["inlineMath", "blockMath", "imageRef", "richTable"].includes(value.type ?? "")) {
    next.attrs = { ...(value.attrs ?? {}), answerColor: true };
  }
  if (Array.isArray(value.content)) next.content = value.content.map(colorNodeAsAnswer);
  return next;
}

export function nodeUsesAnswerColor(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const value = node as {
    attrs?: { answerColor?: unknown };
    marks?: Array<{ type?: string }>;
  };
  return value.attrs?.answerColor === true || value.marks?.some((mark) => mark.type === "answerColor") === true;
}
