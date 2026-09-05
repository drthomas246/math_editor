import type { BasicRichTextDocument, RichTextDocument, RichTextNode } from "./worksheet";
type AnyDocument = BasicRichTextDocument | RichTextDocument;
export type ContentColor = "problem" | "answer";
/**
 * documentToPlainTextに必要な処理を実行する。
 *
 * @param document documentとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function documentToPlainText(document: AnyDocument | null): string {
    if (!document)
        return "";
    const visit = (/**
     * visitで定義された一連の処理を実行する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function visitImplementation1(node: RichTextNode | {
        type: string;
        content?: unknown[];
        attrs?: Record<string, unknown>;
    }): string {
        if (node.type === "text" && "text" in node)
            return String(node.text);
        if (node.type === "hardBreak")
            return "\n";
        if ((node.type === "inlineMath" || node.type === "blockMath") && node.attrs) {
            return typeof node.attrs.latex === "string" ? node.attrs.latex : "";
        }
        if (node.type === "imageRef")
            return "[画像]";
        if (node.type === "richTable")
            return "[表]";
        if (node.type === "spacer")
            return "\n";
        const value = node as {
            content?: unknown[];
        };
        const content: unknown[] = Array.isArray(value.content) ? value.content : [];
        const separator = ["paragraph", "listItem", "bulletList", "orderedList"].includes(node.type) ? "\n" : "";
        return content.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param child childとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem2(child: unknown) {
            return visit(child as never);
        })).join(separator);
    });
    return document.content.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem3(node) {
        return visit(node as never);
    })).join("\n").trimEnd();
}
/**
 * plainTextToDocumentに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function plainTextToDocument(value: string): BasicRichTextDocument {
    const lines = value.split(/\r?\n/u);
    return {
        type: "doc",
        content: lines.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param line lineとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem4(line) {
            return ({
                type: "paragraph" as const,
                attrs: { textAlign: "left" as const },
                content: line ? [{ type: "text" as const, text: line }] : [],
            });
        })),
    };
}
/**
 * hasVisibleDocumentで表される条件を判定する。
 *
 * @param document documentとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function hasVisibleDocument(document: RichTextDocument | null): boolean {
    if (!document)
        return false;
    const visit = (/**
     * visitで定義された一連の処理を実行する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function visitImplementation5(node: unknown): boolean {
        if (!node || typeof node !== "object")
            return false;
        const value = node as {
            type?: string;
            text?: string;
            content?: unknown[];
        };
        if (value.type === "text")
            return Boolean(value.text?.trim());
        if (["inlineMath", "blockMath", "imageRef", "richTable", "spacer"].includes(value.type ?? ""))
            return true;
        return value.content?.some(visit) ?? false;
    });
    return document.content.some(visit);
}
/**
 * 以前の「問題色文書＋解答色文書」を、色属性を含む1文書へ統合する。
 * 既存データの解答色文書は末尾へ追加し、全ての可視ノードを解答色にする。
 *
 * @param problemDocument 問題色として扱う文書
 * @param answerDocument 解答色として扱う文書
 * @returns 色属性を統合した文書
 */
export function mergeColoredDocuments(problemDocument: BasicRichTextDocument, answerDocument: BasicRichTextDocument): BasicRichTextDocument {
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
/**
 * colorDocumentAsAnswerに必要な処理を実行する。
 *
 * @param document documentとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function colorDocumentAsAnswer(document: BasicRichTextDocument): BasicRichTextDocument {
    const cloned = structuredClone(document) as unknown as {
        type: "doc";
        content: unknown[];
    };
    cloned.content = cloned.content.map(colorNodeAsAnswer);
    return cloned as BasicRichTextDocument;
}
/**
 * colorNodeAsAnswerに必要な処理を実行する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function colorNodeAsAnswer(node: unknown): unknown {
    if (!node || typeof node !== "object")
        return node;
    const value = node as {
        type?: string;
        attrs?: Record<string, unknown>;
        marks?: Array<Record<string, unknown>>;
        content?: unknown[];
    };
    const next: typeof value = { ...value };
    if (value.type === "text") {
        const marks = [...(value.marks ?? [])];
        if (!marks.some((/**
         * 条件に一致する要素か判定する。
         *
         * @param mark markとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function hasMatchingItem6(mark) {
            return mark.type === "answerColor";
        })))
            marks.push({ type: "answerColor" });
        next.marks = marks;
    }
    else if (["inlineMath", "blockMath", "imageRef", "richTable"].includes(value.type ?? "")) {
        next.attrs = { ...value.attrs, answerColor: true };
    }
    if (Array.isArray(value.content))
        next.content = value.content.map(colorNodeAsAnswer);
    return next;
}
/**
 * nodeUsesAnswerColorに必要な処理を実行する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function nodeUsesAnswerColor(node: unknown): boolean {
    if (!node || typeof node !== "object")
        return false;
    const value = node as {
        attrs?: {
            answerColor?: unknown;
        };
        marks?: Array<{
            type?: string;
        }>;
    };
    return value.attrs?.answerColor === true || value.marks?.some((/**
     * 条件に一致する要素か判定する。
     *
     * @param mark markとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function hasMatchingItem7(mark) {
        return mark.type === "answerColor";
    })) === true;
}
