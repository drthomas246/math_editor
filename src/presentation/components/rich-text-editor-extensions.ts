import { Editor, Extension, Mark, mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { ContentColor } from "../../domain/worksheet/rich-text";
import type { BasicRichTextDocument, ImagePlacement, ImageWidthPercent, RichTextMark, TableCellRichTextDocument, TableRow } from "../../domain/worksheet/worksheet";
import { applyTableOperation, getTableCellLocation, getTableOperationAvailability, setTableColumnWidth, setTableRowHeight, type TableOperation, type TableOperationAvailability } from "../../domain/worksheet/table-operations";
import { getMathAriaLabel, renderMathMarkup } from "./MathFormula";

// --------------------
// 選択範囲と共通型
// --------------------

export type MathTextSize = "small" | "normal" | "large" | "xLarge";
/**
 * 数式・位置・選択を現在の編集結果へ反映する。
 *
 * @param editor 操作対象のTipTapエディタ
 * @param latex 描画または保存するLaTeX式
 * @param block 処理対象のリッチテキストブロック
 * @param textSize 数式または本文へ適用する文字サイズ
 * @param color 文字または数式へ適用する色
 */
export function insertMathAtSelection(editor: Editor, latex: string, block: boolean, textSize: MathTextSize, color: ContentColor = "problem"): void {
    const math = { type: block ? "blockMath" : "inlineMath", attrs: { latex, textSize, answerColor: color === "answer" } };
    const content = block
        ? math
        : [{ type: "text", text: " " }, math, { type: "text", text: " " }];
    editor.chain().focus().insertContent(content).run();
}
const COLORABLE_NODE_TYPES = new Set(["inlineMath", "blockMath", "imageRef", "richTable"]);
/**
 * 選択・内容・色を現在の編集結果へ反映する。
 *
 * @param editor 操作対象のTipTapエディタ
 * @param color 文字または数式へ適用する色
 */
export function setSelectionContentColor(editor: Editor, color: ContentColor): void {
    if (editor.isDestroyed)
        return;
    const { selection } = editor.state;
    let transaction = editor.state.tr;
    let changedNode = false;
    editor.state.doc.nodesBetween(selection.from, selection.to, (/**
     * ノードを走査し、数式・文字色・選択範囲の判定へ反映する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @param position 対象となる位置
     * @returns 条件成立を示すtrue
     */
    function nodesBetweenCallback1(node, position) {
        if (!COLORABLE_NODE_TYPES.has(node.type.name))
            return true;
        transaction = transaction.setNodeMarkup(position, undefined, { ...node.attrs, answerColor: color === "answer" });
        changedNode = true;
        return false;
    }));
    if (changedNode)
        editor.view.dispatch(transaction);
    const chain = editor.chain().focus();
    if (color === "answer")
        chain.setMark("answerColor").run();
    else
        chain.unsetMark("answerColor").run();
}
/**
 * 選択・内容・色を入力データまたは現在の状態から取り出す。
 *
 * @param editor 操作対象のTipTapエディタ
 * @returns 「answer」
 */
export function getSelectionContentColor(editor: Editor): ContentColor {
    if (editor.isActive("answerColor"))
        return "answer";
    const { selection } = editor.state;
    let answerNodeSelected = false;
    editor.state.doc.nodesBetween(selection.from, selection.to, (/**
     * ノードを走査し、数式・文字色・選択範囲の判定へ反映する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns 解答・ノード・Selectedが成立しないこと
     */
    function nodesBetweenCallback2(node) {
        if (COLORABLE_NODE_TYPES.has(node.type.name) && node.attrs.answerColor === true)
            answerNodeSelected = true;
        return !answerNodeSelected;
    }));
    return answerNodeSelected ? "answer" : "problem";
}
// --------------------
// 数式ノード
// --------------------

export type EditableMathRef = {
    editor: Editor;
    position: number;
    latex: string;
    textSize: MathTextSize;
    block: boolean;
};
type MathNodeOptions = {
    onEdit: ((math: EditableMathRef) => void) | null;
};
/**
 * 数式・テキスト・寸法が仕様上の条件を満たすか判定する。
 *
 * @param value is・数式・テキスト・寸法で判定または変換する入力値
 * @returns 変換・検証・保存の対象となる値が「small」と一致するまたは変換・検証・保存の対象となる値が「normal」と一致するまたは変換・検証・保存の対象となる値が「large」と一致するまたは変換・検証・保存の対象となる値が「xLarge」と一致する場合はtrue
 */
function isMathTextSize(value: unknown): value is MathTextSize {
    return value === "small" || value === "normal" || value === "large" || value === "xLarge";
}
/**
 * String・Attributeを入力データまたは現在の状態から取り出す。
 *
 * @param value read・String・Attributeで判定または変換する入力値
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function readStringAttribute(value: unknown): string {
    return typeof value === "string" ? value : "";
}
/**
 * 数式・ノード・Viewを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param block 処理対象のリッチテキストブロック
 * @param onEdit 編集開始を親へ通知する処理
 * @returns 呼び出し元が後で実行する関数
 */
function createMathNodeView(block: boolean, onEdit: MathNodeOptions["onEdit"]) {
    return (/**
     * 数式ノードの表示・選択・編集を管理するTipTapノードビューを作る。
     *
     * @param callbackInput 数式ノード、TipTapエディタ、ノード位置の取得関数
     * @returns DOM、選択処理、更新処理を持つノードビュー
     */
    function applyDeferredOperation3(callbackInput: {
        node: {
            type: {
                name: string;
            };
            attrs: Record<string, unknown>;
        };
        editor: Editor;
        getPos: () => number | undefined;
    }) {
        let { node, editor, getPos } = callbackInput;
        const dom = document.createElement(block ? "div" : "span");
        const render = (/**
         * domのclass・名前を値を埋め込んだ表示文字列へ更新する。
         *
         * @param attrs ノードへ設定する属性
         */
        function renderImplementation4(attrs: Record<string, unknown>) {
            const latex = readStringAttribute(attrs.latex);
            const textSize = isMathTextSize(attrs.textSize) ? attrs.textSize : "normal";
            dom.className = `math-node ${block ? "math-node-block" : "math-node-inline"} math-size-${textSize}${attrs.answerColor === true ? " answer-color" : ""}`;
            dom.dataset.mathNode = block ? "block" : "inline";
            dom.dataset.latex = latex;
            dom.contentEditable = "false";
            dom.setAttribute("role", "math");
            dom.setAttribute("aria-label", getMathAriaLabel(latex));
            const markup = renderMathMarkup(latex, block);
            if (markup)
                dom.innerHTML = markup;
            else
                dom.textContent = latex;
            if (onEdit) {
                const editButton = document.createElement("button");
                editButton.type = "button";
                editButton.className = "math-node-edit-button";
                editButton.textContent = "編集";
                editButton.setAttribute("aria-label", "数式を編集");
                editButton.addEventListener("click", (/**
                 * 数式ノードの位置と属性を取得し、編集ダイアログを開く。
                 *
                 * @param event 発生したイベント
                 */
                function handleDomEvent5(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const position = getPos();
                    if (typeof position !== "number")
                        return;
                    onEdit({ editor, position, latex, textSize, block });
                }));
                dom.append(editButton);
            }
        });
        render(node.attrs);
        return {
            dom,
            ignoreMutation: (/**
             * TipTapが再解析すべきDOM変更か、ノードビュー内部だけの変更かを判定する。
             *
             * @returns 条件成立を示すtrue
             */
            function ignoreMutationCallback6() {
                return true;
            }),
            selectNode: (/**
             * TipTapでノードが選択されたことをDOMの選択表示へ反映する。
             *
             * @returns addの結果
             */
            function selectNodeCallback7() {
                return dom.classList.add("math-node-selected");
            }),
            deselectNode: (/**
             * TipTapのノード選択解除をDOMの通常表示へ反映する。
             *
             * @returns removeの結果
             */
            function deselectNodeCallback8() {
                return dom.classList.remove("math-node-selected");
            }),
            update: (/**
             * ProseMirrorノードまたはアプリ状態の変更を既存DOMへ反映できるか判定し、可能な場合は更新する。
             *
             * @param nextNode 置換後に比較するProseMirrorノード
             * @returns 条件不成立を示すfalse
             */
            function updateCallback9(nextNode: typeof node) {
                if (nextNode.type.name !== node.type.name)
                    return false;
                node = nextNode;
                render(nextNode.attrs);
                return true;
            }),
            stopEvent: (/**
             * ノード内の編集操作をTipTap本体へ伝播させるべきか判定する。
             *
             * @param event 発生したイベント
             * @returns 二つの値を比較した結果
             */
            function stopEventCallback10(event: Event) {
                return event.target instanceof HTMLElement && Boolean(event.target.closest(".math-node-edit-button"));
            }),
        };
    });
}
export const InlineMath = Node.create<MathNodeOptions>({
    name: "inlineMath",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    /**
     * TipTap拡張へ既定の編集コールバックと表示設定を登録する。
     *
     * @returns 編集開始を親へ通知する処理を持つオブジェクト
     */
    addOptions() {
        return { onEdit: null };
    },
    /**
     * TipTapノードへ保存・復元に必要な寸法や色の属性を定義する。
     *
     * @returns 描画または保存するLaTeX式・数式または本文へ適用する文字サイズ・解答へ適用する文字色を持つオブジェクト
     */
    addAttributes() {
        return {
            latex: { default: "" },
            textSize: { default: "normal" },
            answerColor: { default: false },
        };
    },
    /**
     * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    parseHTML() {
        return [{ tag: '[data-math-node="inline"]' }];
    },
    /**
     * TipTapノードの属性を安全なHTML属性へ変換して出力する。
     *
     * @param callbackInput インライン数式へ出力するHTML属性
     * @returns TipTapがインライン数式を描画するためのDOM定義
     */
    renderHTML(callbackInput) {
        let { HTMLAttributes } = callbackInput;
        return ["span", mergeAttributes(HTMLAttributes, { "data-math-node": "inline" })];
    },
    /**
     * TipTapノードの編集状態とプレビュー状態を切り替えるDOMビューを作る。
     *
     * @returns create・数式・ノード・Viewの結果
     */
    addNodeView() {
        return createMathNodeView(false, this.options.onEdit);
    },
});
export const BlockMath = Node.create<MathNodeOptions>({
    name: "blockMath",
    group: "block",
    atom: true,
    selectable: true,
    /**
     * TipTap拡張へ既定の編集コールバックと表示設定を登録する。
     *
     * @returns 編集開始を親へ通知する処理を持つオブジェクト
     */
    addOptions() {
        return { onEdit: null };
    },
    /**
     * TipTapノードへ保存・復元に必要な寸法や色の属性を定義する。
     *
     * @returns 描画または保存するLaTeX式・数式または本文へ適用する文字サイズ・解答へ適用する文字色を持つオブジェクト
     */
    addAttributes() {
        return {
            latex: { default: "" },
            textSize: { default: "normal" },
            answerColor: { default: false },
        };
    },
    /**
     * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    parseHTML() {
        return [{ tag: '[data-math-node="block"]' }];
    },
    /**
     * TipTapノードの属性を安全なHTML属性へ変換して出力する。
     *
     * @param callbackInput ブロック数式へ出力するHTML属性
     * @returns TipTapがブロック数式を描画するためのDOM定義
     */
    renderHTML(callbackInput) {
        let { HTMLAttributes } = callbackInput;
        return ["div", mergeAttributes(HTMLAttributes, { "data-math-node": "block" })];
    },
    /**
     * TipTapノードの編集状態とプレビュー状態を切り替えるDOMビューを作る。
     *
     * @returns create・数式・ノード・Viewの結果
     */
    addNodeView() {
        return createMathNodeView(true, this.options.onEdit);
    },
});
// --------------------
// 画像ノード
// --------------------

type ImageRefOptions = {
    assetUrls: ReadonlyMap<string, string>;
    onEdit: ((image: EditableImageRef) => void) | null;
};
export type EditableImageRef = {
    id: string;
    assetId: string;
    alt: string;
    placement: ImagePlacement;
    widthPercent: ImageWidthPercent;
    answerColor?: boolean;
};
export const ImageRef = Node.create<ImageRefOptions>({
    name: "imageRef",
    group: "block",
    atom: true,
    selectable: true,
    /**
     * TipTap拡張へ既定の編集コールバックと表示設定を登録する。
     *
     * @returns アセット識別子と表示URLの対応表・編集開始を親へ通知する処理を持つオブジェクト
     */
    addOptions() {
        return { assetUrls: new Map(), onEdit: null };
    },
    /**
     * TipTapノードへ保存・復元に必要な寸法や色の属性を定義する。
     *
     * @returns 対象を一意に特定する識別子・アセット・Id・画像の代替テキスト・画像を本文の前後どちらへ置くかの指定・表全体に対する列幅の割合を持つオブジェクト
     */
    addAttributes() {
        return {
            id: { default: "" },
            assetId: { default: "" },
            alt: { default: "" },
            placement: { default: "block" },
            widthPercent: { default: 50 },
            answerColor: { default: false },
        };
    },
    /**
     * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    parseHTML() {
        return [{ tag: "[data-image-ref]" }];
    },
    /**
     * TipTapノードの属性を安全なHTML属性へ変換して出力する。
     *
     * @param callbackInput 画像参照へ出力するHTML属性
     * @returns TipTapが画像参照を描画するためのDOM定義
     */
    renderHTML(callbackInput) {
        let { HTMLAttributes } = callbackInput;
        return ["div", mergeAttributes(HTMLAttributes, { "data-image-ref": "" })];
    },
    /**
     * TipTapノードの編集状態とプレビュー状態を切り替えるDOMビューを作る。
     *
     * @returns 呼び出し元が後で実行する関数
     */
    addNodeView() {
        // 名前付きコールバックでもTipTap拡張の設定参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext11 = this;
        const assetUrls = this.options.assetUrls;
        return (/**
         * 画像参照ノードを表示し、画像編集操作を提供するノードビューを作る。
         *
         * @param callbackInput 表示する画像参照ノード
         * @returns DOM、選択処理、更新処理を持つ画像ノードビュー
         */
        function applyDeferredOperation12(callbackInput) {
            let { node } = callbackInput;
            const dom = document.createElement("div");
            const render = (/**
             * domのclass・名前を値を埋め込んだ表示文字列へ更新する。
             *
             * @param attrs ノードへ設定する属性
             */
            function renderImplementation13(attrs: Record<string, unknown>) {
                const id = readStringAttribute(attrs.id);
                const assetId = readStringAttribute(attrs.assetId);
                const placement = isImagePlacement(attrs.placement) ? attrs.placement : "block";
                const widthPercent = normalizeImageWidth(attrs.widthPercent, placement);
                const url = assetUrls.get(assetId);
                const answerColor = attrs.answerColor === true;
                dom.className = `editor-image-ref ${placement}${answerColor ? " answer-color" : ""}`;
                dom.dataset.imageRef = "";
                dom.dataset.imageId = id;
                dom.dataset.assetId = assetId;
                dom.style.width = `${widthPercent}%`;
                dom.title = instanceContext11.options.onEdit ? "画像を編集" : "";
                dom.contentEditable = "false";
                dom.replaceChildren();
                if (url) {
                    const image = document.createElement("img");
                    image.src = url;
                    image.alt = readStringAttribute(attrs.alt);
                    dom.append(image);
                }
                else {
                    const missing = document.createElement("span");
                    missing.className = "editor-missing-asset";
                    missing.textContent = "画像を読み込めません";
                    dom.append(missing);
                }
                if (instanceContext11.options.onEdit) {
                    const editButton = document.createElement("button");
                    editButton.type = "button";
                    editButton.className = "editor-image-edit-button";
                    editButton.textContent = "編集";
                    editButton.setAttribute("aria-label", "画像を編集");
                    editButton.addEventListener("click", (/**
                     * 現在の画像属性を親エディタへ渡し、画像編集ダイアログを開く。
                     *
                     * @param event 発生したイベント
                     */
                    function handleDomEvent14(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        instanceContext11.options.onEdit?.({
                            id,
                            assetId,
                            alt: readStringAttribute(attrs.alt),
                            placement,
                            widthPercent,
                            ...(answerColor ? { answerColor: true } : {}),
                        });
                    }));
                    dom.append(editButton);
                }
            });
            render(node.attrs);
            return {
                dom,
                ignoreMutation: (/**
                 * TipTapが再解析すべきDOM変更か、ノードビュー内部だけの変更かを判定する。
                 *
                 * @returns 条件成立を示すtrue
                 */
                function ignoreMutationCallback15() {
                    return true;
                }),
                selectNode: (/**
                 * TipTapでノードが選択されたことをDOMの選択表示へ反映する。
                 *
                 * @returns addの結果
                 */
                function selectNodeCallback16() {
                    return dom.classList.add("selected");
                }),
                deselectNode: (/**
                 * TipTapのノード選択解除をDOMの通常表示へ反映する。
                 *
                 * @returns removeの結果
                 */
                function deselectNodeCallback17() {
                    return dom.classList.remove("selected");
                }),
                update: (/**
                 * ProseMirrorノードまたはアプリ状態の変更を既存DOMへ反映できるか判定し、可能な場合は更新する。
                 *
                 * @param nextNode 置換後に比較するProseMirrorノード
                 * @returns 条件不成立を示すfalse
                 */
                function updateCallback18(nextNode) {
                    if (nextNode.type.name !== node.type.name)
                        return false;
                    node = nextNode;
                    render(nextNode.attrs);
                    return true;
                }),
                stopEvent: (/**
                 * ノード内の編集操作をTipTap本体へ伝播させるべきか判定する。
                 *
                 * @param event 発生したイベント
                 * @returns 二つの値を比較した結果
                 */
                function stopEventCallback19(event) {
                    return event.target instanceof HTMLElement && Boolean(event.target.closest(".editor-image-edit-button"));
                }),
            };
        });
    },
});
// --------------------
// 表ノードとセル編集
// --------------------

export type RichTableCellEditorController = {
    applyTableOperation: (operation: TableOperation) => boolean;
    deactivate: () => void;
    insertMath: (latex: string, textSize: MathTextSize, color: ContentColor) => void;
    isActive: (name: string) => boolean;
    setContentColor: (color: ContentColor) => void;
    setTextSize: (size: string) => void;
    tableOperationAvailability: TableOperationAvailability;
    tableSizing: {
        rowHeightMm: number | null;
        columnWidthPercent: number;
        canResizeColumn: boolean;
        setRowHeightMm: (heightMm: number | null) => boolean;
        setColumnWidthPercent: (widthPercent: number) => boolean;
    };
    toggleBold: () => void;
    toggleItalic: () => void;
    toggleUnderline: () => void;
};
type RichTableOptions = {
    assetUrls: ReadonlyMap<string, string>;
    onCellFocus: (controller: RichTableCellEditorController) => void;
    onCellStateChange: () => void;
    onEditMath: ((math: EditableMathRef) => void) | null;
};
export const RichTable = Node.create<RichTableOptions>({
    name: "richTable",
    group: "block",
    atom: true,
    selectable: true,
    /**
     * TipTap拡張へ既定の編集コールバックと表示設定を登録する。
     *
     * @returns アセット識別子と表示URLの対応表・on・セル・Focus・on・セル・状態・Change・on・Edit・数式を持つオブジェクト
     */
    addOptions() {
        return { assetUrls: new Map(), onCellFocus: (/**
             * セル・Focusの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
             */
            function onCellFocusCallback20() {
                return undefined;
            }), onCellStateChange: (/**
             * セル・状態・Changeの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
             */
            function onCellStateChangeCallback21() {
                return undefined;
            }), onEditMath: null };
    },
    /**
     * TipTapノードへ保存・復元に必要な寸法や色の属性を定義する。
     *
     * @returns 対象を一意に特定する識別子・作成または検証する表の行数・行一覧・列・Widths・Percent・ヘッダー・行・解答へ適用する文字色を持つオブジェクト
     */
    addAttributes() {
        return {
            id: { default: "" },
            rows: { default: [] },
            columnWidthsPercent: { default: [] },
            headerRow: { default: false },
            answerColor: { default: false },
        };
    },
    /**
     * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    parseHTML() {
        return [{ tag: "[data-rich-table]" }];
    },
    /**
     * TipTapノードの属性を安全なHTML属性へ変換して出力する。
     *
     * @param callbackInput リッチ表へ出力するHTML属性
     * @returns TipTapがリッチ表を描画するためのDOM定義
     */
    renderHTML(callbackInput) {
        let { HTMLAttributes } = callbackInput;
        return ["div", mergeAttributes(HTMLAttributes, { "data-rich-table": "" })];
    },
    /**
     * TipTapノードの編集状態とプレビュー状態を切り替えるDOMビューを作る。
     *
     * @returns 呼び出し元が後で実行する関数
     */
    addNodeView() {
        // 名前付きコールバックでもTipTap拡張の設定参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext22 = this;
        return (/**
         * リッチ表のセル選択・編集・サイズ変更を管理するノードビューを作る。
         *
         * @param callbackInput 表ノード、外側のTipTapエディタ、ノード位置の取得関数
         * @returns DOM、セル編集、選択処理、更新処理を持つ表ノードビュー
         */
        function applyDeferredOperation23(callbackInput) {
            let { node, editor: outerEditor, getPos } = callbackInput;
            const dom = document.createElement("div");
            const cellElements = new Map<string, HTMLTableCellElement>();
            let activeCellId: string | null = null;
            let cellEditor: Editor | null = null;
            let structureKey = "";
            const findCell = (/**
             * 処理対象の表セル・表内での行位置・行内でのセル位置を持つオブジェクトを一つの結果へまとめる。
             *
             * @param cellId 対象を識別するID
             * @returns 処理対象の表セル・表内での行位置・行内でのセル位置を持つオブジェクト
             */
            function findCellImplementation24(cellId: string) {
                const rows = Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [];
                const columnWidthsPercent = Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [];
                for (const [rowIndex, row] of rows.entries()) {
                    const cellIndex = row.cells.findIndex((/**
                     * 各処理対象の表セルが探している位置の要素か判定する。
                     *
                     * @param cell 処理対象の表セル
                     * @returns 処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する場合はtrue
                     */
                    function findItemIndex25(cell) {
                        return cell.id === cellId;
                    }));
                    if (cellIndex >= 0) {
                        const logical = getTableCellLocation({ rows, columnWidthsPercent }, cellId);
                        return { cell: row.cells[cellIndex]!, rowIndex, cellIndex: logical?.column ?? cellIndex };
                    }
                }
                return null;
            });
            const updateCellDocument = (/**
             * 処理対象の表セルの処理対象のリッチテキスト文書を表セルへ設定するリッチテキスト文書へ更新する。
             *
             * @param cellId 対象を識別するID
             * @param documentValue 表セルへ設定するリッチテキスト文書
             */
            function updateCellDocumentImplementation26(cellId: string, documentValue: TableCellRichTextDocument) {
                const position = getPos();
                if (typeof position !== "number")
                    return;
                const nextRows = structuredClone(Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : []);
                for (const row of nextRows) {
                    const cell = row.cells.find((/**
                     * 要素の対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
                     *
                     * @param item 配列処理で現在参照している要素
                     * @returns 要素の対象を一意に特定する識別子がセル・Idと一致する場合はtrue
                     */
                    function findItem27(item) {
                        return item.id === cellId;
                    }));
                    if (!cell)
                        continue;
                    cell.document = documentValue;
                    outerEditor.view.dispatch(outerEditor.view.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, rows: nextRows }));
                    return;
                }
            });
            const showCellPreview = (/**
             * show・セル・プレビューをfind・セルで処理し、その結果を呼び出し元へ反映する。
             *
             * @param cellId 対象を識別するID
             */
            function showCellPreviewImplementation28(cellId: string) {
                const location = findCell(cellId);
                const tableCell = cellElements.get(cellId);
                if (!location || !tableCell)
                    return;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "table-cell-select editor-table-cell-select";
                button.setAttribute("aria-label", `${location.rowIndex + 1}行${location.cellIndex + 1}列を編集`);
                renderTableCellDocumentPreview(button, location.cell.document, instanceContext22.options.assetUrls);
                button.addEventListener("click", (/**
                 * クリックした表セルを編集状態へ切り替える。
                 *
                 */
                function handleDomEvent29() {
                    return activateCell(cellId);
                }));
                tableCell.classList.remove("active");
                tableCell.replaceChildren(button);
            });
            const deactivateCell = (/**
             * deactivate・セルをdestroyで処理し、その結果を呼び出し元へ反映する。
             */
            function deactivateCellImplementation30() {
                const previousCellId = activeCellId;
                activeCellId = null;
                cellEditor?.destroy();
                cellEditor = null;
                if (previousCellId)
                    showCellPreview(previousCellId);
            });
            const activateCell = (/**
             * activate・セルをfocusで処理し、その結果を呼び出し元へ反映する。
             *
             * @param cellId 対象を識別するID
             */
            function activateCellImplementation31(cellId: string) {
                if (activeCellId === cellId && cellEditor) {
                    cellEditor.commands.focus();
                    return;
                }
                deactivateCell();
                const location = findCell(cellId);
                const tableCell = cellElements.get(cellId);
                if (!location || !tableCell)
                    return;
                activeCellId = cellId;
                tableCell.classList.add("active");
                const editorMount = document.createElement("div");
                editorMount.className = "table-cell-wysiwyg-mount";
                tableCell.replaceChildren(editorMount);
                const nestedEditor = new Editor({
                    element: editorMount,
                    extensions: [
                        StarterKit.configure({
                            blockquote: false,
                            code: false,
                            codeBlock: false,
                            heading: false,
                            horizontalRule: false,
                            link: false,
                            strike: false,
                            bulletList: false,
                            orderedList: false,
                            listItem: false,
                        }),
                        ParagraphTextAlign,
                        TextSize,
                        AnswerColor,
                        InlineMath.configure({ onEdit: instanceContext22.options.onEditMath }),
                        ImageRef.configure({ assetUrls: instanceContext22.options.assetUrls }),
                    ],
                    content: normalizeTableCellEditorDocument(location.cell.document as JSONContent) as unknown as JSONContent,
                    editorProps: {
                        attributes: {
                            class: "rich-editor-content table-cell-wysiwyg-content",
                            "aria-label": `${location.rowIndex + 1}行${location.cellIndex + 1}列`,
                        },
                    },
                    onUpdate: (/**
                     * セルエディタの変更を正規化し、外側の表ノードへ反映する。
                     *
                     * @param callbackInput 更新されたセル用TipTapエディタ
                     */
                    function onUpdateCallback32(callbackInput) {
                        let { editor: currentEditor } = callbackInput;
                        updateCellDocument(cellId, normalizeTableCellEditorDocument(currentEditor.getJSON()));
                    }),
                    onSelectionUpdate: (/**
                     * 選択・更新の通知内容を、対応する編集状態・DOM・永続処理へ反映する。
                     *
                     * @returns on・セル・状態・Changeの結果
                     */
                    function onSelectionUpdateCallback33() {
                        return instanceContext22.options.onCellStateChange();
                    }),
                    onTransaction: (/**
                     * Transactionの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
                     *
                     * @returns on・セル・状態・Changeの結果
                     */
                    function onTransactionCallback34() {
                        return instanceContext22.options.onCellStateChange();
                    }),
                });
                cellEditor = nestedEditor;
                const currentTable = {
                    rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                    columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
                };
                const currentLocation = getTableCellLocation(currentTable, cellId);
                const commitTableData = (/**
                 * commit・表・データを現在の編集結果へ反映する。
                 *
                 * @param nextTable 編集操作を適用した後の表
                 * @returns 条件不成立を示すfalse
                 */
                function commitTableDataImplementation35(nextTable: {
                    rows: TableRow[];
                    columnWidthsPercent: number[];
                } | null) {
                    const position = getPos();
                    if (typeof position !== "number" || !nextTable)
                        return false;
                    deactivateCell();
                    outerEditor.view.dispatch(outerEditor.view.state.tr.setNodeMarkup(position, undefined, {
                        ...node.attrs,
                        rows: nextTable.rows,
                        columnWidthsPercent: nextTable.columnWidthsPercent,
                    }));
                    return true;
                });
                const controller: RichTableCellEditorController = {
                    applyTableOperation: (/**
                     * 表・操作を現在の編集結果へ反映する。
                     *
                     * @param operation 計測または適用する操作
                     * @returns commit・表・データの結果
                     */
                    function applyTableOperationCallback36(operation) {
                        const latestTable = {
                            rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                            columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
                        };
                        const result = applyTableOperation(latestTable, cellId, operation);
                        return commitTableData(result);
                    }),
                    deactivate: (/**
                     * deactivateをdeactivate・セルで処理し、その結果を呼び出し元へ反映する。
                     */
                    function deactivateCallback37() {
                        if (activeCellId === cellId)
                            deactivateCell();
                    }),
                    insertMath: (/**
                     * 数式を現在の編集結果へ反映する。
                     *
                     * @param latex 描画または保存するLaTeX式
                     * @param textSize 数式または本文へ適用する文字サイズ
                     * @param color 文字または数式へ適用する色
                     */
                    function insertMathCallback38(latex, textSize, color) {
                        if (!nestedEditor.isDestroyed)
                            insertMathAtSelection(nestedEditor, latex, false, textSize, color);
                    }),
                    isActive: (/**
                     * nested・エディタのis・Destroyedが存在しないかつis・有効状態の結果が真になるかを判定する。
                     *
                     * @param name 生成物または計測項目を識別する名前
                     * @returns nested・エディタのis・Destroyedが存在しないかつis・有効状態の結果が真になる場合はtrue
                     */
                    function isActiveCallback39(name) {
                        return !nestedEditor.isDestroyed && nestedEditor.isActive(name);
                    }),
                    setContentColor: (/**
                     * 内容・色を現在の編集結果へ反映する。
                     *
                     * @param color 文字または数式へ適用する色
                     */
                    function setContentColorCallback40(color) {
                        if (nestedEditor.isDestroyed)
                            return;
                        const chain = nestedEditor.chain().focus();
                        if (color === "answer")
                            chain.setMark("answerColor").run();
                        else
                            chain.unsetMark("answerColor").run();
                    }),
                    setTextSize: (/**
                     * テキスト・寸法を現在の編集結果へ反映する。
                     *
                     * @param size 適用または検証する寸法
                     */
                    function setTextSizeCallback41(size) {
                        if (nestedEditor.isDestroyed)
                            return;
                        if (size === "normal")
                            nestedEditor.chain().focus().unsetMark("textSize").run();
                        else
                            nestedEditor.chain().focus().setMark("textSize", { size }).run();
                    }),
                    tableOperationAvailability: getTableOperationAvailability(currentTable, cellId),
                    tableSizing: {
                        rowHeightMm: currentLocation ? currentTable.rows[currentLocation.row]?.heightMm ?? null : null,
                        columnWidthPercent: currentLocation ? currentTable.columnWidthsPercent[currentLocation.column] ?? 100 : 100,
                        canResizeColumn: currentTable.columnWidthsPercent.length > 1,
                        setRowHeightMm: (/**
                         * 行・高さ・Mmを現在の編集結果へ反映する。
                         *
                         * @param heightMm ミリメートル単位の高さ
                         * @returns 条件に応じて選択した値
                         */
                        function setRowHeightMmCallback42(heightMm) {
                            const latestTable = {
                                rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                                columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
                            };
                            const latestLocation = getTableCellLocation(latestTable, cellId);
                            return latestLocation ? commitTableData(setTableRowHeight(latestTable, latestLocation.row, heightMm)) : false;
                        }),
                        setColumnWidthPercent: (/**
                         * 列・幅・Percentを現在の編集結果へ反映する。
                         *
                         * @param widthPercent 表全体に対する列幅の割合
                         * @returns 条件に応じて選択した値
                         */
                        function setColumnWidthPercentCallback43(widthPercent) {
                            const latestTable = {
                                rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                                columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
                            };
                            const latestLocation = getTableCellLocation(latestTable, cellId);
                            return latestLocation ? commitTableData(setTableColumnWidth(latestTable, latestLocation.column, widthPercent)) : false;
                        }),
                    },
                    toggleBold: (/**
                     * Boldをrunで処理し、その結果を呼び出し元へ反映する。
                     */
                    function toggleBoldCallback44() { if (!nestedEditor.isDestroyed)
                        nestedEditor.chain().focus().toggleBold().run(); }),
                    toggleItalic: (/**
                     * Italicをrunで処理し、その結果を呼び出し元へ反映する。
                     */
                    function toggleItalicCallback45() { if (!nestedEditor.isDestroyed)
                        nestedEditor.chain().focus().toggleItalic().run(); }),
                    toggleUnderline: (/**
                     * Underlineをrunで処理し、その結果を呼び出し元へ反映する。
                     */
                    function toggleUnderlineCallback46() { if (!nestedEditor.isDestroyed)
                        nestedEditor.chain().focus().toggleUnderline().run(); }),
                };
                nestedEditor.on("focus", (/**
                 * onの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
                 *
                 * @returns on・セル・Focusの結果
                 */
                function onCallback47() {
                    return instanceContext22.options.onCellFocus(controller);
                }));
                instanceContext22.options.onCellFocus(controller);
                nestedEditor.commands.focus("end");
            });
            const render = (/**
             * セル・エディタを対象が存在しないことを示すnullへ更新する。
             *
             * @param attrs ノードへ設定する属性
             */
            function renderImplementation48(attrs: Record<string, unknown>) {
                cellEditor?.destroy();
                cellEditor = null;
                activeCellId = null;
                const rows = Array.isArray(attrs.rows) ? attrs.rows as TableRow[] : [];
                const widths = Array.isArray(attrs.columnWidthsPercent) ? attrs.columnWidthsPercent : [];
                const table = document.createElement("table");
                const columnGroup = document.createElement("colgroup");
                const body = document.createElement("tbody");
                dom.className = `editor-rich-table${attrs.answerColor === true ? " answer-color" : ""}`;
                dom.dataset.richTable = "";
                dom.contentEditable = "false";
                dom.replaceChildren();
                cellElements.clear();
                structureKey = getTableStructureKey(attrs);
                for (const widthValue of widths) {
                    const column = document.createElement("col");
                    const width = Number(widthValue);
                    if (Number.isFinite(width) && width > 0)
                        column.style.width = `${width}%`;
                    columnGroup.append(column);
                }
                for (const [rowIndex, row] of rows.entries()) {
                    const tableRow = document.createElement("tr");
                    if (row.heightMm)
                        tableRow.style.height = `${row.heightMm}mm`;
                    for (const cell of row.cells) {
                        const tableCell = document.createElement(rowIndex === 0 && attrs.headerRow ? "th" : "td");
                        tableCell.rowSpan = cell.rowSpan;
                        tableCell.colSpan = cell.columnSpan;
                        cellElements.set(cell.id, tableCell);
                        tableRow.append(tableCell);
                    }
                    body.append(tableRow);
                }
                table.append(columnGroup);
                table.append(body);
                dom.append(table);
                for (const row of rows)
                    for (const cell of row.cells)
                        showCellPreview(cell.id);
            });
            render(node.attrs);
            return {
                dom,
                ignoreMutation: (/**
                 * TipTapが再解析すべきDOM変更か、ノードビュー内部だけの変更かを判定する。
                 *
                 * @returns 条件成立を示すtrue
                 */
                function ignoreMutationCallback49() {
                    return true;
                }),
                selectNode: (/**
                 * TipTapでノードが選択されたことをDOMの選択表示へ反映する。
                 *
                 * @returns addの結果
                 */
                function selectNodeCallback50() {
                    return dom.classList.add("selected");
                }),
                deselectNode: (/**
                 * TipTapのノード選択解除をDOMの通常表示へ反映する。
                 *
                 * @returns removeの結果
                 */
                function deselectNodeCallback51() {
                    return dom.classList.remove("selected");
                }),
                update: (/**
                 * ProseMirrorノードまたはアプリ状態の変更を既存DOMへ反映できるか判定し、可能な場合は更新する。
                 *
                 * @param nextNode 置換後に比較するProseMirrorノード
                 * @returns 条件不成立を示すfalse
                 */
                function updateCallback52(nextNode) {
                    if (nextNode.type.name !== node.type.name)
                        return false;
                    if (getTableStructureKey(nextNode.attrs) !== structureKey)
                        return false;
                    node = nextNode;
                    const rows = Array.isArray(nextNode.attrs.rows) ? nextNode.attrs.rows as TableRow[] : [];
                    for (const row of rows) {
                        for (const cell of row.cells) {
                            if (cell.id !== activeCellId)
                                showCellPreview(cell.id);
                            else if (cellEditor && !cellEditor.isFocused) {
                                const nextDocument = normalizeTableCellEditorDocument(cell.document as JSONContent);
                                const currentDocument = normalizeTableCellEditorDocument(cellEditor.getJSON());
                                if (JSON.stringify(nextDocument) !== JSON.stringify(currentDocument)) {
                                    cellEditor.commands.setContent(nextDocument as unknown as JSONContent, { emitUpdate: false });
                                }
                            }
                        }
                    }
                    return true;
                }),
                stopEvent: (/**
                 * ノード内の編集操作をTipTap本体へ伝播させるべきか判定する。
                 *
                 * @param event 発生したイベント
                 * @returns 二つの値を比較した結果
                 */
                function stopEventCallback53(event) {
                    return event.target instanceof globalThis.Node && dom.contains(event.target);
                }),
                destroy: (/**
                 * ノードビューが登録したエディタ・DOM・イベント購読を破棄する。
                 *
                 * @returns destroyの結果
                 */
                function destroyCallback54() {
                    return cellEditor?.destroy();
                }),
            };
        });
    },
});
// --------------------
// 表セルプレビュー
// --------------------

/**
 * 表・セル・文書・プレビューの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param container イベント境界または表示領域となる要素
 * @param documentValue 表セルへ設定するリッチテキスト文書
 * @param assetUrls アセット識別子と表示URLの対応表
 */
function renderTableCellDocumentPreview(container: HTMLElement, documentValue: TableCellRichTextDocument, assetUrls: ReadonlyMap<string, string>): void {
    container.replaceChildren();
    const visible = documentValue.content.some((/**
     * いずれかのノードが要求条件を満たすか判定する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns ノードの作成または検証する要素種別が「imageRef」と一致するまたはノードの処理対象の問題本文または解説のlengthが0より大きい場合はtrue
     */
    function hasMatchingItem55(node) {
        return node.type === "imageRef" || node.content.length > 0;
    }));
    if (!visible) {
        const empty = document.createElement("span");
        empty.className = "table-cell-empty";
        empty.textContent = "空のセル";
        container.append(empty);
        return;
    }
    for (const block of documentValue.content) {
        if (block.type === "imageRef") {
            const url = assetUrls.get(block.attrs.assetId);
            if (url) {
                const image = document.createElement("img");
                image.className = `editor-table-cell-image ${block.attrs.placement}${block.attrs.answerColor ? " answer-color" : ""}`;
                image.src = url;
                image.alt = block.attrs.alt;
                image.style.width = `${block.attrs.widthPercent}%`;
                container.append(image);
            }
            else {
                const missing = document.createElement("span");
                missing.className = "editor-missing-asset";
                missing.textContent = "画像を読み込めません";
                container.append(missing);
            }
            continue;
        }
        const paragraph = document.createElement("span");
        paragraph.className = "table-cell-preview-paragraph";
        paragraph.style.textAlign = block.attrs.textAlign;
        for (const inline of block.content) {
            if (inline.type === "hardBreak") {
                paragraph.append(document.createElement("br"));
            }
            else if (inline.type === "inlineMath") {
                const math = document.createElement("span");
                math.className = `math-formula math-formula-inline math-size-${inline.attrs.textSize}${inline.attrs.answerColor ? " answer-color" : ""}`;
                math.dataset.latex = inline.attrs.latex;
                math.setAttribute("role", "math");
                math.setAttribute("aria-label", getMathAriaLabel(inline.attrs.latex));
                const markup = renderMathMarkup(inline.attrs.latex, false);
                if (markup)
                    math.innerHTML = markup;
                else
                    math.textContent = inline.attrs.latex;
                paragraph.append(math);
            }
            else {
                let rendered: globalThis.Node = document.createTextNode(inline.text);
                for (const mark of inline.marks ?? []) {
                    const wrapper = document.createElement(mark.type === "bold" ? "strong" : mark.type === "underline" ? "u" : mark.type === "italic" ? "em" : "span");
                    if (mark.type === "textSize")
                        wrapper.className = `text-size-${mark.attrs.size}`;
                    if (mark.type === "answerColor")
                        wrapper.className = "answer-color";
                    wrapper.append(rendered);
                    rendered = wrapper;
                }
                paragraph.append(rendered);
            }
        }
        container.append(paragraph);
    }
}
/**
 * 表・Structure・キーを入力データまたは現在の状態から取り出す。
 *
 * @param attrs ノードへ設定する属性
 * @returns JSON文字列として得た文字列。変換できない場合は関数固有の既定値
 */
function getTableStructureKey(attrs: Record<string, unknown>): string {
    const rows = Array.isArray(attrs.rows) ? attrs.rows as TableRow[] : [];
    const widths = Array.isArray(attrs.columnWidthsPercent) ? attrs.columnWidthsPercent : [];
    return JSON.stringify({
        headerRow: Boolean(attrs.headerRow),
        answerColor: Boolean(attrs.answerColor),
        widths,
        rows: rows.map((/**
         * 各処理対象の表の行を対象を一意に特定する識別子・ミリメートル単位の高さ・cellsを持つオブジェクトへ変換する。
         *
         * @param row 処理対象の表の行
         * @returns 対象を一意に特定する識別子・ミリメートル単位の高さ・cellsを持つオブジェクト
         */
        function mapItem56(row) {
            return ({
                id: row.id,
                heightMm: row.heightMm ?? null,
                cells: row.cells.map((/**
                 * 各処理対象の表セルを対象を一意に特定する識別子・行・Span・列・Spanを持つオブジェクトへ変換する。
                 *
                 * @param cell 処理対象の表セル
                 * @returns 対象を一意に特定する識別子・行・Span・列・Spanを持つオブジェクト
                 */
                function mapItem57(cell) {
                    return ({ id: cell.id, rowSpan: cell.rowSpan, columnSpan: cell.columnSpan });
                })),
            });
        })),
    });
}
// --------------------
// 段落と文字装飾
// --------------------

export const ParagraphTextAlign = Extension.create({
    name: "worksheetParagraphTextAlign",
    /**
     * Global・Attributesを現在の編集結果へ反映する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    addGlobalAttributes() {
        return [{
                types: ["paragraph"],
                attributes: {
                    textAlign: {
                        default: "left",
                        parseHTML: (/**
                         * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
                         *
                         * @param element 走査または監視の対象となる要素
                         * @returns 二つの値を比較した結果
                         */
                        function parseHTMLCallback58(element) {
                            return element.style.textAlign || "left";
                        }),
                        renderHTML: (/**
                         * TipTapノードの属性を安全なHTML属性へ変換して出力する。
                         *
                         * @param attributes DOMへ出力する属性
                         * @returns 表示対象へ適用する見た目の設定を持つオブジェクト
                         */
                        function renderHTMLCallback59(attributes) {
                            return ({ style: `text-align: ${String(attributes.textAlign ?? "left")}` });
                        }),
                    },
                },
            }];
    },
});
export const TextSize = Mark.create({
    name: "textSize",
    /**
     * TipTapノードへ保存・復元に必要な寸法や色の属性を定義する。
     *
     * @returns 適用または検証する寸法を持つオブジェクト
     */
    addAttributes() {
        return {
            size: {
                default: "large",
                parseHTML: (/**
                 * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
                 *
                 * @param element 走査または監視の対象となる要素
                 * @returns 二つの値を比較した結果
                 */
                function parseHTMLCallback60(element) {
                    return element.getAttribute("data-text-size") ?? "large";
                }),
            },
        };
    },
    /**
     * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    parseHTML() {
        return [{ tag: "span[data-text-size]" }];
    },
    /**
     * TipTapノードの属性を安全なHTML属性へ変換して出力する。
     *
     * @param callbackInput 文字サイズマークへ出力するHTML属性
     * @returns 文字サイズ用のdata属性とCSSクラスを持つDOM定義
     */
    renderHTML(callbackInput) {
        let { HTMLAttributes } = callbackInput;
        return ["span", mergeAttributes(HTMLAttributes, {
                "data-text-size": HTMLAttributes.size,
                class: `text-size-${String(HTMLAttributes.size)}`,
            }), 0];
    },
});
export const AnswerColor = Mark.create({
    name: "answerColor",
    /**
     * DOM属性を検証し、TipTapノードが保持する型付き属性へ復元する。
     *
     * @returns 後続処理が順番に扱う結果の配列
     */
    parseHTML() {
        return [{ tag: "span[data-answer-color]" }];
    },
    /**
     * TipTapノードの属性を安全なHTML属性へ変換して出力する。
     *
     * @param callbackInput 解答色マークへ出力するHTML属性
     * @returns 解答色用のdata属性とCSSクラスを持つDOM定義
     */
    renderHTML(callbackInput) {
        let { HTMLAttributes } = callbackInput;
        return ["span", mergeAttributes(HTMLAttributes, {
                "data-answer-color": "true",
                class: "answer-color",
            }), 0];
    },
});
// --------------------
// 文書正規化
// --------------------

/**
 * ProseMirrorの文字装飾から、保存スキーマが許可する種類と属性だけを重複なく取り出す。
 *
 * @param marks リッチテキストへ適用する文字装飾一覧
 * @returns 保存可能な文字装飾一覧。装飾がない場合はundefined
 */
function normalizeMarks(marks: JSONContent["marks"]): RichTextMark[] | undefined {
    if (!marks)
        return undefined;
    const normalized: RichTextMark[] = [];
    const seen = new Set<string>();
    for (const mark of marks) {
        if (seen.has(mark.type))
            continue;
        if (mark.type === "bold" || mark.type === "underline" || mark.type === "italic" || mark.type === "answerColor") {
            normalized.push({ type: mark.type });
            seen.add(mark.type);
        }
        else if (mark.type === "textSize") {
            const size = mark.attrs?.size;
            if (size === "small" || size === "large" || size === "xLarge") {
                normalized.push({ type: "textSize", attrs: { size } });
                seen.add(mark.type);
            }
        }
    }
    return normalized.length ? normalized : undefined;
}
/**
 * 種別・文書または画面へ設定する文字列・値を持つオブジェクトを一つの結果へまとめる。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns 作成または検証する要素種別・文書または画面へ設定する文字列・値を持つオブジェクトとして得た文字列。変換できない場合は関数固有の既定値
 */
function normalizeInlineNode(node: JSONContent): Record<string, unknown> | null {
    if (node.type === "text" && typeof node.text === "string" && node.text.length > 0) {
        const marks = normalizeMarks(node.marks);
        return { type: "text", text: node.text, ...(marks ? { marks } : {}) };
    }
    if (node.type === "hardBreak")
        return { type: "hardBreak" };
    if (node.type === "inlineMath") {
        const latex = String(node.attrs?.latex ?? "");
        if (!latex.trim())
            return null;
        const textSize = isMathTextSize(node.attrs?.textSize) ? node.attrs.textSize : "normal";
        return { type: "inlineMath", attrs: { latex, textSize, ...(node.attrs?.answerColor === true ? { answerColor: true } : {}) } };
    }
    return null;
}
/**
 * 種別・属性・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns 作成または検証する要素種別・ノードへ設定する属性・処理対象の問題本文または解説を持つオブジェクトとして得た文字列。変換できない場合は関数固有の既定値
 */
function normalizeParagraph(node: JSONContent): Record<string, unknown> {
    const textAlign = ["left", "center", "right"].includes(String(node.attrs?.textAlign))
        ? String(node.attrs?.textAlign)
        : "left";
    const content = (node.content ?? []).map(normalizeInlineNode).filter((/**
     * 要素がnullと異なる要素だけを後続処理へ残す。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素がnullと異なる場合はtrue
     */
    function filterItem61(item) {
        return item !== null;
    }));
    return { type: "paragraph", attrs: { textAlign }, content };
}
/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクトとして得た文字列。変換できない場合は関数固有の既定値
 */
function normalizeListItem(node: JSONContent): Record<string, unknown> {
    const content = (node.content ?? [])
        .filter((/**
     * 走査中の子ノードの作成または検証する要素種別が「paragraph」と一致する要素だけを後続処理へ残す。
     *
     * @param child 走査中の子ノード
     * @returns 走査中の子ノードの作成または検証する要素種別が「paragraph」と一致する場合はtrue
     */
    function filterItem62(child) {
        return child.type === "paragraph";
    }))
        .map(normalizeParagraph);
    return {
        type: "listItem",
        content: content.length ? content : [normalizeParagraph({ type: "paragraph" })],
    };
}
/**
 * ブロック・ノードを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns normalize・Paragraphの結果として得た文字列。変換できない場合は関数固有の既定値
 */
function normalizeBlockNode(node: JSONContent): Record<string, unknown> | null {
    if (node.type === "paragraph")
        return normalizeParagraph(node);
    if (node.type === "bulletList" || node.type === "orderedList") {
        const content = (node.content ?? [])
            .filter((/**
         * 走査中の子ノードの作成または検証する要素種別が「listItem」と一致する要素だけを後続処理へ残す。
         *
         * @param child 走査中の子ノード
         * @returns 走査中の子ノードの作成または検証する要素種別が「listItem」と一致する場合はtrue
         */
        function filterItem63(child) {
            return child.type === "listItem";
        }))
            .map(normalizeListItem);
        if (!content.length)
            return null;
        if (node.type === "orderedList") {
            const rawStart = Number(node.attrs?.start);
            return { type: "orderedList", attrs: { start: Number.isInteger(rawStart) && rawStart > 0 ? rawStart : 1 }, content };
        }
        return { type: "bulletList", content };
    }
    if (node.type === "blockMath") {
        const latex = String(node.attrs?.latex ?? "");
        if (!latex.trim())
            return null;
        const textSize = isMathTextSize(node.attrs?.textSize) ? node.attrs.textSize : "normal";
        return { type: "blockMath", attrs: { latex, textSize, ...(node.attrs?.answerColor === true ? { answerColor: true } : {}) } };
    }
    if (node.type === "imageRef") {
        const id = String(node.attrs?.id ?? "");
        const assetId = String(node.attrs?.assetId ?? "");
        if (!id || !assetId)
            return null;
        const placement = isImagePlacement(node.attrs?.placement) ? node.attrs.placement : "block";
        return {
            type: "imageRef",
            attrs: {
                id,
                assetId,
                alt: String(node.attrs?.alt ?? ""),
                placement,
                widthPercent: normalizeImageWidth(node.attrs?.widthPercent, placement),
                ...(node.attrs?.answerColor === true ? { answerColor: true } : {}),
            },
        };
    }
    if (node.type === "richTable") {
        const id = String(node.attrs?.id ?? "");
        const rows = node.attrs?.rows;
        const columnWidthsPercent = node.attrs?.columnWidthsPercent;
        if (!id || !Array.isArray(rows) || !Array.isArray(columnWidthsPercent))
            return null;
        return {
            type: "richTable",
            attrs: {
                id,
                rows,
                columnWidthsPercent,
                headerRow: Boolean(node.attrs?.headerRow),
                ...(node.attrs?.answerColor === true ? { answerColor: true } : {}),
            },
        };
    }
    return null;
}
/**
 * 画像・配置が仕様上の条件を満たすか判定する。
 *
 * @param value is・画像・配置で判定または変換する入力値
 * @returns 変換・検証・保存の対象となる値が「block」と一致するまたは変換・検証・保存の対象となる値が「floatLeft」と一致するまたは変換・検証・保存の対象となる値が「floatRight」と一致する場合はtrue
 */
function isImagePlacement(value: unknown): value is "block" | "floatLeft" | "floatRight" {
    return value === "block" || value === "floatLeft" || value === "floatRight";
}
/**
 * 画像・幅を比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value normalize・画像・幅で判定または変換する入力値
 * @param placement 画像を本文の前後どちらへ置くかの指定
 * @returns 条件に応じて選択した値
 */
function normalizeImageWidth(value: unknown, placement: "block" | "floatLeft" | "floatRight"): 25 | 33 | 50 | 66 | 75 | 100 {
    const allowed = placement === "block" ? [25, 33, 50, 66, 75, 100] : [25, 33, 50];
    const width = Number(value);
    return (allowed.includes(width) ? width : 50) as 25 | 33 | 50 | 66 | 75 | 100;
}
/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @param document 処理対象のリッチテキスト文書
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
export function normalizeEditorDocument(document: JSONContent): BasicRichTextDocument {
    const content = (document.content ?? []).map(normalizeBlockNode).filter((/**
     * 要素がnullと異なる要素だけを後続処理へ残す。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素がnullと異なる場合はtrue
     */
    function filterItem64(item) {
        return item !== null;
    }));
    return {
        type: "doc",
        content: (content.length ? content : [normalizeParagraph({ type: "paragraph" })]) as BasicRichTextDocument["content"],
    };
}
/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @param document 処理対象のリッチテキスト文書
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
export function normalizeTableCellEditorDocument(document: JSONContent): TableCellRichTextDocument {
    const normalized = normalizeEditorDocument(document);
    const content = normalized.content.filter((/**
     * ノードの作成または検証する要素種別が「paragraph」と一致するまたはノードの作成または検証する要素種別が「imageRef」と一致する要素だけを後続処理へ残す。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns ノードの作成または検証する要素種別が「paragraph」と一致するまたはノードの作成または検証する要素種別が「imageRef」と一致する場合はtrue
     */
    function filterItem65(node) {
        return node.type === "paragraph" || node.type === "imageRef";
    }));
    return {
        type: "doc",
        content: content.length ? content : [normalizeParagraph({ type: "paragraph" }) as TableCellRichTextDocument["content"][number]],
    };
}
