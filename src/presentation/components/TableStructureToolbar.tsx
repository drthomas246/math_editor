import { useEffect, useState } from "react";

import { TABLE_COLUMN_WIDTH_PERCENT, TABLE_ROW_HEIGHT_MM } from "../../domain/worksheet/table-operations";
import type { TableOperation, TableOperationAvailability } from "../../domain/worksheet/table-operations";

type Props = {
  availability: TableOperationAvailability;
  onOperation: (operation: TableOperation) => void;
  sizing: {
    rowHeightMm: number | null;
    columnWidthPercent: number;
    canResizeColumn: boolean;
    onRowHeightChange: (heightMm: number | null) => void;
    onColumnWidthChange: (widthPercent: number) => void;
  };
};

const groups: Array<{ label: string; actions: Array<{ operation: TableOperation; label: string; title: string }> }> = [
  { label: "行", actions: [
    { operation: "insertRowAbove", label: "上に追加", title: "行を上に追加" },
    { operation: "insertRowBelow", label: "下に追加", title: "行を下に追加" },
    { operation: "deleteRow", label: "削除", title: "行を削除" },
  ] },
  { label: "列", actions: [
    { operation: "insertColumnLeft", label: "左に追加", title: "列を左に追加" },
    { operation: "insertColumnRight", label: "右に追加", title: "列を右に追加" },
    { operation: "deleteColumn", label: "削除", title: "列を削除" },
  ] },
  { label: "セル", actions: [
    { operation: "mergeRight", label: "横結合", title: "右のセルと横結合" },
    { operation: "mergeDown", label: "縦結合", title: "下のセルと縦結合" },
    { operation: "splitCell", label: "分割", title: "結合セルを分割" },
  ] },
];

const formatNumber = (value: number) => String(Math.round(value * 10) / 10);

export function TableStructureToolbar({ availability, onOperation, sizing }: Props) {
  const [rowHeight, setRowHeight] = useState(sizing.rowHeightMm === null ? "" : formatNumber(sizing.rowHeightMm));
  const [columnWidth, setColumnWidth] = useState(formatNumber(sizing.columnWidthPercent));

  useEffect(() => setRowHeight(sizing.rowHeightMm === null ? "" : formatNumber(sizing.rowHeightMm)), [sizing.rowHeightMm]);
  useEffect(() => setColumnWidth(formatNumber(sizing.columnWidthPercent)), [sizing.columnWidthPercent]);

  const commitRowHeight = () => {
    if (!rowHeight.trim()) { sizing.onRowHeightChange(null); return; }
    const value = Number(rowHeight);
    if (!Number.isFinite(value)) { setRowHeight(sizing.rowHeightMm === null ? "" : formatNumber(sizing.rowHeightMm)); return; }
    const next = Math.min(TABLE_ROW_HEIGHT_MM.max, Math.max(TABLE_ROW_HEIGHT_MM.min, value));
    setRowHeight(formatNumber(next));
    sizing.onRowHeightChange(next);
  };
  const commitColumnWidth = () => {
    const value = Number(columnWidth);
    if (!Number.isFinite(value)) { setColumnWidth(formatNumber(sizing.columnWidthPercent)); return; }
    const next = Math.min(TABLE_COLUMN_WIDTH_PERCENT.max, Math.max(TABLE_COLUMN_WIDTH_PERCENT.min, value));
    setColumnWidth(formatNumber(next));
    sizing.onColumnWidthChange(next);
  };

  return <div className="table-structure-toolbar" role="toolbar" aria-label="表の行・列・セル操作">
    {groups.map((group) => <div className="table-structure-group" key={group.label}>
      <span>{group.label}</span>
      {group.actions.map((action) => <button
        type="button"
        key={action.operation}
        disabled={!availability[action.operation]}
        aria-label={action.title}
        title={action.title}
        onClick={() => onOperation(action.operation)}
      >{action.label}</button>)}
    </div>)}
    <div className="table-sizing-group">
      <label className="table-size-control">行高
        <input
          type="number"
          min={TABLE_ROW_HEIGHT_MM.min}
          max={TABLE_ROW_HEIGHT_MM.max}
          step={1}
          value={rowHeight}
          placeholder="自動"
          aria-label="選択行の高さ（mm）"
          onChange={(event) => setRowHeight(event.target.value)}
          onBlur={commitRowHeight}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        /><small>mm</small>
        <button type="button" className="table-size-reset" disabled={sizing.rowHeightMm === null} onClick={() => { setRowHeight(""); sizing.onRowHeightChange(null); }}>自動</button>
      </label>
      <label className="table-size-control">列幅
        <input
          type="number"
          min={TABLE_COLUMN_WIDTH_PERCENT.min}
          max={TABLE_COLUMN_WIDTH_PERCENT.max}
          step={1}
          value={columnWidth}
          disabled={!sizing.canResizeColumn}
          aria-label="選択列の幅（%）"
          onChange={(event) => setColumnWidth(event.target.value)}
          onBlur={commitColumnWidth}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        /><small>%</small>
      </label>
    </div>
  </div>;
}
