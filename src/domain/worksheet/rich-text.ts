import type { BasicRichTextDocument, RichTextDocument, RichTextNode } from "./worksheet";
type AnyDocument = BasicRichTextDocument | RichTextDocument;
export type ContentColor = "problem" | "answer";
/**
 * 文書・To・Plain・テキストをtrim・Endで処理し、その結果を呼び出し元へ反映する。
 *
 * @param document 処理対象のリッチテキスト文書
 * @returns 「」として得た文字列。変換できない場合は関数固有の既定値
 */
export function documentToPlainText(document: AnyDocument | null): string {
    if (!document)
        return "";
    const visit = (/**
     * 入れ子の文書・表・問題構造を再帰走査し、対象値を漏れなく収集または検証する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns Stringの結果として得た文字列。変換できない場合は関数固有の既定値
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
         * 各走査中の子ノードをvisitの結果へ変換する。
         *
         * @param child 走査中の子ノード
         * @returns visitの結果
         */
        function mapItem2(child: unknown) {
            return visit(child as never);
        })).join(separator);
    });
    return document.content.map((/**
     * 各ノードをvisitの結果へ変換する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns visitの結果
     */
    function mapItem3(node) {
        return visit(node as never);
    })).join("\n").trimEnd();
}
/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @param value plain・テキスト・To・文書で判定または変換する入力値
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
export function plainTextToDocument(value: string): BasicRichTextDocument {
    const lines = value.split(/\r?\n/u);
    return {
        type: "doc",
        content: lines.map((/**
         * 各正規化または検査する一行を作成または検証する要素種別・ノードへ設定する属性・処理対象の問題本文または解説を持つオブジェクトへ変換する。
         *
         * @param line 正規化または検査する一行
         * @returns 作成または検証する要素種別・ノードへ設定する属性・処理対象の問題本文または解説を持つオブジェクト
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
 * Visible・文書が仕様上の条件を満たすか判定する。
 *
 * @param document 処理対象のリッチテキスト文書
 * @returns この実装では常にfalse
 */
export function hasVisibleDocument(document: RichTextDocument | null): boolean {
    if (!document)
        return false;
    const visit = (/**
     * 入れ子の文書・表・問題構造を再帰走査し、対象値を漏れなく収集または検証する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns この実装では常にfalse
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
 * 色・文書・As・解答をstructured・Cloneで処理し、その結果を呼び出し元へ反映する。
 *
 * @param document 処理対象のリッチテキスト文書
 * @returns すべての可視ノードへ解答色を付与した文書の複製
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
 * 色・ノード・As・解答をsomeで処理し、その結果を呼び出し元へ反映する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns ノード
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
         * いずれかの処理対象の文字装飾が要求条件を満たすか判定する。
         *
         * @param mark 処理対象の文字装飾
         * @returns 処理対象の文字装飾の作成または検証する要素種別が「answerColor」と一致する場合はtrue
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
 * ノード・Uses・解答・色をsomeで処理し、その結果を呼び出し元へ反映する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns この実装では常にfalse
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
     * いずれかの処理対象の文字装飾が要求条件を満たすか判定する。
     *
     * @param mark 処理対象の文字装飾
     * @returns 処理対象の文字装飾の作成または検証する要素種別が「answerColor」と一致する場合はtrue
     */
    function hasMatchingItem7(mark) {
        return mark.type === "answerColor";
    })) === true;
}
