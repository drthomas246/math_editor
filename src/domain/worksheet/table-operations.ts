import { STRUCTURE_LIMITS } from "./structure-limits";
import type { TableCell, TableCellRichTextDocument, TableRow } from "./worksheet";
import { createId } from "./worksheet.defaults";

export type EditableTableData = {
  rows: TableRow[];
  columnWidthsPercent: number[];
};

export type TableOperation =
  | "insertRowAbove"
  | "insertRowBelow"
  | "deleteRow"
  | "insertColumnLeft"
  | "insertColumnRight"
  | "deleteColumn"
  | "mergeRight"
  | "mergeDown"
  | "splitCell";

export type TableOperationAvailability = Record<TableOperation, boolean>;

export type TableCellLocation = {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
};

export type TableOperationResult = EditableTableData & {
  activeCellId: string;
};

export const TABLE_ROW_HEIGHT_MM = { min: 5, max: 100 } as const;
export const TABLE_COLUMN_WIDTH_PERCENT = { min: 1, max: 99 } as const;

type PlacedCell = TableCellLocation & { cell: TableCell };

type TableLayout = {
  placed: PlacedCell[];
  grid: string[][];
};

const emptyCellDocument = (): TableCellRichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
});

const createEmptyCell = (): TableCell => ({
  id: createId(),
  document: emptyCellDocument(),
  rowSpan: 1,
  columnSpan: 1,
});

function buildLayout(table: EditableTableData): TableLayout {
  const rowCount = table.rows.length;
  const columnCount = table.columnWidthsPercent.length;
  const grid = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ""));
  const placed: PlacedCell[] = [];

  for (const [row, tableRow] of table.rows.entries()) {
    let column = 0;
    for (const cell of tableRow.cells) {
      while (column < columnCount && grid[row]?.[column]) column += 1;
      placed.push({ cell, row, column, rowSpan: cell.rowSpan, columnSpan: cell.columnSpan });
      for (let targetRow = row; targetRow < row + cell.rowSpan; targetRow += 1) {
        for (let targetColumn = column; targetColumn < column + cell.columnSpan; targetColumn += 1) {
          const gridRow = grid[targetRow];
          if (gridRow && targetColumn < columnCount) gridRow[targetColumn] = cell.id;
        }
      }
      column += cell.columnSpan;
    }
  }

  return { placed, grid };
}

function clonePlacedCells(table: EditableTableData): PlacedCell[] {
  return buildLayout(table).placed.map((item) => ({ ...item, cell: structuredClone(item.cell) }));
}

type TableRowMetadata = Pick<TableRow, "id" | "heightMm">;

function rebuildRows(rowMetadata: TableRowMetadata[], placed: PlacedCell[]): TableRow[] {
  return rowMetadata.map((metadata, row) => ({
    id: metadata.id,
    ...(metadata.heightMm !== undefined ? { heightMm: metadata.heightMm } : {}),
    cells: placed
      .filter((item) => item.row === row)
      .sort((left, right) => left.column - right.column)
      .map((item) => ({ ...item.cell, rowSpan: item.rowSpan, columnSpan: item.columnSpan })),
  }));
}

function isEmptyDocument(documentValue: TableCellRichTextDocument): boolean {
  return documentValue.content.every((node) => node.type === "paragraph" && node.content.length === 0);
}

function mergeDocuments(primary: TableCellRichTextDocument, secondary: TableCellRichTextDocument): TableCellRichTextDocument {
  if (isEmptyDocument(primary)) return structuredClone(secondary);
  if (isEmptyDocument(secondary)) return structuredClone(primary);
  return { type: "doc", content: [...structuredClone(primary.content), ...structuredClone(secondary.content)] };
}

function insertColumnWidth(widths: number[], at: number): number[] {
  const next = [...widths];
  const source = at === widths.length ? at - 1 : at;
  const half = (next[source] ?? 100) / 2;
  next[source] = half;
  next.splice(at, 0, half);
  return next;
}

function deleteColumnWidth(widths: number[], at: number): number[] {
  const next = widths.filter((_, index) => index !== at);
  const total = next.reduce((sum, width) => sum + width, 0);
  return next.map((width) => width / total * 100);
}

function getCellIdAt(table: EditableTableData, row: number, column: number): string {
  const layout = buildLayout(table);
  return layout.grid[row]?.[column] ?? layout.placed[0]?.cell.id ?? "";
}

export function getTableCellLocation(table: EditableTableData, cellId: string): TableCellLocation | null {
  const placed = buildLayout(table).placed.find((item) => item.cell.id === cellId);
  return placed ? { row: placed.row, column: placed.column, rowSpan: placed.rowSpan, columnSpan: placed.columnSpan } : null;
}

export function getTableOperationAvailability(table: EditableTableData, cellId: string): TableOperationAvailability {
  const layout = buildLayout(table);
  const active = layout.placed.find((item) => item.cell.id === cellId);
  const rightId = active ? layout.grid[active.row]?.[active.column + active.columnSpan] : undefined;
  const belowId = active ? layout.grid[active.row + active.rowSpan]?.[active.column] : undefined;
  const right = layout.placed.find((item) => item.cell.id === rightId);
  const below = layout.placed.find((item) => item.cell.id === belowId);

  return {
    insertRowAbove: Boolean(active) && table.rows.length < STRUCTURE_LIMITS.tableRows,
    insertRowBelow: Boolean(active) && table.rows.length < STRUCTURE_LIMITS.tableRows,
    deleteRow: Boolean(active) && table.rows.length > 1,
    insertColumnLeft: Boolean(active) && table.columnWidthsPercent.length < STRUCTURE_LIMITS.tableColumns,
    insertColumnRight: Boolean(active) && table.columnWidthsPercent.length < STRUCTURE_LIMITS.tableColumns,
    deleteColumn: Boolean(active) && table.columnWidthsPercent.length > 1,
    mergeRight: Boolean(active && right && right.row === active.row && right.rowSpan === active.rowSpan),
    mergeDown: Boolean(active && below && below.column === active.column && below.columnSpan === active.columnSpan),
    splitCell: Boolean(active && (active.rowSpan > 1 || active.columnSpan > 1)),
  };
}

export function applyTableOperation(table: EditableTableData, cellId: string, operation: TableOperation): TableOperationResult | null {
  if (!getTableOperationAvailability(table, cellId)[operation]) return null;
  const layout = buildLayout(table);
  const active = layout.placed.find((item) => item.cell.id === cellId);
  if (!active) return null;

  let placed = clonePlacedCells(table);
  let rowMetadata: TableRowMetadata[] = table.rows.map((row) => ({ id: row.id, ...(row.heightMm !== undefined ? { heightMm: row.heightMm } : {}) }));
  let widths = [...table.columnWidthsPercent];
  let nextActiveCellId = cellId;

  if (operation === "insertRowAbove" || operation === "insertRowBelow") {
    const at = operation === "insertRowAbove" ? active.row : active.row + active.rowSpan;
    placed = placed.map((item) => {
      if (item.row < at && item.row + item.rowSpan > at) return { ...item, rowSpan: item.rowSpan + 1 };
      if (item.row >= at) return { ...item, row: item.row + 1 };
      return item;
    });
    rowMetadata.splice(at, 0, { id: createId() });
    for (let column = 0; column < widths.length; column += 1) {
      const occupied = placed.some((item) => item.row <= at && item.row + item.rowSpan > at && item.column <= column && item.column + item.columnSpan > column);
      if (!occupied) placed.push({ cell: createEmptyCell(), row: at, column, rowSpan: 1, columnSpan: 1 });
    }
  } else if (operation === "deleteRow") {
    const at = active.row;
    placed = placed.flatMap((item) => {
      if (item.row < at) return [{ ...item, rowSpan: item.row + item.rowSpan > at ? item.rowSpan - 1 : item.rowSpan }];
      if (item.row === at) return item.rowSpan > 1 ? [{ ...item, rowSpan: item.rowSpan - 1 }] : [];
      return [{ ...item, row: item.row - 1 }];
    });
    rowMetadata.splice(at, 1);
  } else if (operation === "insertColumnLeft" || operation === "insertColumnRight") {
    const at = operation === "insertColumnLeft" ? active.column : active.column + active.columnSpan;
    placed = placed.map((item) => {
      if (item.column < at && item.column + item.columnSpan > at) return { ...item, columnSpan: item.columnSpan + 1 };
      if (item.column >= at) return { ...item, column: item.column + 1 };
      return item;
    });
    widths = insertColumnWidth(widths, at);
    for (let row = 0; row < rowMetadata.length; row += 1) {
      const occupied = placed.some((item) => item.row <= row && item.row + item.rowSpan > row && item.column <= at && item.column + item.columnSpan > at);
      if (!occupied) placed.push({ cell: createEmptyCell(), row, column: at, rowSpan: 1, columnSpan: 1 });
    }
  } else if (operation === "deleteColumn") {
    const at = active.column;
    placed = placed.flatMap((item) => {
      if (item.column < at) return [{ ...item, columnSpan: item.column + item.columnSpan > at ? item.columnSpan - 1 : item.columnSpan }];
      if (item.column === at) return item.columnSpan > 1 ? [{ ...item, columnSpan: item.columnSpan - 1 }] : [];
      return [{ ...item, column: item.column - 1 }];
    });
    widths = deleteColumnWidth(widths, at);
  } else if (operation === "mergeRight" || operation === "mergeDown") {
    const neighborId = operation === "mergeRight"
      ? layout.grid[active.row]?.[active.column + active.columnSpan]
      : layout.grid[active.row + active.rowSpan]?.[active.column];
    const current = placed.find((item) => item.cell.id === cellId);
    const neighbor = placed.find((item) => item.cell.id === neighborId);
    if (!current || !neighbor) return null;
    current.cell.document = mergeDocuments(current.cell.document, neighbor.cell.document);
    if (operation === "mergeRight") current.columnSpan += neighbor.columnSpan;
    else current.rowSpan += neighbor.rowSpan;
    placed = placed.filter((item) => item.cell.id !== neighbor.cell.id);
  } else {
    const current = placed.find((item) => item.cell.id === cellId);
    if (!current) return null;
    placed = placed.filter((item) => item.cell.id !== cellId);
    placed.push({ ...current, rowSpan: 1, columnSpan: 1 });
    for (let row = current.row; row < current.row + current.rowSpan; row += 1) {
      for (let column = current.column; column < current.column + current.columnSpan; column += 1) {
        if (row !== current.row || column !== current.column) {
          placed.push({ cell: createEmptyCell(), row, column, rowSpan: 1, columnSpan: 1 });
        }
      }
    }
  }

  const nextTable: EditableTableData = { rows: rebuildRows(rowMetadata, placed), columnWidthsPercent: widths };
  if (!nextTable.rows.some((row) => row.cells.some((cell) => cell.id === nextActiveCellId))) {
    const targetRow = Math.min(active.row, nextTable.rows.length - 1);
    const targetColumn = Math.min(active.column, nextTable.columnWidthsPercent.length - 1);
    nextActiveCellId = getCellIdAt(nextTable, targetRow, targetColumn);
  }
  return { ...nextTable, activeCellId: nextActiveCellId };
}

export function setTableRowHeight(table: EditableTableData, rowIndex: number, heightMm: number | null): EditableTableData | null {
  const row = table.rows[rowIndex];
  if (!row) return null;
  if (heightMm !== null && (!Number.isFinite(heightMm) || heightMm < TABLE_ROW_HEIGHT_MM.min || heightMm > TABLE_ROW_HEIGHT_MM.max)) return null;
  const rows = structuredClone(table.rows);
  const nextRow = rows[rowIndex]!;
  if (heightMm === null) delete nextRow.heightMm;
  else nextRow.heightMm = heightMm;
  return { rows, columnWidthsPercent: [...table.columnWidthsPercent] };
}

export function setTableColumnWidth(table: EditableTableData, columnIndex: number, widthPercent: number): EditableTableData | null {
  const columnCount = table.columnWidthsPercent.length;
  if (columnCount <= 1 || columnIndex < 0 || columnIndex >= columnCount || !Number.isFinite(widthPercent)) return null;
  if (widthPercent < TABLE_COLUMN_WIDTH_PERCENT.min || widthPercent > TABLE_COLUMN_WIDTH_PERCENT.max) return null;
  const currentWidth = table.columnWidthsPercent[columnIndex]!;
  const otherTotal = 100 - currentWidth;
  if (otherTotal <= 0) return null;
  const remaining = 100 - widthPercent;
  const columnWidthsPercent = table.columnWidthsPercent.map((width, index) =>
    index === columnIndex ? widthPercent : width / otherTotal * remaining,
  );
  return { rows: structuredClone(table.rows), columnWidthsPercent };
}
