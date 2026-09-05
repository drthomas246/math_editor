import { Editor, Extension, Mark, mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { ContentColor } from "../../domain/worksheet/rich-text";
import type { BasicRichTextDocument, ImagePlacement, ImageWidthPercent, RichTextMark, TableCellRichTextDocument, TableRow } from "../../domain/worksheet/worksheet";
import { applyTableOperation, getTableCellLocation, getTableOperationAvailability, setTableColumnWidth, setTableRowHeight, type TableOperation, type TableOperationAvailability } from "../../domain/worksheet/table-operations";
import { getMathAriaLabel, renderMathMarkup } from "./MathFormula";
export type MathTextSize = "small" | "normal" | "large" | "xLarge";
/**
 * insertMathAtSelectionの対象となる要素を追加する。
 *
 * @param editor editorとして使用する値
 * @param latex latexとして使用する値
 * @param block blockとして使用する値
 * @param textSize textSizeとして使用する値
 * @param color colorとして使用する値
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
 * setSelectionContentColorの対象となる状態を更新する。
 *
 * @param editor editorとして使用する値
 * @param color colorとして使用する値
 */
export function setSelectionContentColor(editor: Editor, color: ContentColor): void {
    if (editor.isDestroyed)
        return;
    const { selection } = editor.state;
    let transaction = editor.state.tr;
    let changedNode = false;
    editor.state.doc.nodesBetween(selection.from, selection.to, (/**
     * nodesBetweenへ渡す処理を実行する。
     *
     * @param node 処理対象の値
     * @param position 対象となる位置
     * @returns 呼び出し元で使用する処理結果
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
 * getSelectionContentColorで必要な値を取得する。
 *
 * @param editor editorとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function getSelectionContentColor(editor: Editor): ContentColor {
    if (editor.isActive("answerColor"))
        return "answer";
    const { selection } = editor.state;
    let answerNodeSelected = false;
    editor.state.doc.nodesBetween(selection.from, selection.to, (/**
     * nodesBetweenへ渡す処理を実行する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function nodesBetweenCallback2(node) {
        if (COLORABLE_NODE_TYPES.has(node.type.name) && node.attrs.answerColor === true)
            answerNodeSelected = true;
        return !answerNodeSelected;
    }));
    return answerNodeSelected ? "answer" : "problem";
}
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
 * isMathTextSizeで表される条件を判定する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function isMathTextSize(value: unknown): value is MathTextSize {
    return value === "small" || value === "normal" || value === "large" || value === "xLarge";
}
/**
 * readStringAttributeで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function readStringAttribute(value: unknown): string {
    return typeof value === "string" ? value : "";
}
/**
 * createMathNodeViewで必要な値を作成する。
 *
 * @param block blockとして使用する値
 * @param onEdit onEditとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createMathNodeView(block: boolean, onEdit: MathNodeOptions["onEdit"]) {
    return (/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function commentRuleCallback3(parameter1: {
        node: {
            type: {
                name: string;
            };
            attrs: Record<string, unknown>;
        };
        editor: Editor;
        getPos: () => number | undefined;
    }) {
        let { node, editor, getPos } = parameter1;
        const dom = document.createElement(block ? "div" : "span");
        const render = (/**
         * renderに対応する画面表示を更新する。
         *
         * @param attrs attrsとして使用する値
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
                 * DOMから通知されたイベントを処理する。
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
             * ignoreMutationに必要な処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function ignoreMutationCallback6() {
                return true;
            }),
            selectNode: (/**
             * selectNodeで必要な値を取得する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function selectNodeCallback7() {
                return dom.classList.add("math-node-selected");
            }),
            deselectNode: (/**
             * deselectNodeに必要な処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function deselectNodeCallback8() {
                return dom.classList.remove("math-node-selected");
            }),
            update: (/**
             * updateの対象となる状態を更新する。
             *
             * @param nextNode nextNodeとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function updateCallback9(nextNode: typeof node) {
                if (nextNode.type.name !== node.type.name)
                    return false;
                node = nextNode;
                render(nextNode.attrs);
                return true;
            }),
            stopEvent: (/**
             * stopEventに必要な処理を実行する。
             *
             * @param event 発生したイベント
             * @returns 呼び出し元で使用する処理結果
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
     * addOptionsの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addOptions() {
        return { onEdit: null };
    },
    /**
     * addAttributesの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addAttributes() {
        return {
            latex: { default: "" },
            textSize: { default: "normal" },
            answerColor: { default: false },
        };
    },
    /**
     * parseHTMLの入力値を必要な形式へ変換する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    parseHTML() {
        return [{ tag: '[data-math-node="inline"]' }];
    },
    /**
     * renderHTMLに対応する画面表示を更新する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    renderHTML(parameter1) {
        let { HTMLAttributes } = parameter1;
        return ["span", mergeAttributes(HTMLAttributes, { "data-math-node": "inline" })];
    },
    /**
     * addNodeViewの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
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
     * addOptionsの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addOptions() {
        return { onEdit: null };
    },
    /**
     * addAttributesの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addAttributes() {
        return {
            latex: { default: "" },
            textSize: { default: "normal" },
            answerColor: { default: false },
        };
    },
    /**
     * parseHTMLの入力値を必要な形式へ変換する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    parseHTML() {
        return [{ tag: '[data-math-node="block"]' }];
    },
    /**
     * renderHTMLに対応する画面表示を更新する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    renderHTML(parameter1) {
        let { HTMLAttributes } = parameter1;
        return ["div", mergeAttributes(HTMLAttributes, { "data-math-node": "block" })];
    },
    /**
     * addNodeViewの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addNodeView() {
        return createMathNodeView(true, this.options.onEdit);
    },
});
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
     * addOptionsの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addOptions() {
        return { assetUrls: new Map(), onEdit: null };
    },
    /**
     * addAttributesの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
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
     * parseHTMLの入力値を必要な形式へ変換する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    parseHTML() {
        return [{ tag: "[data-image-ref]" }];
    },
    /**
     * renderHTMLに対応する画面表示を更新する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    renderHTML(parameter1) {
        let { HTMLAttributes } = parameter1;
        return ["div", mergeAttributes(HTMLAttributes, { "data-image-ref": "" })];
    },
    /**
     * addNodeViewの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addNodeView() {
        // 名前付きコールバックでもTipTap拡張の設定参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis11 = this;
        const assetUrls = this.options.assetUrls;
        return (/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param parameter1 parameter1として使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback12(parameter1) {
            let { node } = parameter1;
            const dom = document.createElement("div");
            const render = (/**
             * renderに対応する画面表示を更新する。
             *
             * @param attrs attrsとして使用する値
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
                dom.title = commentRuleThis11.options.onEdit ? "画像を編集" : "";
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
                if (commentRuleThis11.options.onEdit) {
                    const editButton = document.createElement("button");
                    editButton.type = "button";
                    editButton.className = "editor-image-edit-button";
                    editButton.textContent = "編集";
                    editButton.setAttribute("aria-label", "画像を編集");
                    editButton.addEventListener("click", (/**
                     * DOMから通知されたイベントを処理する。
                     *
                     * @param event 発生したイベント
                     */
                    function handleDomEvent14(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        commentRuleThis11.options.onEdit?.({
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
                 * ignoreMutationに必要な処理を実行する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function ignoreMutationCallback15() {
                    return true;
                }),
                selectNode: (/**
                 * selectNodeで必要な値を取得する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function selectNodeCallback16() {
                    return dom.classList.add("selected");
                }),
                deselectNode: (/**
                 * deselectNodeに必要な処理を実行する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function deselectNodeCallback17() {
                    return dom.classList.remove("selected");
                }),
                update: (/**
                 * updateの対象となる状態を更新する。
                 *
                 * @param nextNode nextNodeとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function updateCallback18(nextNode) {
                    if (nextNode.type.name !== node.type.name)
                        return false;
                    node = nextNode;
                    render(nextNode.attrs);
                    return true;
                }),
                stopEvent: (/**
                 * stopEventに必要な処理を実行する。
                 *
                 * @param event 発生したイベント
                 * @returns 呼び出し元で使用する処理結果
                 */
                function stopEventCallback19(event) {
                    return event.target instanceof HTMLElement && Boolean(event.target.closest(".editor-image-edit-button"));
                }),
            };
        });
    },
});
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
     * addOptionsの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addOptions() {
        return { assetUrls: new Map(), onCellFocus: (/**
             * onCellFocusに対応するイベントまたは通知を処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function onCellFocusCallback20() {
                return undefined;
            }), onCellStateChange: (/**
             * onCellStateChangeに対応するイベントまたは通知を処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function onCellStateChangeCallback21() {
                return undefined;
            }), onEditMath: null };
    },
    /**
     * addAttributesの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
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
     * parseHTMLの入力値を必要な形式へ変換する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    parseHTML() {
        return [{ tag: "[data-rich-table]" }];
    },
    /**
     * renderHTMLに対応する画面表示を更新する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    renderHTML(parameter1) {
        let { HTMLAttributes } = parameter1;
        return ["div", mergeAttributes(HTMLAttributes, { "data-rich-table": "" })];
    },
    /**
     * addNodeViewの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addNodeView() {
        // 名前付きコールバックでもTipTap拡張の設定参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis22 = this;
        return (/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param parameter1 parameter1として使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback23(parameter1) {
            let { node, editor: outerEditor, getPos } = parameter1;
            const dom = document.createElement("div");
            const cellElements = new Map<string, HTMLTableCellElement>();
            let activeCellId: string | null = null;
            let cellEditor: Editor | null = null;
            let structureKey = "";
            const findCell = (/**
             * findCellで必要な値を取得する。
             *
             * @param cellId 対象を識別するID
             * @returns 呼び出し元で使用する処理結果
             */
            function findCellImplementation24(cellId: string) {
                const rows = Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [];
                const columnWidthsPercent = Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [];
                for (const [rowIndex, row] of rows.entries()) {
                    const cellIndex = row.cells.findIndex((/**
                     * 検索条件に一致する要素か判定する。
                     *
                     * @param cell cellとして使用する値
                     * @returns 呼び出し元で使用する処理結果
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
             * updateCellDocumentの対象となる状態を更新する。
             *
             * @param cellId 対象を識別するID
             * @param documentValue documentValueとして使用する値
             */
            function updateCellDocumentImplementation26(cellId: string, documentValue: TableCellRichTextDocument) {
                const position = getPos();
                if (typeof position !== "number")
                    return;
                const nextRows = structuredClone(Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : []);
                for (const row of nextRows) {
                    const cell = row.cells.find((/**
                     * 検索条件に一致する要素か判定する。
                     *
                     * @param item 処理対象の値
                     * @returns 呼び出し元で使用する処理結果
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
             * showCellPreviewに対応する画面表示を更新する。
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
                renderTableCellDocumentPreview(button, location.cell.document, commentRuleThis22.options.assetUrls);
                button.addEventListener("click", (/**
                 * DOMから通知されたイベントを処理する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleDomEvent29() {
                    return activateCell(cellId);
                }));
                tableCell.classList.remove("active");
                tableCell.replaceChildren(button);
            });
            const deactivateCell = (/**
             * deactivateCellに必要な処理を実行する。
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
             * activateCellに必要な処理を実行する。
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
                        InlineMath.configure({ onEdit: commentRuleThis22.options.onEditMath }),
                        ImageRef.configure({ assetUrls: commentRuleThis22.options.assetUrls }),
                    ],
                    content: normalizeTableCellEditorDocument(location.cell.document as JSONContent) as unknown as JSONContent,
                    editorProps: {
                        attributes: {
                            class: "rich-editor-content table-cell-wysiwyg-content",
                            "aria-label": `${location.rowIndex + 1}行${location.cellIndex + 1}列`,
                        },
                    },
                    onUpdate: (/**
                     * onUpdateに対応するイベントまたは通知を処理する。
                     *
                     * @param parameter1 parameter1として使用する値
                     */
                    function onUpdateCallback32(parameter1) {
                        let { editor: currentEditor } = parameter1;
                        updateCellDocument(cellId, normalizeTableCellEditorDocument(currentEditor.getJSON()));
                    }),
                    onSelectionUpdate: (/**
                     * onSelectionUpdateに対応するイベントまたは通知を処理する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function onSelectionUpdateCallback33() {
                        return commentRuleThis22.options.onCellStateChange();
                    }),
                    onTransaction: (/**
                     * onTransactionに対応するイベントまたは通知を処理する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function onTransactionCallback34() {
                        return commentRuleThis22.options.onCellStateChange();
                    }),
                });
                cellEditor = nestedEditor;
                const currentTable = {
                    rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                    columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
                };
                const currentLocation = getTableCellLocation(currentTable, cellId);
                const commitTableData = (/**
                 * commitTableDataの対象となる状態を更新する。
                 *
                 * @param nextTable nextTableとして使用する値
                 * @returns 呼び出し元で使用する処理結果
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
                     * applyTableOperationの対象となる状態を更新する。
                     *
                     * @param operation operationとして使用する値
                     * @returns 呼び出し元で使用する処理結果
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
                     * deactivateに必要な処理を実行する。
                     */
                    function deactivateCallback37() {
                        if (activeCellId === cellId)
                            deactivateCell();
                    }),
                    insertMath: (/**
                     * insertMathの対象となる要素を追加する。
                     *
                     * @param latex latexとして使用する値
                     * @param textSize textSizeとして使用する値
                     * @param color colorとして使用する値
                     */
                    function insertMathCallback38(latex, textSize, color) {
                        if (!nestedEditor.isDestroyed)
                            insertMathAtSelection(nestedEditor, latex, false, textSize, color);
                    }),
                    isActive: (/**
                     * isActiveで表される条件を判定する。
                     *
                     * @param name nameとして使用する値
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function isActiveCallback39(name) {
                        return !nestedEditor.isDestroyed && nestedEditor.isActive(name);
                    }),
                    setContentColor: (/**
                     * setContentColorの対象となる状態を更新する。
                     *
                     * @param color colorとして使用する値
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
                     * setTextSizeの対象となる状態を更新する。
                     *
                     * @param size sizeとして使用する値
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
                         * setRowHeightMmの対象となる状態を更新する。
                         *
                         * @param heightMm heightMmとして使用する値
                         * @returns 呼び出し元で使用する処理結果
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
                         * setColumnWidthPercentの対象となる状態を更新する。
                         *
                         * @param widthPercent widthPercentとして使用する値
                         * @returns 呼び出し元で使用する処理結果
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
                     * toggleBoldに対応する画面表示を更新する。
                     */
                    function toggleBoldCallback44() { if (!nestedEditor.isDestroyed)
                        nestedEditor.chain().focus().toggleBold().run(); }),
                    toggleItalic: (/**
                     * toggleItalicに対応する画面表示を更新する。
                     */
                    function toggleItalicCallback45() { if (!nestedEditor.isDestroyed)
                        nestedEditor.chain().focus().toggleItalic().run(); }),
                    toggleUnderline: (/**
                     * toggleUnderlineに対応する画面表示を更新する。
                     */
                    function toggleUnderlineCallback46() { if (!nestedEditor.isDestroyed)
                        nestedEditor.chain().focus().toggleUnderline().run(); }),
                };
                nestedEditor.on("focus", (/**
                 * onへ渡す処理を実行する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function onCallback47() {
                    return commentRuleThis22.options.onCellFocus(controller);
                }));
                commentRuleThis22.options.onCellFocus(controller);
                nestedEditor.commands.focus("end");
            });
            const render = (/**
             * renderに対応する画面表示を更新する。
             *
             * @param attrs attrsとして使用する値
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
                 * ignoreMutationに必要な処理を実行する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function ignoreMutationCallback49() {
                    return true;
                }),
                selectNode: (/**
                 * selectNodeで必要な値を取得する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function selectNodeCallback50() {
                    return dom.classList.add("selected");
                }),
                deselectNode: (/**
                 * deselectNodeに必要な処理を実行する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function deselectNodeCallback51() {
                    return dom.classList.remove("selected");
                }),
                update: (/**
                 * updateの対象となる状態を更新する。
                 *
                 * @param nextNode nextNodeとして使用する値
                 * @returns 呼び出し元で使用する処理結果
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
                 * stopEventに必要な処理を実行する。
                 *
                 * @param event 発生したイベント
                 * @returns 呼び出し元で使用する処理結果
                 */
                function stopEventCallback53(event) {
                    return event.target instanceof globalThis.Node && dom.contains(event.target);
                }),
                destroy: (/**
                 * destroyの対象となる要素を削除または解放する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function destroyCallback54() {
                    return cellEditor?.destroy();
                }),
            };
        });
    },
});
/**
 * renderTableCellDocumentPreviewに対応する画面表示を更新する。
 *
 * @param container containerとして使用する値
 * @param documentValue documentValueとして使用する値
 * @param assetUrls assetUrlsとして使用する値
 */
function renderTableCellDocumentPreview(container: HTMLElement, documentValue: TableCellRichTextDocument, assetUrls: ReadonlyMap<string, string>): void {
    container.replaceChildren();
    const visible = documentValue.content.some((/**
     * 条件に一致する要素か判定する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
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
 * getTableStructureKeyで必要な値を取得する。
 *
 * @param attrs attrsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function getTableStructureKey(attrs: Record<string, unknown>): string {
    const rows = Array.isArray(attrs.rows) ? attrs.rows as TableRow[] : [];
    const widths = Array.isArray(attrs.columnWidthsPercent) ? attrs.columnWidthsPercent : [];
    return JSON.stringify({
        headerRow: Boolean(attrs.headerRow),
        answerColor: Boolean(attrs.answerColor),
        widths,
        rows: rows.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param row rowとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem56(row) {
            return ({
                id: row.id,
                heightMm: row.heightMm ?? null,
                cells: row.cells.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param cell cellとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem57(cell) {
                    return ({ id: cell.id, rowSpan: cell.rowSpan, columnSpan: cell.columnSpan });
                })),
            });
        })),
    });
}
export const ParagraphTextAlign = Extension.create({
    name: "worksheetParagraphTextAlign",
    /**
     * addGlobalAttributesの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addGlobalAttributes() {
        return [{
                types: ["paragraph"],
                attributes: {
                    textAlign: {
                        default: "left",
                        parseHTML: (/**
                         * parseHTMLの入力値を必要な形式へ変換する。
                         *
                         * @param element 処理対象の値
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function parseHTMLCallback58(element) {
                            return element.style.textAlign || "left";
                        }),
                        renderHTML: (/**
                         * renderHTMLに対応する画面表示を更新する。
                         *
                         * @param attributes attributesとして使用する値
                         * @returns 呼び出し元で使用する処理結果
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
     * addAttributesの対象となる要素を追加する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    addAttributes() {
        return {
            size: {
                default: "large",
                parseHTML: (/**
                 * parseHTMLの入力値を必要な形式へ変換する。
                 *
                 * @param element 処理対象の値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function parseHTMLCallback60(element) {
                    return element.getAttribute("data-text-size") ?? "large";
                }),
            },
        };
    },
    /**
     * parseHTMLの入力値を必要な形式へ変換する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    parseHTML() {
        return [{ tag: "span[data-text-size]" }];
    },
    /**
     * renderHTMLに対応する画面表示を更新する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    renderHTML(parameter1) {
        let { HTMLAttributes } = parameter1;
        return ["span", mergeAttributes(HTMLAttributes, {
                "data-text-size": HTMLAttributes.size,
                class: `text-size-${String(HTMLAttributes.size)}`,
            }), 0];
    },
});
export const AnswerColor = Mark.create({
    name: "answerColor",
    /**
     * parseHTMLの入力値を必要な形式へ変換する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    parseHTML() {
        return [{ tag: "span[data-answer-color]" }];
    },
    /**
     * renderHTMLに対応する画面表示を更新する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    renderHTML(parameter1) {
        let { HTMLAttributes } = parameter1;
        return ["span", mergeAttributes(HTMLAttributes, {
                "data-answer-color": "true",
                class: "answer-color",
            }), 0];
    },
});
/**
 * normalizeMarksの入力値を必要な形式へ変換する。
 *
 * @param marks marksとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * normalizeInlineNodeの入力値を必要な形式へ変換する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
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
 * normalizeParagraphの入力値を必要な形式へ変換する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function normalizeParagraph(node: JSONContent): Record<string, unknown> {
    const textAlign = ["left", "center", "right"].includes(String(node.attrs?.textAlign))
        ? String(node.attrs?.textAlign)
        : "left";
    const content = (node.content ?? []).map(normalizeInlineNode).filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem61(item) {
        return item !== null;
    }));
    return { type: "paragraph", attrs: { textAlign }, content };
}
/**
 * normalizeListItemの入力値を必要な形式へ変換する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function normalizeListItem(node: JSONContent): Record<string, unknown> {
    const content = (node.content ?? [])
        .filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param child childとして使用する値
     * @returns 呼び出し元で使用する処理結果
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
 * normalizeBlockNodeの入力値を必要な形式へ変換する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function normalizeBlockNode(node: JSONContent): Record<string, unknown> | null {
    if (node.type === "paragraph")
        return normalizeParagraph(node);
    if (node.type === "bulletList" || node.type === "orderedList") {
        const content = (node.content ?? [])
            .filter((/**
         * 対象要素を結果へ残すか判定する。
         *
         * @param child childとして使用する値
         * @returns 呼び出し元で使用する処理結果
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
 * isImagePlacementで表される条件を判定する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function isImagePlacement(value: unknown): value is "block" | "floatLeft" | "floatRight" {
    return value === "block" || value === "floatLeft" || value === "floatRight";
}
/**
 * normalizeImageWidthの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @param placement placementとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function normalizeImageWidth(value: unknown, placement: "block" | "floatLeft" | "floatRight"): 25 | 33 | 50 | 66 | 75 | 100 {
    const allowed = placement === "block" ? [25, 33, 50, 66, 75, 100] : [25, 33, 50];
    const width = Number(value);
    return (allowed.includes(width) ? width : 50) as 25 | 33 | 50 | 66 | 75 | 100;
}
/**
 * normalizeEditorDocumentの入力値を必要な形式へ変換する。
 *
 * @param document documentとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function normalizeEditorDocument(document: JSONContent): BasicRichTextDocument {
    const content = (document.content ?? []).map(normalizeBlockNode).filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
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
 * normalizeTableCellEditorDocumentの入力値を必要な形式へ変換する。
 *
 * @param document documentとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function normalizeTableCellEditorDocument(document: JSONContent): TableCellRichTextDocument {
    const normalized = normalizeEditorDocument(document);
    const content = normalized.content.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem65(node) {
        return node.type === "paragraph" || node.type === "imageRef";
    }));
    return {
        type: "doc",
        content: content.length ? content : [normalizeParagraph({ type: "paragraph" }) as TableCellRichTextDocument["content"][number]],
    };
}
