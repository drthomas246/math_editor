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

// --------------------
// 型定義と定数
// --------------------

type RichTextEditorProps = {
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
 * 問題文・解説・表セルを編集するリッチテキストエディタを表示する。
 *
 * @param props 文書、編集機能、画像URLなどの表示設定
 * @returns リッチテキスト編集領域と書式ツールバー
 */
export function RichTextEditor(props: RichTextEditorProps) {
    let { document, onChange, placeholder = "ここに問題文を入力…", compact, tableCell = false, toolbarContainer, enableMath = false, initialColor = "problem", showColorSelector = true, onImage, onEditImage, onTable, assetUrls = EMPTY_ASSET_URLS } = props;

    // --------------------
    // 状態と参照
    // --------------------

    const [mathOpen, setMathOpen] = useState(false);
    const [cellMathOpen, setCellMathOpen] = useState(false);
    const [editingMath, setEditingMath] = useState<EditableMathRef | null>(null);
    const [activeRichTableCell, setActiveRichTableCell] = useState<RichTableCellEditorController | null>(null);
    const activeRichTableCellRef = useRef<RichTableCellEditorController | null>(null);
    const updateActiveRichTableCell = useCallback((/**
     * 操作中の表セルをStateとRefの両方へ記録し、イベント処理から常に最新値を参照できるようにする。
     *
     * @param controller 編集状態とコマンドを提供するエディタ制御器
     */
    function createMemoizedCallback1(controller: RichTableCellEditorController | null) {
        activeRichTableCellRef.current = controller;
        setActiveRichTableCell(controller);
    }), []);
    const [selectedColor, setSelectedColor] = useState<ContentColor>(initialColor);
    const handleRichTableCellFocus = useCallback((/**
     * フォーカスが移った表セルを有効化し、それまで操作していたセルの編集状態を解除する。
     *
     * @param controller 編集状態とコマンドを提供するエディタ制御器
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
     * TipTapへ渡す安定したコールバックから最新の画像編集処理を呼べるようRefを同期する。
     */
    function synchronizeLayoutEffect3() { onEditImageRef.current = onEditImage; }), [onEditImage]);
    const handleEditImage = useCallback((/**
     * TipTapの再生成を避けながら、最新の画像編集コールバックへ処理を委譲する。
     *
     * @param image 表示または編集する画像
     * @returns 親コンポーネントの画像編集処理が返した値
     */
    function createMemoizedCallback4(image: EditableImageRef) {
        return onEditImageRef.current?.(image);
    }), []);
    const [stableAssetUrls] = useState((/**
     * 初回描画でだけ必要な初期状態を生成し、その後の再描画では同じ値を保持する。
     *
     * @returns Mapの新しいインスタンス
     */
    function useStateCallback5() {
        return new Map(assetUrls);
    }));
    useLayoutEffect((/**
     * Mapの参照を維持したまま内容だけを更新し、TipTapのノードビューから最新URLを参照できるようにする。
     */
    function synchronizeLayoutEffect6() {
        stableAssetUrls.clear();
        assetUrls.forEach((/**
         * 親から受け取ったアセットIDとObject URLの対応を、TipTapが参照するMapへ複写する。
         *
         * @param url 安全性の検証または解放を行うURL
         * @param assetId 対象を識別するID
         */
        function processItem7(url, assetId) {
            return stableAssetUrls.set(assetId, url);
        }));
    }), [assetUrls, stableAssetUrls]);
    const canEditImages = onEditImage !== undefined;
    const hasInsertTools = Boolean(enableMath || onImage || onTable || tableCell);
    const normalize = tableCell ? normalizeTableCellEditorDocument : normalizeEditorDocument;

    // --------------------
    // エディタ設定
    // --------------------

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
                 * 表セル内の選択や書式が変わったことをツールバーへ通知する。
                 */
                function onCellStateChangeCallback8() {
                    return setCellToolbarRevision((/**
                     * 再描画を発生させるため、表セルツールバーの版番号を進める。
                     *
                     * @param revision 非同期更新の前後関係を判定する版番号
                     * @returns 非同期更新の前後関係を判定する版番号と1を加算した値
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
         * 解答欄として開いたエディタへ、初期文字色のマークを設定する。
         *
         * @param callbackInput 作成されたTipTapエディタを含む通知内容
         */
        function onCreateCallback10(callbackInput) {
            let { editor: currentEditor } = callbackInput;
            if (initialColor === "answer")
                currentEditor.commands.setMark("answerColor");
        }),
        onUpdate: (/**
         * TipTapの更新内容を正規化し、親コンポーネントへ編集結果として通知する。
         *
         * @param callbackInput 更新されたTipTapエディタを含む通知内容
         * @returns 親コンポーネントの変更通知処理が返した値
         */
        function onUpdateCallback11(callbackInput) {
            let { editor: currentEditor } = callbackInput;
            return onChange(normalize(currentEditor.getJSON()));
        }),
        onSelectionUpdate: (/**
         * 選択位置の文字色を読み取り、ツールバーの色表示へ反映する。
         *
         * @param callbackInput 選択状態が変わったTipTapエディタを含む通知内容
         */
        function onSelectionUpdateCallback12(callbackInput) {
            let { editor: currentEditor } = callbackInput;
            return setSelectedColor(getSelectionContentColor(currentEditor));
        }),
    }, [tableCell, initialColor, canEditImages]);
    const previousAssetUrlsRef = useRef(assetUrls);
    useEffect((/**
     * 画像URLの変更時だけノードビューを再構築し、文書・履歴・選択状態を維持する。
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
     * 外部文書が変わった場合、編集中の入力を妨げないタイミングでTipTapへ同期する。
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

    // --------------------
    // 数式と書式操作
    // --------------------

    const openMath = (/**
     * 現在の編集対象に応じて、本文・通常表セル・リッチ表セル用の数式ダイアログを開く。
     */
    function openMathImplementation15() {
        if (activeRichTableCell)
            setRichTableMathInserter((/**
             * ダイアログからリッチ表セルへ数式を挿入する関数を保持する。
             *
             * @returns 現在のリッチ表セルへ数式を挿入する関数
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
     * 選択した文字色をツールバーと現在の編集対象へ反映する。
     *
     * @param color 文字または数式へ適用する色
     */
    function changeColorImplementation17(color: ContentColor) {
        setSelectedColor(color);
        if (activeRichTableCell)
            activeRichTableCell.setContentColor(color);
        else
            setSelectionContentColor(editor, color);
    });
    // --------------------
    // 画面表示
    // --------------------

    const toolbar = <div className="rich-toolbar" aria-label="書式ツールバー">
    {showColorSelector && <>
      <select className={`content-color-select ${selectedColor}`} aria-label="入力色" value={selectedColor} onChange={(/**
         * 入力色の選択変更を現在の編集対象へ適用する。
         *
         * @param event 発生したイベント
         */
        function handleChange18(event) {
            return changeColor(event.target.value as ContentColor);
        })}><option value="problem">問題色（黒）</option><option value="answer">解答色（赤）</option></select>
      <span className="toolbar-separator"/>
    </>}
    <select aria-label="文字サイズ" defaultValue="normal" onChange={(/**
         * 選択した文字サイズを表セルまたは本文の選択範囲へ適用する。
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
     * 現在の編集対象で太字を切り替える。
     *
     */
    function handleClick20() {
        return activeRichTableCell ? activeRichTableCell.toggleBold() : editor.chain().focus().toggleBold().run();
    })}><Bold size={15}/></ToolbarButton>
    <ToolbarButton label="下線" active={activeRichTableCell?.isActive("underline") ?? editor.isActive("underline")} onClick={(/**
     * 現在の編集対象で下線を切り替える。
     *
     */
    function handleClick21() {
        return activeRichTableCell ? activeRichTableCell.toggleUnderline() : editor.chain().focus().toggleUnderline().run();
    })}><UnderlineIcon size={15}/></ToolbarButton>
    <ToolbarButton label="斜体" active={activeRichTableCell?.isActive("italic") ?? editor.isActive("italic")} onClick={(/**
     * 現在の編集対象で斜体を切り替える。
     *
     */
    function handleClick22() {
        return activeRichTableCell ? activeRichTableCell.toggleItalic() : editor.chain().focus().toggleItalic().run();
    })}><Italic size={15}/></ToolbarButton>
    {!tableCell && <>
      <span className="toolbar-separator"/>
      <ToolbarButton label="箇条書き" disabled={Boolean(activeRichTableCell)} active={editor.isActive("bulletList")} onClick={(/**
         * 本文の選択範囲で箇条書きを切り替える。
         *
         */
        function handleClick23() {
            return editor.chain().focus().toggleBulletList().run();
        })}><List size={16}/></ToolbarButton>
      <ToolbarButton label="番号付きリスト" disabled={Boolean(activeRichTableCell)} active={editor.isActive("orderedList")} onClick={(/**
         * 本文の選択範囲で番号付きリストを切り替える。
         *
         */
        function handleClick24() {
            return editor.chain().focus().toggleOrderedList().run();
        })}><ListOrdered size={16}/></ToolbarButton>
    </>}
    {hasInsertTools && <span className="toolbar-separator"/>}
    {(enableMath || tableCell) && <ToolbarButton label="数式" onClick={openMath}><Sigma size={16}/></ToolbarButton>}
    {onImage && <ToolbarButton label="画像" disabled={Boolean(activeRichTableCell)} onClick={(/**
     * 現在の入力色を引き継いで画像挿入を親コンポーネントへ依頼する。
     *
     */
    function handleClick25() {
        return onImage(selectedColor);
    })}><Image size={16}/></ToolbarButton>}
    {onTable && <ToolbarButton label="表" disabled={Boolean(activeRichTableCell)} onClick={(/**
     * 現在の入力色を引き継いで表挿入を親コンポーネントへ依頼する。
     *
     */
    function handleClick26() {
        return onTable(selectedColor);
    })}><Table2 size={16}/></ToolbarButton>}
  </div>;
    return (<div className={`rich-editor ${compact ? "rich-editor-compact" : ""} ${tableCell ? "rich-editor-table-cell" : ""}`}>
      {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
      {activeRichTableCell && <TableStructureToolbar availability={activeRichTableCell.tableOperationAvailability} onOperation={(/**
             * 選択中の表セルへ行・列の追加や削除を適用し、操作後はセル選択を解除する。
             *
             * @param operation 適用する表構造の変更
             */
            function handleOperation27(operation) {
                if (activeRichTableCell.applyTableOperation(operation))
                    updateActiveRichTableCell(null);
            })} sizing={{
                rowHeightMm: activeRichTableCell.tableSizing.rowHeightMm,
                columnWidthPercent: activeRichTableCell.tableSizing.columnWidthPercent,
                canResizeColumn: activeRichTableCell.tableSizing.canResizeColumn,
                onRowHeightChange: (/**
                 * 選択行の高さを変更し、変更後はセル選択を解除する。
                 *
                 * @param heightMm ミリメートル単位の高さ
                 */
                function onRowHeightChangeCallback28(heightMm) {
                    if (activeRichTableCell.tableSizing.setRowHeightMm(heightMm))
                        updateActiveRichTableCell(null);
                }),
                onColumnWidthChange: (/**
                 * 選択列の幅を変更し、変更後はセル選択を解除する。
                 *
                 * @param widthPercent 表全体に対する列幅の割合
                 */
                function onColumnWidthChangeCallback29(widthPercent) {
                    if (activeRichTableCell.tableSizing.setColumnWidthPercent(widthPercent))
                        updateActiveRichTableCell(null);
                }),
            }}/>}
      <div onPointerDownCapture={(/**
         * リッチ表の外側を押したとき、表セルの編集状態を解除する。
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
         * 本文用の数式ダイアログを閉じる。
         */
        function handleClose31() {
            return setMathOpen(false);
        })} onInsert={(/**
             * 入力された数式を本文の選択位置へ挿入し、ダイアログを閉じる。
             *
             * @param latex 描画または保存するLaTeX式
             * @param block 処理対象のリッチテキストブロック
             * @param textSize 数式または本文へ適用する文字サイズ
             */
            function handleInsert32(latex, block, textSize) {
                insertMathAtSelection(editor, latex, block, textSize, selectedColor);
                setMathOpen(false);
            })}/>}
      {cellMathOpen && <MathDialog inlineOnly onClose={(/**
         * 通常表セル用の数式ダイアログを閉じる。
         */
        function handleClose33() {
            return setCellMathOpen(false);
        })} onInsert={(/**
             * 入力されたインライン数式を通常表セルへ挿入し、ダイアログを閉じる。
             *
             * @param latex 描画または保存するLaTeX式
             * @param _block コールバックの契約上受け取るが、この処理では参照しないブロック
             * @param textSize 数式または本文へ適用する文字サイズ
             */
            function handleInsert34(latex, _block, textSize) {
                insertMathAtSelection(editor, latex, false, textSize, selectedColor);
                setCellMathOpen(false);
            })}/>}
      {richTableMathInserter && <MathDialog inlineOnly onClose={(/**
         * リッチ表セル用の数式ダイアログを閉じる。
         */
        function handleClose35() {
            return setRichTableMathInserter(null);
        })} onInsert={(/**
             * 入力されたインライン数式をリッチ表セルへ挿入し、ダイアログを閉じる。
             *
             * @param latex 描画または保存するLaTeX式
             * @param _block コールバックの契約上受け取るが、この処理では参照しないブロック
             * @param textSize 数式または本文へ適用する文字サイズ
             */
            function handleInsert36(latex, _block, textSize) {
                richTableMathInserter(latex, textSize, selectedColor);
                setRichTableMathInserter(null);
            })}/>}
      {editingMath && <MathDialog initial={{ latex: editingMath.latex, block: editingMath.block, textSize: editingMath.textSize }} onClose={(/**
         * 既存数式の編集ダイアログを閉じる。
         */
        function handleClose37() {
            return setEditingMath(null);
        })} onInsert={(/**
             * 編集したLaTeX式と文字サイズを既存の数式ノードへ反映する。
             *
             * @param latex 描画または保存するLaTeX式
             * @param _block コールバックの契約上受け取るが、この処理では参照しないブロック
             * @param textSize 数式または本文へ適用する文字サイズ
             */
            function handleInsert38(latex, _block, textSize) {
                applyMathEdit(editingMath, latex, textSize);
                setEditingMath(null);
            })}/>}
    </div>);
}

// --------------------
// 補助関数
// --------------------

/**
 * 編集中の数式ノードが有効な場合だけ、LaTeX式と文字サイズを更新する。
 *
 * @param math 編集または表示する数式ブロック
 * @param latex 描画または保存するLaTeX式
 * @param textSize 数式または本文へ適用する文字サイズ
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
type ToolbarButtonProps = {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: (() => void) | undefined;
    children: React.ReactNode;
};

/**
 * リッチテキスト書式操作を、選択状態と無効状態が分かるツールバーボタンとして表示する。
 *
 * @param props ラベル、選択状態、無効状態、クリック処理、表示内容
 * @returns 書式ツールバーに表示するボタン
 */
function ToolbarButton(props: ToolbarButtonProps) {
    let { label, active, disabled, onClick, children } = props;
    return <button type="button" disabled={disabled} className={active ? "toolbar-button active" : "toolbar-button"} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
