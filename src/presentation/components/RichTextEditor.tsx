import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Image, Italic, List, ListOrdered, Sigma, Table2, Underline as UnderlineIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ContentColor } from "../../domain/worksheet/rich-text";
import type { BasicRichTextDocument } from "../../domain/worksheet/worksheet";
import { MathDialog } from "../dialogs/EditorDialogs";
import { AnswerColor, BlockMath, getSelectionContentColor, ImageRef, InlineMath, insertMathAtSelection, normalizeEditorDocument, normalizeTableCellEditorDocument, ParagraphTextAlign, RichTable, setSelectionContentColor, TextSize, type EditableImageRef, type EditableMathRef, type MathTextSize, type RichTableCellEditorController } from "./rich-text-editor-extensions";
import { TableStructureToolbar } from "./TableStructureToolbar";
type Props = {
    document: BasicRichTextDocument;
    onChange: (document: BasicRichTextDocument) => void;
    placeholder?: string;
    compact?: boolean;
    tableCell?: boolean;
    toolbarContainer?: HTMLElement | null;
    enableMath?: boolean;
    initialColor?: ContentColor;
    showColorSelector?: boolean;
    onImage?: (color: ContentColor) => void;
    onEditImage?: (image: EditableImageRef) => void;
    onTable?: (color: ContentColor) => void;
    assetUrls?: ReadonlyMap<string, string>;
};
const EMPTY_ASSET_URLS = new Map<string, string>();
/**
 * RichTextEditorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function RichTextEditor(props: Props) {
    let { document, onChange, placeholder = "ここに問題文を入力…", compact, tableCell = false, toolbarContainer, enableMath = false, initialColor = "problem", showColorSelector = true, onImage, onEditImage, onTable, assetUrls = EMPTY_ASSET_URLS } = props;
    const [mathOpen, setMathOpen] = useState(false);
    const [cellMathOpen, setCellMathOpen] = useState(false);
    const [editingMath, setEditingMath] = useState<EditableMathRef | null>(null);
    const [activeRichTableCell, setActiveRichTableCell] = useState<RichTableCellEditorController | null>(null);
    const activeRichTableCellRef = useRef<RichTableCellEditorController | null>(null);
    const updateActiveRichTableCell = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param controller controllerとして使用する値
     */
    function createMemoizedCallback1(controller: RichTableCellEditorController | null) {
        activeRichTableCellRef.current = controller;
        setActiveRichTableCell(controller);
    }), []);
    const [selectedColor, setSelectedColor] = useState<ContentColor>(initialColor);
    const handleRichTableCellFocus = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param controller controllerとして使用する値
     */
    function createMemoizedCallback2(controller: RichTableCellEditorController) {
        const current = activeRichTableCellRef.current;
        if (current && current !== controller)
            current.deactivate();
        updateActiveRichTableCell(controller);
        setSelectedColor(controller.isActive("answerColor") ? "answer" : "problem");
    }), [updateActiveRichTableCell]);
    const [, setCellToolbarRevision] = useState(0);
    const [richTableMathInserter, setRichTableMathInserter] = useState<((latex: string, textSize: MathTextSize, color: ContentColor) => void) | null>(null);
    const onEditImageRef = useRef(onEditImage);
    useLayoutEffect((/**
     * 描画前にレイアウト依存の状態を同期する。
     */
    function synchronizeLayoutEffect3() { onEditImageRef.current = onEditImage; }), [onEditImage]);
    const handleEditImage = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param image imageとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function createMemoizedCallback4(image: EditableImageRef) {
        return onEditImageRef.current?.(image);
    }), []);
    const [stableAssetUrls] = useState((/**
     * useStateへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useStateCallback5() {
        return new Map(assetUrls);
    }));
    useLayoutEffect((/**
     * 描画前にレイアウト依存の状態を同期する。
     */
    function synchronizeLayoutEffect6() {
        stableAssetUrls.clear();
        assetUrls.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param url urlとして使用する値
         * @param assetId 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function processItem7(url, assetId) {
            return stableAssetUrls.set(assetId, url);
        }));
    }), [assetUrls, stableAssetUrls]);
    const canEditImages = onEditImage !== undefined;
    const hasInsertTools = Boolean(enableMath || onImage || onTable || tableCell);
    const normalize = tableCell ? normalizeTableCellEditorDocument : normalizeEditorDocument;
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                blockquote: false,
                code: false,
                codeBlock: false,
                heading: false,
                horizontalRule: false,
                link: false,
                strike: false,
                trailingNode: { notAfter: ["paragraph", "bulletList", "orderedList"] },
            }),
            ParagraphTextAlign,
            TextSize,
            AnswerColor,
            InlineMath.configure({ onEdit: setEditingMath }),
            BlockMath.configure({ onEdit: setEditingMath }),
            // TipTapはref経由のコールバックを保持するだけで、Reactの描画中には呼び出さない。
            // oxlint-disable-next-line react/refs
            ImageRef.configure({ assetUrls: stableAssetUrls, onEdit: canEditImages ? handleEditImage : null }),
            // TipTapはref経由のコールバックを保持するだけで、Reactの描画中には呼び出さない。
            // oxlint-disable-next-line react/refs
            RichTable.configure({
                assetUrls: stableAssetUrls,
                onCellFocus: handleRichTableCellFocus,
                onCellStateChange: (/**
                 * onCellStateChangeに対応するイベントまたは通知を処理する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function onCellStateChangeCallback8() {
                    return setCellToolbarRevision((/**
                     * setCellToolbarRevisionへ渡す処理を実行する。
                     *
                     * @param revision revisionとして使用する値
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function setCellToolbarRevisionCallback9(revision) {
                        return revision + 1;
                    }));
                }),
                onEditMath: setEditingMath,
            }),
        ],
        content: normalize(document as JSONContent) as unknown as JSONContent,
        editorProps: { attributes: { class: "rich-editor-content", "aria-label": placeholder } },
        onCreate: (/**
         * onCreateに対応するイベントまたは通知を処理する。
         *
         * @param parameter1 parameter1として使用する値
         */
        function onCreateCallback10(parameter1) {
            let { editor: currentEditor } = parameter1;
            if (initialColor === "answer")
                currentEditor.commands.setMark("answerColor");
        }),
        onUpdate: (/**
         * onUpdateに対応するイベントまたは通知を処理する。
         *
         * @param parameter1 parameter1として使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function onUpdateCallback11(parameter1) {
            let { editor: currentEditor } = parameter1;
            return onChange(normalize(currentEditor.getJSON()));
        }),
        onSelectionUpdate: (/**
         * onSelectionUpdateに対応するイベントまたは通知を処理する。
         *
         * @param parameter1 parameter1として使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function onSelectionUpdateCallback12(parameter1) {
            let { editor: currentEditor } = parameter1;
            return setSelectedColor(getSelectionContentColor(currentEditor));
        }),
    }, [tableCell, initialColor, canEditImages]);
    const previousAssetUrlsRef = useRef(assetUrls);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect13() {
        if (previousAssetUrlsRef.current === assetUrls)
            return;
        previousAssetUrlsRef.current = assetUrls;
        if (!editor || editor.isDestroyed)
            return;
        // TipTapのインスタンス、文書、履歴、選択状態を維持したまま画像URLを更新するため、
        // ノードビューだけを再構築する。
        editor.view.setProps({ nodeViews: {} });
        editor.createNodeViews();
    }), [assetUrls, editor]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect14() {
        if (!editor || editor.isDestroyed || editor.isFocused)
            return;
        const next = normalize(document as JSONContent);
        const current = normalize(editor.getJSON());
        if (JSON.stringify(current) !== JSON.stringify(next)) {
            editor.commands.setContent(next as unknown as JSONContent, { emitUpdate: false });
        }
    }), [document, editor, normalize]);
    if (!editor)
        return null;
    const openMath = (/**
     * openMathに対応する画面表示を更新する。
     */
    function openMathImplementation15() {
        if (activeRichTableCell)
            setRichTableMathInserter((/**
             * setRichTableMathInserterへ渡す処理を実行する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function setRichTableMathInserterCallback16() {
                return activeRichTableCell.insertMath;
            }));
        else if (tableCell)
            setCellMathOpen(true);
        else if (enableMath)
            setMathOpen(true);
    });
    const changeColor = (/**
     * changeColorの対象となる状態を更新する。
     *
     * @param color colorとして使用する値
     */
    function changeColorImplementation17(color: ContentColor) {
        setSelectedColor(color);
        if (activeRichTableCell)
            activeRichTableCell.setContentColor(color);
        else
            setSelectionContentColor(editor, color);
    });
    const toolbar = <div className="rich-toolbar" aria-label="書式ツールバー">
    {showColorSelector && <>
      <select className={`content-color-select ${selectedColor}`} aria-label="入力色" value={selectedColor} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange18(event) {
            return changeColor(event.target.value as ContentColor);
        })}><option value="problem">問題色（黒）</option><option value="answer">解答色（赤）</option></select>
      <span className="toolbar-separator"/>
    </>}
    <select aria-label="文字サイズ" defaultValue="normal" onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         */
        function handleChange19(event) {
            const size = event.target.value;
            if (activeRichTableCell)
                activeRichTableCell.setTextSize(size);
            else if (size === "normal")
                editor.chain().focus().unsetMark("textSize").run();
            else
                editor.chain().focus().setMark("textSize", { size }).run();
        })}><option value="small">小</option><option value="normal">標準</option><option value="large">大</option><option value="xLarge">特大</option></select>
    <span className="toolbar-separator"/>
    <ToolbarButton label="太字" active={activeRichTableCell?.isActive("bold") ?? editor.isActive("bold")} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick20() {
        return activeRichTableCell ? activeRichTableCell.toggleBold() : editor.chain().focus().toggleBold().run();
    })}><Bold size={15}/></ToolbarButton>
    <ToolbarButton label="下線" active={activeRichTableCell?.isActive("underline") ?? editor.isActive("underline")} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick21() {
        return activeRichTableCell ? activeRichTableCell.toggleUnderline() : editor.chain().focus().toggleUnderline().run();
    })}><UnderlineIcon size={15}/></ToolbarButton>
    <ToolbarButton label="斜体" active={activeRichTableCell?.isActive("italic") ?? editor.isActive("italic")} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick22() {
        return activeRichTableCell ? activeRichTableCell.toggleItalic() : editor.chain().focus().toggleItalic().run();
    })}><Italic size={15}/></ToolbarButton>
    {!tableCell && <>
      <span className="toolbar-separator"/>
      <ToolbarButton label="箇条書き" disabled={Boolean(activeRichTableCell)} active={editor.isActive("bulletList")} onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick23() {
            return editor.chain().focus().toggleBulletList().run();
        })}><List size={16}/></ToolbarButton>
      <ToolbarButton label="番号付きリスト" disabled={Boolean(activeRichTableCell)} active={editor.isActive("orderedList")} onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick24() {
            return editor.chain().focus().toggleOrderedList().run();
        })}><ListOrdered size={16}/></ToolbarButton>
    </>}
    {hasInsertTools && <span className="toolbar-separator"/>}
    {(enableMath || tableCell) && <ToolbarButton label="数式" onClick={openMath}><Sigma size={16}/></ToolbarButton>}
    {onImage && <ToolbarButton label="画像" disabled={Boolean(activeRichTableCell)} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick25() {
        return onImage(selectedColor);
    })}><Image size={16}/></ToolbarButton>}
    {onTable && <ToolbarButton label="表" disabled={Boolean(activeRichTableCell)} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick26() {
        return onTable(selectedColor);
    })}><Table2 size={16}/></ToolbarButton>}
  </div>;
    return (<div className={`rich-editor ${compact ? "rich-editor-compact" : ""} ${tableCell ? "rich-editor-table-cell" : ""}`}>
      {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
      {activeRichTableCell && <TableStructureToolbar availability={activeRichTableCell.tableOperationAvailability} onOperation={(/**
             * onOperationで発生した画面イベントを処理する。
             *
             * @param operation operationとして使用する値
             */
            function handleOperation27(operation) {
                if (activeRichTableCell.applyTableOperation(operation))
                    updateActiveRichTableCell(null);
            })} sizing={{
                rowHeightMm: activeRichTableCell.tableSizing.rowHeightMm,
                columnWidthPercent: activeRichTableCell.tableSizing.columnWidthPercent,
                canResizeColumn: activeRichTableCell.tableSizing.canResizeColumn,
                onRowHeightChange: (/**
                 * onRowHeightChangeに対応するイベントまたは通知を処理する。
                 *
                 * @param heightMm heightMmとして使用する値
                 */
                function onRowHeightChangeCallback28(heightMm) {
                    if (activeRichTableCell.tableSizing.setRowHeightMm(heightMm))
                        updateActiveRichTableCell(null);
                }),
                onColumnWidthChange: (/**
                 * onColumnWidthChangeに対応するイベントまたは通知を処理する。
                 *
                 * @param widthPercent widthPercentとして使用する値
                 */
                function onColumnWidthChangeCallback29(widthPercent) {
                    if (activeRichTableCell.tableSizing.setColumnWidthPercent(widthPercent))
                        updateActiveRichTableCell(null);
                }),
            }}/>}
      <div onPointerDownCapture={(/**
         * onPointerDownCaptureで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         */
        function handlePointerDownCapture30(event) {
            if (!(event.target as HTMLElement).closest("[data-rich-table]")) {
                activeRichTableCellRef.current?.deactivate();
                updateActiveRichTableCell(null);
            }
        })}><EditorContent editor={editor}/></div>
      {mathOpen && <MathDialog onClose={(/**
         * onCloseで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClose31() {
            return setMathOpen(false);
        })} onInsert={(/**
             * onInsertで発生した画面イベントを処理する。
             *
             * @param latex latexとして使用する値
             * @param block blockとして使用する値
             * @param textSize textSizeとして使用する値
             */
            function handleInsert32(latex, block, textSize) {
                insertMathAtSelection(editor, latex, block, textSize, selectedColor);
                setMathOpen(false);
            })}/>}
      {cellMathOpen && <MathDialog inlineOnly onClose={(/**
         * onCloseで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClose33() {
            return setCellMathOpen(false);
        })} onInsert={(/**
             * onInsertで発生した画面イベントを処理する。
             *
             * @param latex latexとして使用する値
             * @param _block _blockとして使用する値
             * @param textSize textSizeとして使用する値
             */
            function handleInsert34(latex, _block, textSize) {
                insertMathAtSelection(editor, latex, false, textSize, selectedColor);
                setCellMathOpen(false);
            })}/>}
      {richTableMathInserter && <MathDialog inlineOnly onClose={(/**
         * onCloseで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClose35() {
            return setRichTableMathInserter(null);
        })} onInsert={(/**
             * onInsertで発生した画面イベントを処理する。
             *
             * @param latex latexとして使用する値
             * @param _block _blockとして使用する値
             * @param textSize textSizeとして使用する値
             */
            function handleInsert36(latex, _block, textSize) {
                richTableMathInserter(latex, textSize, selectedColor);
                setRichTableMathInserter(null);
            })}/>}
      {editingMath && <MathDialog initial={{ latex: editingMath.latex, block: editingMath.block, textSize: editingMath.textSize }} onClose={(/**
         * onCloseで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClose37() {
            return setEditingMath(null);
        })} onInsert={(/**
             * onInsertで発生した画面イベントを処理する。
             *
             * @param latex latexとして使用する値
             * @param _block _blockとして使用する値
             * @param textSize textSizeとして使用する値
             */
            function handleInsert38(latex, _block, textSize) {
                applyMathEdit(editingMath, latex, textSize);
                setEditingMath(null);
            })}/>}
    </div>);
}
/**
 * applyMathEditの対象となる状態を更新する。
 *
 * @param math mathとして使用する値
 * @param latex latexとして使用する値
 * @param textSize textSizeとして使用する値
 */
function applyMathEdit(math: EditableMathRef, latex: string, textSize: MathTextSize): void {
    if (math.editor.isDestroyed)
        return;
    const node = math.editor.state.doc.nodeAt(math.position);
    const expectedType = math.block ? "blockMath" : "inlineMath";
    if (!node || node.type.name !== expectedType)
        return;
    math.editor.view.dispatch(math.editor.state.tr.setNodeMarkup(math.position, undefined, { ...node.attrs, latex, textSize }));
    math.editor.commands.focus();
}
/**
 * ToolbarButtonコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function ToolbarButton(props: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: (() => void) | undefined;
    children: React.ReactNode;
}) {
    let { label, active, disabled, onClick, children } = props;
    return <button type="button" disabled={disabled} className={active ? "toolbar-button active" : "toolbar-button"} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
