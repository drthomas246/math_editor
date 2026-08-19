import { describe, expect, it } from "vitest";

import { applyTableOperation, getTableCellLocation, getTableOperationAvailability, setTableColumnWidth, setTableRowHeight, type EditableTableData } from "./table-operations";
import { createTableBlock } from "./worksheet.defaults";
import { TableBlockSchema } from "./worksheet.schema";
import type { TableCell } from "./worksheet";

function expectValid(table: EditableTableData): void {
  expect(TableBlockSchema.safeParse({
    id: crypto.randomUUID(),
    type: "table",
    headerRow: false,
    rows: table.rows,
    columnWidthsPercent: table.columnWidthsPercent,
  }).success).toBe(true);
}

function apply(table: EditableTableData, cellId: string, operation: Parameters<typeof applyTableOperation>[2]) {
  const result = applyTableOperation(table, cellId, operation);
  expect(result).not.toBeNull();
  return result!;
}

function setCellText(cell: TableCell, text: string): void {
  cell.document = { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text }] }] };
}

describe("table operations", () => {
  it("選択セルを基準に行列を追加・削除し、列幅の合計を100に保つ", () => {
    const source = createTableBlock(2, 2);
    const activeId = source.rows[0]!.cells[0]!.id;
    let table: EditableTableData = source;

    table = apply(table, activeId, "insertRowBelow");
    expect(table.rows).toHaveLength(3);
    expect(table.rows.every((row) => row.cells.length === 2)).toBe(true);

    table = apply(table, activeId, "insertColumnRight");
    expect(table.columnWidthsPercent).toHaveLength(3);
    expect(table.columnWidthsPercent.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100);

    const afterRowDelete = apply(table, activeId, "deleteRow");
    table = afterRowDelete;
    expect(table.rows).toHaveLength(2);
    table = apply(table, afterRowDelete.activeCellId, "deleteColumn");
    expect(table.columnWidthsPercent).toHaveLength(2);
    expectValid(table);
  });

  it("横結合・縦結合で両方の内容を保持し、分割すると左上以外を空セルにする", () => {
    const source = createTableBlock(2, 2);
    const topLeft = source.rows[0]!.cells[0]!;
    const topRight = source.rows[0]!.cells[1]!;
    const bottomLeft = source.rows[1]!.cells[0]!;
    const bottomRight = source.rows[1]!.cells[1]!;
    setCellText(topLeft, "A");
    setCellText(topRight, "B");
    setCellText(bottomLeft, "C");
    setCellText(bottomRight, "D");

    let table = apply(source, topLeft.id, "mergeRight");
    table = apply(table, bottomLeft.id, "mergeRight");
    table = apply(table, topLeft.id, "mergeDown");
    const merged = table.rows[0]!.cells[0]!;
    expect(merged).toMatchObject({ id: topLeft.id, rowSpan: 2, columnSpan: 2 });
    expect(JSON.stringify(merged.document)).toContain("A");
    expect(JSON.stringify(merged.document)).toContain("B");
    expect(JSON.stringify(merged.document)).toContain("C");
    expect(JSON.stringify(merged.document)).toContain("D");
    expectValid(table);

    table = apply(table, topLeft.id, "splitCell");
    expect(table.rows.map((row) => row.cells.length)).toEqual([2, 2]);
    expect(table.rows[0]!.cells[0]!.id).toBe(topLeft.id);
    expect(table.rows[0]!.cells[1]!.document.content[0]).toMatchObject({ type: "paragraph", content: [] });
    expect(table.rows[1]!.cells[0]!.document.content[0]).toMatchObject({ type: "paragraph", content: [] });
    expect(new Set(table.rows.flatMap((row) => row.cells.map((cell) => cell.id))).size).toBe(4);
    expectValid(table);
  });

  it("別セルの縦結合をまたぐ位置へ行を追加すると結合範囲を拡張する", () => {
    const source = createTableBlock(3, 2);
    const leftId = source.rows[0]!.cells[0]!.id;
    const rightId = source.rows[0]!.cells[1]!.id;
    let table = apply(source, leftId, "mergeDown");

    table = apply(table, rightId, "insertRowBelow");
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0]!.cells.find((cell) => cell.id === leftId)?.rowSpan).toBe(3);
    expect(getTableCellLocation(table, leftId)).toEqual({ row: 0, column: 0, rowSpan: 3, columnSpan: 1 });
    expectValid(table);

    table = apply(table, leftId, "deleteRow");
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]!.cells.find((cell) => cell.id === leftId)?.rowSpan).toBe(2);
    expectValid(table);
  });

  it("20行・20列では追加操作を無効にする", () => {
    const table = createTableBlock(20, 20);
    const availability = getTableOperationAvailability(table, table.rows[0]!.cells[0]!.id);
    expect(availability.insertRowAbove).toBe(false);
    expect(availability.insertRowBelow).toBe(false);
    expect(availability.insertColumnLeft).toBe(false);
    expect(availability.insertColumnRight).toBe(false);
  });

  it("選択行の高さと選択列の幅を設定し、列幅合計を100に保つ", () => {
    const source = createTableBlock(2, 3);
    const withHeight = setTableRowHeight(source, 1, 18);
    expect(withHeight?.rows[1]?.heightMm).toBe(18);
    expectValid(withHeight!);

    const withWidth = setTableColumnWidth(withHeight!, 0, 40);
    expect(withWidth?.columnWidthsPercent[0]).toBe(40);
    expect(withWidth?.columnWidthsPercent[1]).toBeCloseTo(30);
    expect(withWidth?.columnWidthsPercent[2]).toBeCloseTo(30);
    expect(withWidth?.columnWidthsPercent.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100);
    expectValid(withWidth!);

    const automaticHeight = setTableRowHeight(withWidth!, 1, null);
    expect(automaticHeight?.rows[1]?.heightMm).toBeUndefined();
    expectValid(automaticHeight!);
  });

  it("行を追加・削除しても既存行の高さを保持する", () => {
    const source = createTableBlock(2, 2);
    source.rows[1]!.heightMm = 25;
    const activeId = source.rows[0]!.cells[0]!.id;
    let table = apply(source, activeId, "insertRowBelow");
    expect(table.rows.map((row) => row.heightMm ?? null)).toEqual([null, null, 25]);
    table = apply(table, table.rows[1]!.cells[0]!.id, "deleteRow");
    expect(table.rows.map((row) => row.heightMm ?? null)).toEqual([null, 25]);
    expectValid(table);
  });
});
