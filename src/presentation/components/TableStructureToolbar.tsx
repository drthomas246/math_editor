import { useState } from "react";
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
const groups: Array<{
    label: string;
    actions: Array<{
        operation: TableOperation;
        label: string;
        title: string;
    }>;
}> = [
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
const formatNumber = (/**
 * formatNumberの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function formatNumberImplementation1(value: number) {
    return String(Math.round(value * 10) / 10);
});
/**
 * TableStructureToolbarコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function TableStructureToolbar(props: Props) {
    let { availability, onOperation, sizing } = props;
    const sizingKey = `${sizing.rowHeightMm ?? "auto"}:${sizing.columnWidthPercent}:${sizing.canResizeColumn}`;
    return <div className="table-structure-toolbar" role="toolbar" aria-label="表の行・列・セル操作">
    {groups.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param group groupとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem2(group) {
            return <div className="table-structure-group" key={group.label}>
      <span>{group.label}</span>
      {group.actions.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param action actionとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem3(action) {
                    return <button type="button" key={action.operation} disabled={!availability[action.operation]} aria-label={action.title} title={action.title} onClick={(/**
                     * onClickで発生した画面イベントを処理する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function handleClick4() {
                        return onOperation(action.operation);
                    })}>{action.label}</button>;
                }))}
    </div>;
        }))}
    <TableSizingControls key={sizingKey} sizing={sizing}/>
  </div>;
}
/**
 * TableSizingControlsコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function TableSizingControls(props: Pick<Props, "sizing">) {
    let { sizing } = props;
    const [rowHeight, setRowHeight] = useState(sizing.rowHeightMm === null ? "" : formatNumber(sizing.rowHeightMm));
    const [columnWidth, setColumnWidth] = useState(formatNumber(sizing.columnWidthPercent));
    const commitRowHeight = (/**
     * commitRowHeightの対象となる状態を更新する。
     */
    function commitRowHeightImplementation5() {
        if (!rowHeight.trim()) {
            sizing.onRowHeightChange(null);
            return;
        }
        const value = Number(rowHeight);
        if (!Number.isFinite(value)) {
            setRowHeight(sizing.rowHeightMm === null ? "" : formatNumber(sizing.rowHeightMm));
            return;
        }
        const next = Math.min(TABLE_ROW_HEIGHT_MM.max, Math.max(TABLE_ROW_HEIGHT_MM.min, value));
        setRowHeight(formatNumber(next));
        sizing.onRowHeightChange(next);
    });
    const commitColumnWidth = (/**
     * commitColumnWidthの対象となる状態を更新する。
     */
    function commitColumnWidthImplementation6() {
        const value = Number(columnWidth);
        if (!Number.isFinite(value)) {
            setColumnWidth(formatNumber(sizing.columnWidthPercent));
            return;
        }
        const next = Math.min(TABLE_COLUMN_WIDTH_PERCENT.max, Math.max(TABLE_COLUMN_WIDTH_PERCENT.min, value));
        setColumnWidth(formatNumber(next));
        sizing.onColumnWidthChange(next);
    });
    return <div className="table-sizing-group">
      <label className="table-size-control">行高
        <input type="number" min={TABLE_ROW_HEIGHT_MM.min} max={TABLE_ROW_HEIGHT_MM.max} step={1} value={rowHeight} placeholder="自動" aria-label="選択行の高さ（mm）" onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange7(event) {
        return setRowHeight(event.target.value);
    })} onBlur={commitRowHeight} onKeyDown={(/**
     * onKeyDownで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDown8(event) { if (event.key === "Enter")
        event.currentTarget.blur(); })}/><small>mm</small>
        <button type="button" className="table-size-reset" disabled={sizing.rowHeightMm === null} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick9() { setRowHeight(""); sizing.onRowHeightChange(null); })}>自動</button>
      </label>
      <label className="table-size-control">列幅
        <input type="number" min={TABLE_COLUMN_WIDTH_PERCENT.min} max={TABLE_COLUMN_WIDTH_PERCENT.max} step={1} value={columnWidth} disabled={!sizing.canResizeColumn} aria-label="選択列の幅（%）" onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange10(event) {
        return setColumnWidth(event.target.value);
    })} onBlur={commitColumnWidth} onKeyDown={(/**
     * onKeyDownで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDown11(event) { if (event.key === "Enter")
        event.currentTarget.blur(); })}/><small>%</small>
      </label>
  </div>;
}
