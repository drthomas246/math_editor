import { Editor, Extension, Mark, mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { ContentColor } from "../../domain/worksheet/rich-text";
import type { BasicRichTextDocument, ImagePlacement, ImageWidthPercent, RichTextMark, TableCellRichTextDocument, TableRow } from "../../domain/worksheet/worksheet";
import { applyTableOperation, getTableCellLocation, getTableOperationAvailability, setTableColumnWidth, setTableRowHeight, type TableOperation, type TableOperationAvailability } from "../../domain/worksheet/table-operations";
import { getMathAriaLabel, renderMathMarkup } from "./MathFormula";

export type MathTextSize = "small" | "normal" | "large" | "xLarge";

export function insertMathAtSelection(editor: Editor, latex: string, block: boolean, textSize: MathTextSize, color: ContentColor = "problem"): void {
  const math = { type: block ? "blockMath" : "inlineMath", attrs: { latex, textSize, answerColor: color === "answer" } };
  const content = block
    ? math
    : [{ type: "text", text: " " }, math, { type: "text", text: " " }];
  editor.chain().focus().insertContent(content).run();
}

const COLORABLE_NODE_TYPES = new Set(["inlineMath", "blockMath", "imageRef", "richTable"]);

export function setSelectionContentColor(editor: Editor, color: ContentColor): void {
  if (editor.isDestroyed) return;
  const { selection } = editor.state;
  let transaction = editor.state.tr;
  let changedNode = false;
  editor.state.doc.nodesBetween(selection.from, selection.to, (node, position) => {
    if (!COLORABLE_NODE_TYPES.has(node.type.name)) return true;
    transaction = transaction.setNodeMarkup(position, undefined, { ...node.attrs, answerColor: color === "answer" });
    changedNode = true;
    return false;
  });
  if (changedNode) editor.view.dispatch(transaction);
  const chain = editor.chain().focus();
  if (color === "answer") chain.setMark("answerColor").run();
  else chain.unsetMark("answerColor").run();
}

export function getSelectionContentColor(editor: Editor): ContentColor {
  if (editor.isActive("answerColor")) return "answer";
  const { selection } = editor.state;
  let answerNodeSelected = false;
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (COLORABLE_NODE_TYPES.has(node.type.name) && node.attrs.answerColor === true) answerNodeSelected = true;
    return !answerNodeSelected;
  });
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

function isMathTextSize(value: unknown): value is MathTextSize {
  return value === "small" || value === "normal" || value === "large" || value === "xLarge";
}

function createMathNodeView(block: boolean, onEdit: MathNodeOptions["onEdit"]) {
  return ({ node, editor, getPos }: { node: { type: { name: string }; attrs: Record<string, unknown> }; editor: Editor; getPos: () => number | undefined }) => {
    const dom = document.createElement(block ? "div" : "span");

    const render = (attrs: Record<string, unknown>) => {
      const latex = String(attrs.latex ?? "");
      const textSize = isMathTextSize(attrs.textSize) ? attrs.textSize : "normal";
      dom.className = `math-node ${block ? "math-node-block" : "math-node-inline"} math-size-${textSize}${attrs.answerColor === true ? " answer-color" : ""}`;
      dom.dataset.mathNode = block ? "block" : "inline";
      dom.dataset.latex = latex;
      dom.contentEditable = "false";
      dom.setAttribute("role", "math");
      dom.setAttribute("aria-label", getMathAriaLabel(latex));

      const markup = renderMathMarkup(latex, block);
      if (markup) dom.innerHTML = markup;
      else dom.textContent = latex;

      if (onEdit) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "math-node-edit-button";
        editButton.textContent = "編集";
        editButton.setAttribute("aria-label", "数式を編集");
        editButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const position = getPos();
          if (typeof position !== "number") return;
          onEdit({ editor, position, latex, textSize, block });
        });
        dom.append(editButton);
      }
    };

    render(node.attrs);

    return {
      dom,
      ignoreMutation: () => true,
      selectNode: () => dom.classList.add("math-node-selected"),
      deselectNode: () => dom.classList.remove("math-node-selected"),
      update: (nextNode: typeof node) => {
        if (nextNode.type.name !== node.type.name) return false;
        node = nextNode;
        render(nextNode.attrs);
        return true;
      },
      stopEvent: (event: Event) => event.target instanceof HTMLElement && Boolean(event.target.closest(".math-node-edit-button")),
    };
  };
}

export const InlineMath = Node.create<MathNodeOptions>({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { onEdit: null };
  },

  addAttributes() {
    return {
      latex: { default: "" },
      textSize: { default: "normal" },
      answerColor: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: '[data-math-node="inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-node": "inline" })];
  },

  addNodeView() {
    return createMathNodeView(false, this.options.onEdit);
  },
});

export const BlockMath = Node.create<MathNodeOptions>({
  name: "blockMath",
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return { onEdit: null };
  },

  addAttributes() {
    return {
      latex: { default: "" },
      textSize: { default: "normal" },
      answerColor: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: '[data-math-node="block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-node": "block" })];
  },

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

  addOptions() {
    return { assetUrls: new Map(), onEdit: null };
  },

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

  parseHTML() {
    return [{ tag: "[data-image-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-image-ref": "" })];
  },

  addNodeView() {
    const assetUrls = this.options.assetUrls;
    return ({ node }) => {
      const dom = document.createElement("div");

      const render = (attrs: Record<string, unknown>) => {
        const id = String(attrs.id ?? "");
        const assetId = String(attrs.assetId ?? "");
        const placement = isImagePlacement(attrs.placement) ? attrs.placement : "block";
        const widthPercent = normalizeImageWidth(attrs.widthPercent, placement);
        const url = assetUrls.get(assetId);
        const answerColor = attrs.answerColor === true;
        dom.className = `editor-image-ref ${placement}${answerColor ? " answer-color" : ""}`;
        dom.dataset.imageRef = "";
        dom.dataset.imageId = id;
        dom.dataset.assetId = assetId;
        dom.style.width = `${widthPercent}%`;
        dom.title = this.options.onEdit ? "画像を編集" : "";
        dom.contentEditable = "false";
        dom.replaceChildren();

        if (url) {
          const image = document.createElement("img");
          image.src = url;
          image.alt = String(attrs.alt ?? "");
          dom.append(image);
        } else {
          const missing = document.createElement("span");
          missing.className = "editor-missing-asset";
          missing.textContent = "画像を読み込めません";
          dom.append(missing);
        }

        if (this.options.onEdit) {
          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.className = "editor-image-edit-button";
          editButton.textContent = "編集";
          editButton.setAttribute("aria-label", "画像を編集");
          editButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.options.onEdit?.({
              id,
              assetId,
              alt: String(attrs.alt ?? ""),
              placement,
              widthPercent,
              ...(answerColor ? { answerColor: true } : {}),
            });
          });
          dom.append(editButton);
        }
      };

      render(node.attrs);
      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => dom.classList.add("selected"),
        deselectNode: () => dom.classList.remove("selected"),
        update: (nextNode) => {
          if (nextNode.type.name !== node.type.name) return false;
          node = nextNode;
          render(nextNode.attrs);
          return true;
        },
        stopEvent: (event) => event.target instanceof HTMLElement && Boolean(event.target.closest(".editor-image-edit-button")),
      };
    };
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

  addOptions() {
    return { assetUrls: new Map(), onCellFocus: () => undefined, onCellStateChange: () => undefined, onEditMath: null };
  },

  addAttributes() {
    return {
      id: { default: "" },
      rows: { default: [] },
      columnWidthsPercent: { default: [] },
      headerRow: { default: false },
      answerColor: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: "[data-rich-table]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-rich-table": "" })];
  },

  addNodeView() {
    return ({ node, editor: outerEditor, getPos }) => {
      const dom = document.createElement("div");
      const cellElements = new Map<string, HTMLTableCellElement>();
      let activeCellId: string | null = null;
      let cellEditor: Editor | null = null;
      let structureKey = "";

      const findCell = (cellId: string) => {
        const rows = Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [];
        const columnWidthsPercent = Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [];
        for (const [rowIndex, row] of rows.entries()) {
          const cellIndex = row.cells.findIndex((cell) => cell.id === cellId);
          if (cellIndex >= 0) {
            const logical = getTableCellLocation({ rows, columnWidthsPercent }, cellId);
            return { cell: row.cells[cellIndex]!, rowIndex, cellIndex: logical?.column ?? cellIndex };
          }
        }
        return null;
      };

      const updateCellDocument = (cellId: string, documentValue: TableCellRichTextDocument) => {
        const position = getPos();
        if (typeof position !== "number") return;
        const nextRows = structuredClone(Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : []);
        for (const row of nextRows) {
          const cell = row.cells.find((item) => item.id === cellId);
          if (!cell) continue;
          cell.document = documentValue;
          outerEditor.view.dispatch(outerEditor.view.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, rows: nextRows }));
          return;
        }
      };

      const showCellPreview = (cellId: string) => {
        const location = findCell(cellId);
        const tableCell = cellElements.get(cellId);
        if (!location || !tableCell) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "table-cell-select editor-table-cell-select";
        button.setAttribute("aria-label", `${location.rowIndex + 1}行${location.cellIndex + 1}列を編集`);
        renderTableCellDocumentPreview(button, location.cell.document, this.options.assetUrls);
        button.addEventListener("click", () => activateCell(cellId));
        tableCell.classList.remove("active");
        tableCell.replaceChildren(button);
      };

      const deactivateCell = () => {
        const previousCellId = activeCellId;
        activeCellId = null;
        cellEditor?.destroy();
        cellEditor = null;
        if (previousCellId) showCellPreview(previousCellId);
      };

      const activateCell = (cellId: string) => {
        if (activeCellId === cellId && cellEditor) {
          cellEditor.commands.focus();
          return;
        }
        deactivateCell();
        const location = findCell(cellId);
        const tableCell = cellElements.get(cellId);
        if (!location || !tableCell) return;

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
            InlineMath.configure({ onEdit: this.options.onEditMath }),
            ImageRef.configure({ assetUrls: this.options.assetUrls }),
          ],
          content: normalizeTableCellEditorDocument(location.cell.document as JSONContent) as unknown as JSONContent,
          editorProps: {
            attributes: {
              class: "rich-editor-content table-cell-wysiwyg-content",
              "aria-label": `${location.rowIndex + 1}行${location.cellIndex + 1}列`,
            },
          },
          onUpdate: ({ editor: currentEditor }) => {
            updateCellDocument(cellId, normalizeTableCellEditorDocument(currentEditor.getJSON()));
          },
          onSelectionUpdate: () => this.options.onCellStateChange(),
          onTransaction: () => this.options.onCellStateChange(),
        });
        cellEditor = nestedEditor;

        const currentTable = {
          rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
          columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
        };
        const currentLocation = getTableCellLocation(currentTable, cellId);
        const commitTableData = (nextTable: { rows: TableRow[]; columnWidthsPercent: number[] } | null) => {
          const position = getPos();
          if (typeof position !== "number" || !nextTable) return false;
          deactivateCell();
          outerEditor.view.dispatch(outerEditor.view.state.tr.setNodeMarkup(position, undefined, {
            ...node.attrs,
            rows: nextTable.rows,
            columnWidthsPercent: nextTable.columnWidthsPercent,
          }));
          return true;
        };
        const controller: RichTableCellEditorController = {
          applyTableOperation: (operation) => {
            const latestTable = {
              rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
              columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
            };
            const result = applyTableOperation(latestTable, cellId, operation);
            return commitTableData(result);
          },
          deactivate: () => {
            if (activeCellId === cellId) deactivateCell();
          },
          insertMath: (latex, textSize, color) => {
            if (!nestedEditor.isDestroyed) insertMathAtSelection(nestedEditor, latex, false, textSize, color);
          },
          isActive: (name) => !nestedEditor.isDestroyed && nestedEditor.isActive(name),
          setContentColor: (color) => {
            if (nestedEditor.isDestroyed) return;
            const chain = nestedEditor.chain().focus();
            if (color === "answer") chain.setMark("answerColor").run();
            else chain.unsetMark("answerColor").run();
          },
          setTextSize: (size) => {
            if (nestedEditor.isDestroyed) return;
            if (size === "normal") nestedEditor.chain().focus().unsetMark("textSize").run();
            else nestedEditor.chain().focus().setMark("textSize", { size }).run();
          },
          tableOperationAvailability: getTableOperationAvailability(currentTable, cellId),
          tableSizing: {
            rowHeightMm: currentLocation ? currentTable.rows[currentLocation.row]?.heightMm ?? null : null,
            columnWidthPercent: currentLocation ? currentTable.columnWidthsPercent[currentLocation.column] ?? 100 : 100,
            canResizeColumn: currentTable.columnWidthsPercent.length > 1,
            setRowHeightMm: (heightMm) => {
              const latestTable = {
                rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
              };
              const latestLocation = getTableCellLocation(latestTable, cellId);
              return latestLocation ? commitTableData(setTableRowHeight(latestTable, latestLocation.row, heightMm)) : false;
            },
            setColumnWidthPercent: (widthPercent) => {
              const latestTable = {
                rows: Array.isArray(node.attrs.rows) ? node.attrs.rows as TableRow[] : [],
                columnWidthsPercent: Array.isArray(node.attrs.columnWidthsPercent) ? node.attrs.columnWidthsPercent as number[] : [],
              };
              const latestLocation = getTableCellLocation(latestTable, cellId);
              return latestLocation ? commitTableData(setTableColumnWidth(latestTable, latestLocation.column, widthPercent)) : false;
            },
          },
          toggleBold: () => { if (!nestedEditor.isDestroyed) nestedEditor.chain().focus().toggleBold().run(); },
          toggleItalic: () => { if (!nestedEditor.isDestroyed) nestedEditor.chain().focus().toggleItalic().run(); },
          toggleUnderline: () => { if (!nestedEditor.isDestroyed) nestedEditor.chain().focus().toggleUnderline().run(); },
        };
        nestedEditor.on("focus", () => this.options.onCellFocus(controller));
        this.options.onCellFocus(controller);
        nestedEditor.commands.focus("end");
      };

      const render = (attrs: Record<string, unknown>) => {
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
          if (Number.isFinite(width) && width > 0) column.style.width = `${width}%`;
          columnGroup.append(column);
        }

        for (const [rowIndex, row] of rows.entries()) {
          const tableRow = document.createElement("tr");
          if (row.heightMm) tableRow.style.height = `${row.heightMm}mm`;
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
        for (const row of rows) for (const cell of row.cells) showCellPreview(cell.id);
      };

      render(node.attrs);
      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => dom.classList.add("selected"),
        deselectNode: () => dom.classList.remove("selected"),
        update: (nextNode) => {
          if (nextNode.type.name !== node.type.name) return false;
          if (getTableStructureKey(nextNode.attrs) !== structureKey) return false;
          node = nextNode;
          const rows = Array.isArray(nextNode.attrs.rows) ? nextNode.attrs.rows as TableRow[] : [];
          for (const row of rows) {
            for (const cell of row.cells) {
              if (cell.id !== activeCellId) showCellPreview(cell.id);
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
        },
        stopEvent: (event) => event.target instanceof globalThis.Node && dom.contains(event.target),
        destroy: () => cellEditor?.destroy(),
      };
    };
  },
});

function renderTableCellDocumentPreview(container: HTMLElement, documentValue: TableCellRichTextDocument, assetUrls: ReadonlyMap<string, string>): void {
  container.replaceChildren();
  const visible = documentValue.content.some((node) => node.type === "imageRef" || node.content.length > 0);
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
      } else {
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
      } else if (inline.type === "inlineMath") {
        const math = document.createElement("span");
        math.className = `math-formula math-formula-inline math-size-${inline.attrs.textSize}${inline.attrs.answerColor ? " answer-color" : ""}`;
        math.dataset.latex = inline.attrs.latex;
        math.setAttribute("role", "math");
        math.setAttribute("aria-label", getMathAriaLabel(inline.attrs.latex));
        const markup = renderMathMarkup(inline.attrs.latex, false);
        if (markup) math.innerHTML = markup;
        else math.textContent = inline.attrs.latex;
        paragraph.append(math);
      } else {
        let rendered: globalThis.Node = document.createTextNode(inline.text);
        for (const mark of inline.marks ?? []) {
          const wrapper = document.createElement(mark.type === "bold" ? "strong" : mark.type === "underline" ? "u" : mark.type === "italic" ? "em" : "span");
          if (mark.type === "textSize") wrapper.className = `text-size-${mark.attrs.size}`;
          if (mark.type === "answerColor") wrapper.className = "answer-color";
          wrapper.append(rendered);
          rendered = wrapper;
        }
        paragraph.append(rendered);
      }
    }
    container.append(paragraph);
  }
}

function getTableStructureKey(attrs: Record<string, unknown>): string {
  const rows = Array.isArray(attrs.rows) ? attrs.rows as TableRow[] : [];
  const widths = Array.isArray(attrs.columnWidthsPercent) ? attrs.columnWidthsPercent : [];
  return JSON.stringify({
    headerRow: Boolean(attrs.headerRow),
    answerColor: Boolean(attrs.answerColor),
    widths,
    rows: rows.map((row) => ({
      id: row.id,
      heightMm: row.heightMm ?? null,
      cells: row.cells.map((cell) => ({ id: cell.id, rowSpan: cell.rowSpan, columnSpan: cell.columnSpan })),
    })),
  });
}

export const ParagraphTextAlign = Extension.create({
  name: "worksheetParagraphTextAlign",

  addGlobalAttributes() {
    return [{
      types: ["paragraph"],
      attributes: {
        textAlign: {
          default: "left",
          parseHTML: (element) => element.style.textAlign || "left",
          renderHTML: (attributes) => ({ style: `text-align: ${String(attributes.textAlign ?? "left")}` }),
        },
      },
    }];
  },
});

export const TextSize = Mark.create({
  name: "textSize",

  addAttributes() {
    return {
      size: {
        default: "large",
        parseHTML: (element) => element.getAttribute("data-text-size") ?? "large",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-text-size]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, {
      "data-text-size": HTMLAttributes.size,
      class: `text-size-${String(HTMLAttributes.size)}`,
    }), 0];
  },
});

export const AnswerColor = Mark.create({
  name: "answerColor",

  parseHTML() {
    return [{ tag: "span[data-answer-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, {
      "data-answer-color": "true",
      class: "answer-color",
    }), 0];
  },
});

function normalizeMarks(marks: JSONContent["marks"]): RichTextMark[] | undefined {
  if (!marks) return undefined;
  const normalized: RichTextMark[] = [];
  const seen = new Set<string>();

  for (const mark of marks) {
    if (seen.has(mark.type)) continue;
    if (mark.type === "bold" || mark.type === "underline" || mark.type === "italic" || mark.type === "answerColor") {
      normalized.push({ type: mark.type });
      seen.add(mark.type);
    } else if (mark.type === "textSize") {
      const size = mark.attrs?.size;
      if (size === "small" || size === "large" || size === "xLarge") {
        normalized.push({ type: "textSize", attrs: { size } });
        seen.add(mark.type);
      }
    }
  }

  return normalized.length ? normalized : undefined;
}

function normalizeInlineNode(node: JSONContent): Record<string, unknown> | null {
  if (node.type === "text" && typeof node.text === "string" && node.text.length > 0) {
    const marks = normalizeMarks(node.marks);
    return { type: "text", text: node.text, ...(marks ? { marks } : {}) };
  }
  if (node.type === "hardBreak") return { type: "hardBreak" };
  if (node.type === "inlineMath") {
    const latex = String(node.attrs?.latex ?? "");
    if (!latex.trim()) return null;
    const textSize = isMathTextSize(node.attrs?.textSize) ? node.attrs.textSize : "normal";
    return { type: "inlineMath", attrs: { latex, textSize, ...(node.attrs?.answerColor === true ? { answerColor: true } : {}) } };
  }
  return null;
}

function normalizeParagraph(node: JSONContent): Record<string, unknown> {
  const textAlign = ["left", "center", "right"].includes(String(node.attrs?.textAlign))
    ? String(node.attrs?.textAlign)
    : "left";
  const content = (node.content ?? []).map(normalizeInlineNode).filter((item) => item !== null);
  return { type: "paragraph", attrs: { textAlign }, content };
}

function normalizeListItem(node: JSONContent): Record<string, unknown> {
  const content = (node.content ?? [])
    .filter((child) => child.type === "paragraph")
    .map(normalizeParagraph);
  return {
    type: "listItem",
    content: content.length ? content : [normalizeParagraph({ type: "paragraph" })],
  };
}

function normalizeBlockNode(node: JSONContent): Record<string, unknown> | null {
  if (node.type === "paragraph") return normalizeParagraph(node);
  if (node.type === "bulletList" || node.type === "orderedList") {
    const content = (node.content ?? [])
      .filter((child) => child.type === "listItem")
      .map(normalizeListItem);
    if (!content.length) return null;
    if (node.type === "orderedList") {
      const rawStart = Number(node.attrs?.start);
      return { type: "orderedList", attrs: { start: Number.isInteger(rawStart) && rawStart > 0 ? rawStart : 1 }, content };
    }
    return { type: "bulletList", content };
  }
  if (node.type === "blockMath") {
    const latex = String(node.attrs?.latex ?? "");
    if (!latex.trim()) return null;
    const textSize = isMathTextSize(node.attrs?.textSize) ? node.attrs.textSize : "normal";
    return { type: "blockMath", attrs: { latex, textSize, ...(node.attrs?.answerColor === true ? { answerColor: true } : {}) } };
  }
  if (node.type === "imageRef") {
    const id = String(node.attrs?.id ?? "");
    const assetId = String(node.attrs?.assetId ?? "");
    if (!id || !assetId) return null;
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
    if (!id || !Array.isArray(rows) || !Array.isArray(columnWidthsPercent)) return null;
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

function isImagePlacement(value: unknown): value is "block" | "floatLeft" | "floatRight" {
  return value === "block" || value === "floatLeft" || value === "floatRight";
}

function normalizeImageWidth(value: unknown, placement: "block" | "floatLeft" | "floatRight"): 25 | 33 | 50 | 66 | 75 | 100 {
  const allowed = placement === "block" ? [25, 33, 50, 66, 75, 100] : [25, 33, 50];
  const width = Number(value);
  return (allowed.includes(width) ? width : 50) as 25 | 33 | 50 | 66 | 75 | 100;
}

export function normalizeEditorDocument(document: JSONContent): BasicRichTextDocument {
  const content = (document.content ?? []).map(normalizeBlockNode).filter((item) => item !== null);
  return {
    type: "doc",
    content: (content.length ? content : [normalizeParagraph({ type: "paragraph" })]) as BasicRichTextDocument["content"],
  };
}

export function normalizeTableCellEditorDocument(document: JSONContent): TableCellRichTextDocument {
  const normalized = normalizeEditorDocument(document);
  const content = normalized.content.filter((node) => node.type === "paragraph" || node.type === "imageRef");
  return {
    type: "doc",
    content: content.length ? content : [normalizeParagraph({ type: "paragraph" }) as TableCellRichTextDocument["content"][number]],
  };
}
