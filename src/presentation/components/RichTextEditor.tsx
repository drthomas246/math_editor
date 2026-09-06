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
 * リッチ・テキスト・エディタの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param props リッチ・テキスト・エディタへ渡す表示情報と操作
 * @returns リッチ・テキスト・エディタを表示するReact要素
 */
export function RichTextEditor(props: Props) {
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
     * create・Memoizedをset・有効状態・リッチ・表・セルへ渡すコールバックとして安定化する。
     *
     * @param controller 編集状態とコマンドを提供するエディタ制御器
     */
    function createMemoizedCallback1(controller: RichTableCellEditorController | null) {
        activeRichTableCellRef.current = controller;
        setActiveRichTableCell(controller);
    }), []);
    const [selectedColor, setSelectedColor] = useState<ContentColor>(initialColor);
    const handleRichTableCellFocus = useCallback((/**
     * create・Memoizedをdeactivateへ渡すコールバックとして安定化する。
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
     * 外部状態とReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
     */
    function synchronizeLayoutEffect3() { onEditImageRef.current = onEditImage; }), [onEditImage]);
    const handleEditImage = useCallback((/**
     * create・Memoizedを更新前の値へ渡すコールバックとして安定化する。
     *
     * @param image 表示または編集する画像
     * @returns 更新前の値の結果
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
     * clearとReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
     */
    function synchronizeLayoutEffect6() {
        stableAssetUrls.clear();
        assetUrls.forEach((/**
         * 各安全性の検証または解放を行うURLについてZustand状態を更新する関数を実行し、対応関係または検証状態を更新する。
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
                 * セル・Toolbar・版番号をユーザー操作または非同期処理の結果に合わせて更新する。
                 */
                function onCellStateChangeCallback8() {
                    return setCellToolbarRevision((/**
                     * セル・Toolbar・版番号を現在の編集結果へ反映する。
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
         * 文字装飾をユーザー操作または非同期処理の結果に合わせて更新する。
         *
         * @param callbackInput let・{・エディタをまとめて受け取るコールバック入力
         */
        function onCreateCallback10(callbackInput) {
            let { editor: currentEditor } = callbackInput;
            if (initialColor === "answer")
                currentEditor.commands.setMark("answerColor");
        }),
        onUpdate: (/**
         * 更新の通知内容を、対応する編集状態・DOM・永続処理へ反映する。
         *
         * @param callbackInput let・{・エディタをまとめて受け取るコールバック入力
         * @returns on・Changeの結果
         */
        function onUpdateCallback11(callbackInput) {
            let { editor: currentEditor } = callbackInput;
            return onChange(normalize(currentEditor.getJSON()));
        }),
        onSelectionUpdate: (/**
         * Selected・色をユーザー操作または非同期処理の結果に合わせて更新する。
         *
         * @param callbackInput let・{・エディタをまとめて受け取るコールバック入力
         */
        function onSelectionUpdateCallback12(callbackInput) {
            let { editor: currentEditor } = callbackInput;
            return setSelectedColor(getSelectionContentColor(currentEditor));
        }),
    }, [tableCell, initialColor, canEditImages]);
    const previousAssetUrlsRef = useRef(assetUrls);
    useEffect((/**
     * set・PropsとReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
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
     * normalizeとReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
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
     * リッチ・表・数式・Inserterをユーザー操作または非同期処理の結果に合わせて更新する。
     */
    function openMathImplementation15() {
        if (activeRichTableCell)
            setRichTableMathInserter((/**
             * リッチ・表・数式・Inserterを現在の編集結果へ反映する。
             *
             * @returns 有効状態・リッチ・表・セルのinsert・数式
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
     * Selected・色をユーザー操作または非同期処理の結果に合わせて更新する。
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
         * 「入力色」要素のon・Changeを受け、対応する編集状態と画面表示を更新する。
         *
         * @param event 発生したイベント
         */
        function handleChange18(event) {
            return changeColor(event.target.value as ContentColor);
        })}><option value="problem">問題色（黒）</option><option value="answer">解答色（赤）</option></select>
      <span className="toolbar-separator"/>
    </>}
    <select aria-label="文字サイズ" defaultValue="normal" onChange={(/**
         * 「文字サイズ」要素のon・Changeを受け、対応する編集状態と画面表示を更新する。
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
     * 「太字」Toolbar・ボタン要素からクリック操作を受け、toggle・Boldを実行する。
     *
     */
    function handleClick20() {
        return activeRichTableCell ? activeRichTableCell.toggleBold() : editor.chain().focus().toggleBold().run();
    })}><Bold size={15}/></ToolbarButton>
    <ToolbarButton label="下線" active={activeRichTableCell?.isActive("underline") ?? editor.isActive("underline")} onClick={(/**
     * 「下線」Toolbar・ボタン要素からクリック操作を受け、toggle・Underlineを実行する。
     *
     */
    function handleClick21() {
        return activeRichTableCell ? activeRichTableCell.toggleUnderline() : editor.chain().focus().toggleUnderline().run();
    })}><UnderlineIcon size={15}/></ToolbarButton>
    <ToolbarButton label="斜体" active={activeRichTableCell?.isActive("italic") ?? editor.isActive("italic")} onClick={(/**
     * 「斜体」Toolbar・ボタン要素からクリック操作を受け、toggle・Italicを実行する。
     *
     */
    function handleClick22() {
        return activeRichTableCell ? activeRichTableCell.toggleItalic() : editor.chain().focus().toggleItalic().run();
    })}><Italic size={15}/></ToolbarButton>
    {!tableCell && <>
      <span className="toolbar-separator"/>
      <ToolbarButton label="箇条書き" disabled={Boolean(activeRichTableCell)} active={editor.isActive("bulletList")} onClick={(/**
         * 「箇条書き」Toolbar・ボタン要素からクリック操作を受け、runを実行する。
         *
         */
        function handleClick23() {
            return editor.chain().focus().toggleBulletList().run();
        })}><List size={16}/></ToolbarButton>
      <ToolbarButton label="番号付きリスト" disabled={Boolean(activeRichTableCell)} active={editor.isActive("orderedList")} onClick={(/**
         * 「番号付きリスト」Toolbar・ボタン要素からクリック操作を受け、runを実行する。
         *
         */
        function handleClick24() {
            return editor.chain().focus().toggleOrderedList().run();
        })}><ListOrdered size={16}/></ToolbarButton>
    </>}
    {hasInsertTools && <span className="toolbar-separator"/>}
    {(enableMath || tableCell) && <ToolbarButton label="数式" onClick={openMath}><Sigma size={16}/></ToolbarButton>}
    {onImage && <ToolbarButton label="画像" disabled={Boolean(activeRichTableCell)} onClick={(/**
     * 「画像」Toolbar・ボタン要素からクリック操作を受け、on・画像として親コンポーネントへ通知する。
     *
     */
    function handleClick25() {
        return onImage(selectedColor);
    })}><Image size={16}/></ToolbarButton>}
    {onTable && <ToolbarButton label="表" disabled={Boolean(activeRichTableCell)} onClick={(/**
     * 「表」Toolbar・ボタン要素からクリック操作を受け、on・表として親コンポーネントへ通知する。
     *
     */
    function handleClick26() {
        return onTable(selectedColor);
    })}><Table2 size={16}/></ToolbarButton>}
  </div>;
    return (<div className={`rich-editor ${compact ? "rich-editor-compact" : ""} ${tableCell ? "rich-editor-table-cell" : ""}`}>
      {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
      {activeRichTableCell && <TableStructureToolbar availability={activeRichTableCell.tableOperationAvailability} onOperation={(/**
             * 表・Structure・Toolbar要素から画面操作を受け、適用・表・操作を実行する。
             *
             * @param operation 計測または適用する操作
             */
            function handleOperation27(operation) {
                if (activeRichTableCell.applyTableOperation(operation))
                    updateActiveRichTableCell(null);
            })} sizing={{
                rowHeightMm: activeRichTableCell.tableSizing.rowHeightMm,
                columnWidthPercent: activeRichTableCell.tableSizing.columnWidthPercent,
                canResizeColumn: activeRichTableCell.tableSizing.canResizeColumn,
                onRowHeightChange: (/**
                 * 行・高さ・Mmをユーザー操作または非同期処理の結果に合わせて更新する。
                 *
                 * @param heightMm ミリメートル単位の高さ
                 */
                function onRowHeightChangeCallback28(heightMm) {
                    if (activeRichTableCell.tableSizing.setRowHeightMm(heightMm))
                        updateActiveRichTableCell(null);
                }),
                onColumnWidthChange: (/**
                 * 列・幅・Percentをユーザー操作または非同期処理の結果に合わせて更新する。
                 *
                 * @param widthPercent 表全体に対する列幅の割合
                 */
                function onColumnWidthChangeCallback29(widthPercent) {
                    if (activeRichTableCell.tableSizing.setColumnWidthPercent(widthPercent))
                        updateActiveRichTableCell(null);
                }),
            }}/>}
      <div onPointerDownCapture={(/**
         * div要素から画面操作を受け、closestを実行する。
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
         * 数式・ダイアログ要素から終了要求を受け、数式・Openを操作内容に合う状態へ更新する。
         */
        function handleClose31() {
            return setMathOpen(false);
        })} onInsert={(/**
             * 数式・ダイアログ要素から挿入要求を受け、insert・数式・位置・選択を実行する。
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
         * 数式・ダイアログ要素から終了要求を受け、セル・数式・Openを操作内容に合う状態へ更新する。
         */
        function handleClose33() {
            return setCellMathOpen(false);
        })} onInsert={(/**
             * 数式・ダイアログ要素から挿入要求を受け、insert・数式・位置・選択を実行する。
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
         * 数式・ダイアログ要素から終了要求を受け、リッチ・表・数式・Inserterを操作内容に合う状態へ更新する。
         */
        function handleClose35() {
            return setRichTableMathInserter(null);
        })} onInsert={(/**
             * 数式・ダイアログ要素から挿入要求を受け、リッチ・表・数式・Inserterを実行する。
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
         * 数式・ダイアログ要素から終了要求を受け、Editing・数式を操作内容に合う状態へ更新する。
         */
        function handleClose37() {
            return setEditingMath(null);
        })} onInsert={(/**
             * 数式・ダイアログ要素から挿入要求を受け、適用・数式・Editを実行する。
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
 * 数式・Editを現在の編集結果へ反映する。
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
/**
 * リッチテキスト書式操作を、選択状態と無効状態が分かるツールバーボタンとして表示する。
 *
 * @param props Toolbar・ボタンへ渡す表示情報と操作
 * @returns Toolbar・ボタンを表示するReact要素
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
