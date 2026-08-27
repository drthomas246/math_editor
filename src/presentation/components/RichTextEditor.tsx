import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Image, Italic, List, ListOrdered, Sigma, Table2, Underline as UnderlineIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export function RichTextEditor({ document, onChange, placeholder = "ここに問題文を入力…", compact, tableCell = false, toolbarContainer, enableMath = false, initialColor = "problem", showColorSelector = true, onImage, onEditImage, onTable, assetUrls = EMPTY_ASSET_URLS }: Props) {
  const [mathOpen, setMathOpen] = useState(false);
  const [cellMathOpen, setCellMathOpen] = useState(false);
  const [editingMath, setEditingMath] = useState<EditableMathRef | null>(null);
  const [activeRichTableCell, setActiveRichTableCell] = useState<RichTableCellEditorController | null>(null);
  const [selectedColor, setSelectedColor] = useState<ContentColor>(initialColor);
  const [, setCellToolbarRevision] = useState(0);
  const [richTableMathInserter, setRichTableMathInserter] = useState<((latex: string, textSize: MathTextSize, color: ContentColor) => void) | null>(null);
  const onEditImageRef = useRef(onEditImage);
  onEditImageRef.current = onEditImage;
  const stableAssetUrlsRef = useRef(new Map(assetUrls));
  stableAssetUrlsRef.current.clear();
  assetUrls.forEach((url, assetId) => stableAssetUrlsRef.current.set(assetId, url));
  const stableAssetUrls = stableAssetUrlsRef.current;
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
      ImageRef.configure({ assetUrls: stableAssetUrls, onEdit: onEditImage ? (image) => onEditImageRef.current?.(image) : null }),
      RichTable.configure({
        assetUrls: stableAssetUrls,
        onCellFocus: (controller) => setActiveRichTableCell((current) => {
          if (current && current !== controller) current.deactivate();
          setSelectedColor(controller.isActive("answerColor") ? "answer" : "problem");
          return controller;
        }),
        onCellStateChange: () => setCellToolbarRevision((revision) => revision + 1),
        onEditMath: setEditingMath,
      }),
    ],
    content: normalize(document as JSONContent) as unknown as JSONContent,
    editorProps: { attributes: { class: "rich-editor-content", "aria-label": placeholder } },
    onCreate: ({ editor: currentEditor }) => {
      if (initialColor === "answer") currentEditor.commands.setMark("answerColor");
    },
    onUpdate: ({ editor: currentEditor }) => onChange(normalize(currentEditor.getJSON())),
    onSelectionUpdate: ({ editor: currentEditor }) => setSelectedColor(getSelectionContentColor(currentEditor)),
  }, [tableCell, initialColor]);

  const previousAssetUrlsRef = useRef(assetUrls);
  useEffect(() => {
    if (previousAssetUrlsRef.current === assetUrls) return;
    previousAssetUrlsRef.current = assetUrls;
    if (!editor || editor.isDestroyed) return;
    // Rebuild only the node views so image URLs are refreshed while the
    // TipTap editor instance, document, history, and selection stay intact.
    editor.view.setProps({ nodeViews: {} });
    editor.createNodeViews();
  }, [assetUrls, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    const next = normalize(document as JSONContent);
    const current = normalize(editor.getJSON());
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      editor.commands.setContent(next as unknown as JSONContent, { emitUpdate: false });
    }
  }, [document, editor, normalize]);

  if (!editor) return null;
  const openMath = () => {
    if (activeRichTableCell) setRichTableMathInserter(() => activeRichTableCell.insertMath);
    else if (tableCell) setCellMathOpen(true);
    else if (enableMath) setMathOpen(true);
  };
  const changeColor = (color: ContentColor) => {
    setSelectedColor(color);
    if (activeRichTableCell) activeRichTableCell.setContentColor(color);
    else setSelectionContentColor(editor, color);
  };
  const toolbar = <div className="rich-toolbar" aria-label="書式ツールバー">
    {showColorSelector && <>
      <select className={`content-color-select ${selectedColor}`} aria-label="入力色" value={selectedColor} onChange={(event) => changeColor(event.target.value as ContentColor)}><option value="problem">問題色（黒）</option><option value="answer">解答色（赤）</option></select>
      <span className="toolbar-separator" />
    </>}
    <select aria-label="文字サイズ" defaultValue="normal" onChange={(event) => {
      const size = event.target.value;
      if (activeRichTableCell) activeRichTableCell.setTextSize(size);
      else if (size === "normal") editor.chain().focus().unsetMark("textSize").run();
      else editor.chain().focus().setMark("textSize", { size }).run();
    }}><option value="small">小</option><option value="normal">標準</option><option value="large">大</option><option value="xLarge">特大</option></select>
    <span className="toolbar-separator" />
    <ToolbarButton label="太字" active={activeRichTableCell?.isActive("bold") ?? editor.isActive("bold")} onClick={() => activeRichTableCell ? activeRichTableCell.toggleBold() : editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
    <ToolbarButton label="下線" active={activeRichTableCell?.isActive("underline") ?? editor.isActive("underline")} onClick={() => activeRichTableCell ? activeRichTableCell.toggleUnderline() : editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
    <ToolbarButton label="斜体" active={activeRichTableCell?.isActive("italic") ?? editor.isActive("italic")} onClick={() => activeRichTableCell ? activeRichTableCell.toggleItalic() : editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
    {!tableCell && <>
      <span className="toolbar-separator" />
      <ToolbarButton label="箇条書き" disabled={Boolean(activeRichTableCell)} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
      <ToolbarButton label="番号付きリスト" disabled={Boolean(activeRichTableCell)} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton>
    </>}
    {hasInsertTools && <span className="toolbar-separator" />}
    {(enableMath || tableCell) && <ToolbarButton label="数式" onClick={openMath}><Sigma size={16} /></ToolbarButton>}
    {onImage && <ToolbarButton label="画像" disabled={Boolean(activeRichTableCell)} onClick={() => onImage(selectedColor)}><Image size={16} /></ToolbarButton>}
    {onTable && <ToolbarButton label="表" disabled={Boolean(activeRichTableCell)} onClick={() => onTable(selectedColor)}><Table2 size={16} /></ToolbarButton>}
  </div>;
  return (
    <div className={`rich-editor ${compact ? "rich-editor-compact" : ""} ${tableCell ? "rich-editor-table-cell" : ""}`}>
      {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
      {activeRichTableCell && <TableStructureToolbar
        availability={activeRichTableCell.tableOperationAvailability}
        onOperation={(operation) => {
          if (activeRichTableCell.applyTableOperation(operation)) setActiveRichTableCell(null);
        }}
        sizing={{
          rowHeightMm: activeRichTableCell.tableSizing.rowHeightMm,
          columnWidthPercent: activeRichTableCell.tableSizing.columnWidthPercent,
          canResizeColumn: activeRichTableCell.tableSizing.canResizeColumn,
          onRowHeightChange: (heightMm) => {
            if (activeRichTableCell.tableSizing.setRowHeightMm(heightMm)) setActiveRichTableCell(null);
          },
          onColumnWidthChange: (widthPercent) => {
            if (activeRichTableCell.tableSizing.setColumnWidthPercent(widthPercent)) setActiveRichTableCell(null);
          },
        }}
      />}
      <div onPointerDownCapture={(event) => {
        if (!(event.target as HTMLElement).closest("[data-rich-table]")) {
          activeRichTableCell?.deactivate();
          setActiveRichTableCell(null);
        }
      }}><EditorContent editor={editor} /></div>
      {mathOpen && <MathDialog onClose={() => setMathOpen(false)} onInsert={(latex, block, textSize) => {
        insertMathAtSelection(editor, latex, block, textSize, selectedColor);
        setMathOpen(false);
      }} />}
      {cellMathOpen && <MathDialog inlineOnly onClose={() => setCellMathOpen(false)} onInsert={(latex, _block, textSize) => {
        insertMathAtSelection(editor, latex, false, textSize, selectedColor);
        setCellMathOpen(false);
      }} />}
      {richTableMathInserter && <MathDialog inlineOnly onClose={() => setRichTableMathInserter(null)} onInsert={(latex, _block, textSize) => {
        richTableMathInserter(latex, textSize, selectedColor);
        setRichTableMathInserter(null);
      }} />}
      {editingMath && <MathDialog initial={{ latex: editingMath.latex, block: editingMath.block, textSize: editingMath.textSize }} onClose={() => setEditingMath(null)} onInsert={(latex, _block, textSize) => {
        applyMathEdit(editingMath, latex, textSize);
        setEditingMath(null);
      }} />}
    </div>
  );
}

function applyMathEdit(math: EditableMathRef, latex: string, textSize: MathTextSize): void {
  if (math.editor.isDestroyed) return;
  const node = math.editor.state.doc.nodeAt(math.position);
  const expectedType = math.block ? "blockMath" : "inlineMath";
  if (!node || node.type.name !== expectedType) return;
  math.editor.view.dispatch(math.editor.state.tr.setNodeMarkup(math.position, undefined, { ...node.attrs, latex, textSize }));
  math.editor.commands.focus();
}

function ToolbarButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: (() => void) | undefined; children: React.ReactNode }) {
  return <button type="button" disabled={disabled} className={active ? "toolbar-button active" : "toolbar-button"} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
