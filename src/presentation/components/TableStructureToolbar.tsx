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
 * 番号を比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value 表示形式・番号で判定または変換する入力値
 * @returns Stringの結果
 */
function formatNumberImplementation1(value: number) {
    return String(Math.round(value * 10) / 10);
});
/**
 * 表・Structure・Toolbarの情報と操作を、画面へ組み込むReact要素として構成する。
 *
 * @param props 表・Structure・Toolbarへ渡す表示情報と操作
 * @returns 表・Structure・Toolbarを表示するReact要素
 */
export function TableStructureToolbar(props: Props) {
    let { availability, onOperation, sizing } = props;
    const sizingKey = `${sizing.rowHeightMm ?? "auto"}:${sizing.columnWidthPercent}:${sizing.canResizeColumn}`;
    return <div className="table-structure-toolbar" role="toolbar" aria-label="表の行・列・セル操作">
    {groups.map((/**
         * 各採番または表示をまとめる問題グループを画面表示用のReact要素へ変換する。
         *
         * @param group 採番または表示をまとめる問題グループ
         * @returns 画面表示用のReact要素
         */
        function mapItem2(group) {
            return <div className="table-structure-group" key={group.label}>
      <span>{group.label}</span>
      {group.actions.map((/**
                 * 各実行する編集操作を画面表示用のReact要素へ変換する。
                 *
                 * @param action 実行する編集操作
                 * @returns 画面表示用のReact要素
                 */
                function mapItem3(action) {
                    return <button type="button" key={action.operation} disabled={!availability[action.operation]} aria-label={action.title} title={action.title} onClick={(/**
                     * ボタンからクリック操作を受け、on・操作として親コンポーネントへ通知する。
                     *
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
 * 表・Sizing・Controlsの情報と操作を、画面へ組み込むReact要素として構成する。
 *
 * @param props 表・Sizing・Controlsへ渡す表示情報と操作
 * @returns 表・Sizing・Controlsを表示するReact要素
 */
function TableSizingControls(props: Pick<Props, "sizing">) {
    let { sizing } = props;
    const [rowHeight, setRowHeight] = useState(sizing.rowHeightMm === null ? "" : formatNumber(sizing.rowHeightMm));
    const [columnWidth, setColumnWidth] = useState(formatNumber(sizing.columnWidthPercent));
    const commitRowHeight = (/**
     * commit・行・高さを現在の編集結果へ反映する。
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
     * commit・列・幅を現在の編集結果へ反映する。
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
     * 「選択行の高さ（mm）」要素のon・Changeを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange7(event) {
        return setRowHeight(event.target.value);
    })} onBlur={commitRowHeight} onKeyDown={(/**
     * 「選択行の高さ（mm）」要素のon・キー・Downを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDown8(event) { if (event.key === "Enter")
        event.currentTarget.blur(); })}/><small>mm</small>
        <button type="button" className="table-size-reset" disabled={sizing.rowHeightMm === null} onClick={(/**
     * 「自動」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick9() { setRowHeight(""); sizing.onRowHeightChange(null); })}>自動</button>
      </label>
      <label className="table-size-control">列幅
        <input type="number" min={TABLE_COLUMN_WIDTH_PERCENT.min} max={TABLE_COLUMN_WIDTH_PERCENT.max} step={1} value={columnWidth} disabled={!sizing.canResizeColumn} aria-label="選択列の幅（%）" onChange={(/**
     * 「選択列の幅（%）」要素のon・Changeを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange10(event) {
        return setColumnWidth(event.target.value);
    })} onBlur={commitColumnWidth} onKeyDown={(/**
     * 「選択列の幅（%）」要素のon・キー・Downを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDown11(event) { if (event.key === "Enter")
        event.currentTarget.blur(); })}/><small>%</small>
      </label>
  </div>;
}
