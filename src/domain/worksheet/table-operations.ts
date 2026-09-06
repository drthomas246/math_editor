import { STRUCTURE_LIMITS } from "./structure-limits";
import type { TableCell, TableCellRichTextDocument, TableRow } from "./worksheet";
import { createId } from "./worksheet.defaults";
export type EditableTableData = {
    rows: TableRow[];
    columnWidthsPercent: number[];
};
export type TableOperation = "insertRowAbove" | "insertRowBelow" | "deleteRow" | "insertColumnLeft" | "insertColumnRight" | "deleteColumn" | "mergeRight" | "mergeDown" | "splitCell";
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
type PlacedCell = TableCellLocation & {
    cell: TableCell;
};
type TableLayout = {
    placed: PlacedCell[];
    grid: string[][];
};
const emptyCellDocument = (/**
 * 種別・内容を持つオブジェクトを一つの結果へまとめる。
 *
 * @returns 作成または検証する要素種別・処理対象の問題本文または解説を持つオブジェクト
 */
function emptyCellDocumentImplementation1(): TableCellRichTextDocument {
    return ({
        type: "doc",
        content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
    });
});
const createEmptyCell = (/**
 * Empty・セルを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 対象を一意に特定する識別子・処理対象のリッチテキスト文書・行・Span・列・Spanを持つオブジェクト
 */
function createEmptyCellImplementation2(): TableCell {
    return ({
        id: createId(),
        document: emptyCellDocument(),
        rowSpan: 1,
        columnSpan: 1,
    });
});
/**
 * Layoutを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param table 編集または検証の対象となる表
 * @returns すでに表へ配置済みのセル位置集合・gridを持つオブジェクト
 */
function buildLayout(table: EditableTableData): TableLayout {
    const rowCount = table.rows.length;
    const columnCount = table.columnWidthsPercent.length;
    const grid = Array.from({ length: rowCount }, (/**
     * 配列位置ごとにfromの結果を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @returns 変換元の結果
     */
    function fromCallback3() {
        return Array.from({ length: columnCount }, (/**
         * 配列位置ごとに「」を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @returns 「」
         */
        function fromCallback4() {
            return "";
        }));
    }));
    const placed: PlacedCell[] = [];
    for (const [row, tableRow] of table.rows.entries()) {
        let column = 0;
        for (const cell of tableRow.cells) {
            while (column < columnCount && grid[row]?.[column])
                column += 1;
            placed.push({ cell, row, column, rowSpan: cell.rowSpan, columnSpan: cell.columnSpan });
            for (let targetRow = row; targetRow < row + cell.rowSpan; targetRow += 1) {
                for (let targetColumn = column; targetColumn < column + cell.columnSpan; targetColumn += 1) {
                    const gridRow = grid[targetRow];
                    if (gridRow && targetColumn < columnCount)
                        gridRow[targetColumn] = cell.id;
                }
            }
            column += cell.columnSpan;
        }
    }
    return { placed, grid };
}
/**
 * Placed・Cellsを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param table 編集または検証の対象となる表
 * @returns 各要素を変換した配列として得た要素一覧
 */
function clonePlacedCells(table: EditableTableData): PlacedCell[] {
    return buildLayout(table).placed.map((/**
     * 各要素を値・処理対象の表セルを持つオブジェクトへ変換する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 値・処理対象の表セルを持つオブジェクト
     */
    function mapItem5(item) {
        return ({ ...item, cell: structuredClone(item.cell) });
    }));
}
type TableRowMetadata = Pick<TableRow, "id" | "heightMm">;
/**
 * rebuild・Rowsをmapで処理し、その結果を呼び出し元へ反映する。
 *
 * @param rowMetadata 再構成する行の高さとセル情報
 * @param placed すでに表へ配置済みのセル位置集合
 * @returns 各要素を変換した配列として得た要素一覧
 */
function rebuildRows(rowMetadata: TableRowMetadata[], placed: PlacedCell[]): TableRow[] {
    return rowMetadata.map((/**
     * 各復元または検証に使う付随情報を対象を一意に特定する識別子・値・cellsを持つオブジェクトへ変換する。
     *
     * @param metadata 復元または検証に使う付随情報
     * @param row 処理対象の表の行
     * @returns 対象を一意に特定する識別子・値・cellsを持つオブジェクト
     */
    function mapItem6(metadata, row) {
        return ({
            id: metadata.id,
            ...(metadata.heightMm !== undefined ? { heightMm: metadata.heightMm } : {}),
            cells: placed
                .filter((/**
             * 要素の処理対象の表の行が処理対象の表の行と一致する要素だけを後続処理へ残す。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素の処理対象の表の行が処理対象の表の行と一致する場合はtrue
             */
            function filterItem7(item) {
                return item.row === row;
            }))
                .sort((/**
             * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
             *
             * @param left 並び順を比較する左側の値
             * @param right 並び順を比較する右側の値
             * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
             */
            function compareItems8(left, right) {
                return left.column - right.column;
            }))
                .map((/**
             * 各要素を値・行方向の結合数・列方向の結合数を持つオブジェクトへ変換する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 値・行・Span・列・Spanを持つオブジェクト
             */
            function mapItem9(item) {
                return ({ ...item.cell, rowSpan: item.rowSpan, columnSpan: item.columnSpan });
            })),
        });
    }));
}
/**
 * Empty・文書が仕様上の条件を満たすか判定する。
 *
 * @param documentValue 表セルへ設定するリッチテキスト文書
 * @returns everyの結果が真になる場合はtrue
 */
function isEmptyDocument(documentValue: TableCellRichTextDocument): boolean {
    return documentValue.content.every((/**
     * すべてのノードに共通して要求する条件を検証する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns ノードの作成または検証する要素種別が「paragraph」と一致するかつノードの処理対象の問題本文または解説のlengthが0と一致する場合はtrue
     */
    function isMatchingItem10(node) {
        return node.type === "paragraph" && node.content.length === 0;
    }));
}
/**
 * Documentsを現在の編集結果へ反映する。
 *
 * @param primary 幅調整で優先する列
 * @param secondary 幅調整で連動させるもう一方の列
 * @returns structured・Cloneの結果
 */
function mergeDocuments(primary: TableCellRichTextDocument, secondary: TableCellRichTextDocument): TableCellRichTextDocument {
    if (isEmptyDocument(primary))
        return structuredClone(secondary);
    if (isEmptyDocument(secondary))
        return structuredClone(primary);
    return { type: "doc", content: [...structuredClone(primary.content), ...structuredClone(secondary.content)] };
}
/**
 * 適用候補となる次の値内の指定位置の値をhalfへ更新する。
 *
 * @param widths 表の各列へ適用する幅一覧
 * @param at 表操作を適用する位置
 * @returns 適用候補となる次の値から算出した数値
 */
function insertColumnWidth(widths: number[], at: number): number[] {
    const next = [...widths];
    const source = at === widths.length ? at - 1 : at;
    const half = (next[source] ?? 100) / 2;
    next[source] = half;
    next.splice(at, 0, half);
    return next;
}
/**
 * 列・幅と不要になった関連データを安全に取り除く。
 *
 * @param widths 表の各列へ適用する幅一覧
 * @param at 表操作を適用する位置
 * @returns 各要素を変換した配列から算出した数値
 */
function deleteColumnWidth(widths: number[], at: number): number[] {
    const next = widths.filter((/**
     * 位置が表操作を適用する位置と異なる要素だけを後続処理へ残す。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param index 対象となる位置
     * @returns 位置が表操作を適用する位置と異なる場合はtrue
     */
    function filterItem11(_, index) {
        return index !== at;
    }));
    const total = next.reduce((/**
     * 現在の幅または件数の累積値を、それまでの集計結果へ重複なく反映する。
     *
     * @param sum 幅または件数の累積値
     * @param width 要素または列へ適用する幅
     * @returns 幅または件数の累積値を反映した次の累積結果
     */
    function reduceItems12(sum, width) {
        return sum + width;
    }), 0);
    return next.map((/**
     * 各要素または列へ適用する幅を要素または列へ適用する幅と計算途中の累積値で除算した値と100を乗算した値へ変換する。
     *
     * @param width 要素または列へ適用する幅
     * @returns 要素または列へ適用する幅と計算途中の累積値で除算した値と100を乗算した値
     */
    function mapItem13(width) {
        return width / total * 100;
    }));
}
/**
 * セル・Id・Atを入力データまたは現在の状態から取り出す。
 *
 * @param table 編集または検証の対象となる表
 * @param row 処理対象の表の行
 * @param column 処理対象の表列
 * セル・識別子・Atを入力データまたは現在の状態から取り出す。
  * @returns 二つの値を比較した結果として得た文字列。変換できない場合は関数固有の既定値
 */
function getCellIdAt(table: EditableTableData, row: number, column: number): string {
    const layout = buildLayout(table);
    return layout.grid[row]?.[column] ?? layout.placed[0]?.cell.id ?? "";
}
/**
 * 表・セル・Locationを入力データまたは現在の状態から取り出す。
 *
 * @param table 編集または検証の対象となる表
 * @param cellId 対象を識別するID
 * @returns 条件に応じて選択した値
 */
export function getTableCellLocation(table: EditableTableData, cellId: string): TableCellLocation | null {
    const placed = buildLayout(table).placed.find((/**
     * 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する場合はtrue
     */
    function findItem14(item) {
        return item.cell.id === cellId;
    }));
    return placed ? { row: placed.row, column: placed.column, rowSpan: placed.rowSpan, columnSpan: placed.columnSpan } : null;
}
/**
 * insert・行・Above・insert・行・Below・delete・行・insert・列・Left・insert・列・右側を持つオブジェクトを一つの結果へまとめる。
 *
 * @param table 編集または検証の対象となる表
 * @param cellId 対象を識別するID
 * @returns insert・行・Above・insert・行・Below・delete・行・insert・列・Left・insert・列・右側を持つオブジェクト
 */
export function getTableOperationAvailability(table: EditableTableData, cellId: string): TableOperationAvailability {
    const layout = buildLayout(table);
    const active = layout.placed.find((/**
     * 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する場合はtrue
     */
    function findItem15(item) {
        return item.cell.id === cellId;
    }));
    const rightId = active ? layout.grid[active.row]?.[active.column + active.columnSpan] : undefined;
    const belowId = active ? layout.grid[active.row + active.rowSpan]?.[active.column] : undefined;
    const right = layout.placed.find((/**
     * 要素の処理対象の表セルの対象を一意に特定する識別子が右側・Idと一致する最初の要素を検索する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素の処理対象の表セルの対象を一意に特定する識別子が右側・Idと一致する場合はtrue
     */
    function findItem16(item) {
        return item.cell.id === rightId;
    }));
    const below = layout.placed.find((/**
     * 要素の処理対象の表セルの対象を一意に特定する識別子がbelow・Idと一致する最初の要素を検索する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がbelow・Idと一致する場合はtrue
     */
    function findItem17(item) {
        return item.cell.id === belowId;
    }));
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
/**
 * すでに表へ配置済みのセル位置集合を各要素を変換した配列へ更新する。
 *
 * @param table 編集または検証の対象となる表
 * @param cellId 対象を識別するID
 * @param operation 計測または適用する操作
 * @returns 値・有効状態・セル・識別子を持つオブジェクト
 */
export function applyTableOperation(table: EditableTableData, cellId: string, operation: TableOperation): TableOperationResult | null {
    if (!getTableOperationAvailability(table, cellId)[operation])
        return null;
    const layout = buildLayout(table);
    const active = layout.placed.find((/**
     * 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
     *
     * @param item 配列処理で現在参照している要素
     * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する場合はtrue
     */
    function findItem18(item) {
        return item.cell.id === cellId;
    }));
    if (!active)
        return null;
    let placed = clonePlacedCells(table);
    let rowMetadata: TableRowMetadata[] = table.rows.map((/**
     * 各処理対象の表の行を対象を一意に特定する識別子・値を持つオブジェクトへ変換する。
     *
     * @param row 処理対象の表の行
     * @returns 対象を一意に特定する識別子・値を持つオブジェクト
     */
    function mapItem19(row) {
        return ({ id: row.id, ...(row.heightMm !== undefined ? { heightMm: row.heightMm } : {}) });
    }));
    let widths = [...table.columnWidthsPercent];
    let nextActiveCellId = cellId;
    if (operation === "insertRowAbove" || operation === "insertRowBelow") {
        const at = operation === "insertRowAbove" ? active.row : active.row + active.rowSpan;
        placed = placed.map((/**
         * 各要素を値・行方向の結合数を持つオブジェクトへ変換する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 値・行・Spanを持つオブジェクト
         */
        function mapItem20(item) {
            if (item.row < at && item.row + item.rowSpan > at)
                return { ...item, rowSpan: item.rowSpan + 1 };
            if (item.row >= at)
                return { ...item, row: item.row + 1 };
            return item;
        }));
        rowMetadata.splice(at, 0, { id: createId() });
        for (let column = 0; column < widths.length; column += 1) {
            const occupied = placed.some((/**
             * いずれかの要素が要求条件を満たすか判定する。
             *
             * @param item 配列処理で現在参照している要素
             * 要素の処理対象の表の行が表操作を適用する位置以下であるかつ要素の処理対象の表の行と要素の行・Spanを加算した値が表操作を適用する位置より大きいかつ要素の処理対象の表列が処理対象の表列以下であるかつ要素の処理対象の表列と要素の列・Spanを加算した値が処理対象の表列より大きい要素が一つでも存在するか判定する。
              * @returns 要素の処理対象の表の行が表操作を適用する位置以下であるかつ要素の処理対象の表の行と要素の行・Spanを加算した値が表操作を適用する位置より大きいかつ要素の処理対象の表列が処理対象の表列以下であるかつ要素の処理対象の表列と要素の列・Spanを加算した値が処理対象の表列より大きい場合はtrue
             */
            function hasMatchingItem21(item) {
                return item.row <= at && item.row + item.rowSpan > at && item.column <= column && item.column + item.columnSpan > column;
            }));
            if (!occupied)
                placed.push({ cell: createEmptyCell(), row: at, column, rowSpan: 1, columnSpan: 1 });
        }
    }
    else if (operation === "deleteRow") {
        const at = active.row;
        placed = placed.flatMap((/**
         * 各要素を順序を保った要素一覧へ変換し、空の結果を除いて一つの配列へ展開する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 順序を保った要素一覧
         */
        function expandItem22(item) {
            if (item.row < at)
                return [{ ...item, rowSpan: item.row + item.rowSpan > at ? item.rowSpan - 1 : item.rowSpan }];
            if (item.row === at)
                return item.rowSpan > 1 ? [{ ...item, rowSpan: item.rowSpan - 1 }] : [];
            return [{ ...item, row: item.row - 1 }];
        }));
        rowMetadata.splice(at, 1);
    }
    else if (operation === "insertColumnLeft" || operation === "insertColumnRight") {
        const at = operation === "insertColumnLeft" ? active.column : active.column + active.columnSpan;
        placed = placed.map((/**
         * 各要素を値・列方向の結合数を持つオブジェクトへ変換する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 値・列・Spanを持つオブジェクト
         */
        function mapItem23(item) {
            if (item.column < at && item.column + item.columnSpan > at)
                return { ...item, columnSpan: item.columnSpan + 1 };
            if (item.column >= at)
                return { ...item, column: item.column + 1 };
            return item;
        }));
        widths = insertColumnWidth(widths, at);
        for (let row = 0; row < rowMetadata.length; row += 1) {
            const occupied = placed.some((/**
             * いずれかの要素が要求条件を満たすか判定する。
             *
             * @param item 配列処理で現在参照している要素
             * 要素の処理対象の表の行が処理対象の表の行以下であるかつ要素の処理対象の表の行と要素の行・Spanを加算した値が処理対象の表の行より大きいかつ要素の処理対象の表列が表操作を適用する位置以下であるかつ要素の処理対象の表列と要素の列・Spanを加算した値が表操作を適用する位置より大きい要素が一つでも存在するか判定する。
              * @returns 要素の処理対象の表の行が処理対象の表の行以下であるかつ要素の処理対象の表の行と要素の行・Spanを加算した値が処理対象の表の行より大きいかつ要素の処理対象の表列が表操作を適用する位置以下であるかつ要素の処理対象の表列と要素の列・Spanを加算した値が表操作を適用する位置より大きい場合はtrue
             */
            function hasMatchingItem24(item) {
                return item.row <= row && item.row + item.rowSpan > row && item.column <= at && item.column + item.columnSpan > at;
            }));
            if (!occupied)
                placed.push({ cell: createEmptyCell(), row, column: at, rowSpan: 1, columnSpan: 1 });
        }
    }
    else if (operation === "deleteColumn") {
        const at = active.column;
        placed = placed.flatMap((/**
         * 各要素を順序を保った要素一覧へ変換し、空の結果を除いて一つの配列へ展開する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 順序を保った要素一覧
         */
        function expandItem25(item) {
            if (item.column < at)
                return [{ ...item, columnSpan: item.column + item.columnSpan > at ? item.columnSpan - 1 : item.columnSpan }];
            if (item.column === at)
                return item.columnSpan > 1 ? [{ ...item, columnSpan: item.columnSpan - 1 }] : [];
            return [{ ...item, column: item.column - 1 }];
        }));
        widths = deleteColumnWidth(widths, at);
    }
    else if (operation === "mergeRight" || operation === "mergeDown") {
        const neighborId = operation === "mergeRight"
            ? layout.grid[active.row]?.[active.column + active.columnSpan]
            : layout.grid[active.row + active.rowSpan]?.[active.column];
        const current = placed.find((/**
         * 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する場合はtrue
         */
        function findItem26(item) {
            return item.cell.id === cellId;
        }));
        const neighbor = placed.find((/**
         * 要素の処理対象の表セルの対象を一意に特定する識別子がneighbor・Idと一致する最初の要素を検索する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がneighbor・Idと一致する場合はtrue
         */
        function findItem27(item) {
            return item.cell.id === neighborId;
        }));
        if (!current || !neighbor)
            return null;
        current.cell.document = mergeDocuments(current.cell.document, neighbor.cell.document);
        if (operation === "mergeRight")
            current.columnSpan += neighbor.columnSpan;
        else
            current.rowSpan += neighbor.rowSpan;
        placed = placed.filter((/**
         * 要素の処理対象の表セルの対象を一意に特定する識別子がneighborの処理対象の表セルの対象を一意に特定する識別子と異なる要素だけを後続処理へ残す。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がneighborの処理対象の表セルの対象を一意に特定する識別子と異なる場合はtrue
         */
        function filterItem28(item) {
            return item.cell.id !== neighbor.cell.id;
        }));
    }
    else {
        const current = placed.find((/**
         * 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと一致する場合はtrue
         */
        function findItem29(item) {
            return item.cell.id === cellId;
        }));
        if (!current)
            return null;
        placed = placed.filter((/**
         * 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと異なる要素だけを後続処理へ残す。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の処理対象の表セルの対象を一意に特定する識別子がセル・Idと異なる場合はtrue
         */
        function filterItem30(item) {
            return item.cell.id !== cellId;
        }));
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
    if (!nextTable.rows.some((/**
     * いずれかの処理対象の表の行が要求条件を満たすか判定する。
     *
     * @param row 処理対象の表の行
     * @returns someの結果が真になる場合はtrue
     */
    function hasMatchingItem31(row) {
        return row.cells.some((/**
         * いずれかの処理対象の表セルが要求条件を満たすか判定する。
         *
         * @param cell 処理対象の表セル
         * @returns 処理対象の表セルの対象を一意に特定する識別子が次の値・有効状態・セル・Idと一致する場合はtrue
         */
        function hasMatchingItem32(cell) {
            return cell.id === nextActiveCellId;
        }));
    }))) {
        const targetRow = Math.min(active.row, nextTable.rows.length - 1);
        const targetColumn = Math.min(active.column, nextTable.columnWidthsPercent.length - 1);
        nextActiveCellId = getCellIdAt(nextTable, targetRow, targetColumn);
    }
    return { ...nextTable, activeCellId: nextActiveCellId };
}
/**
 * 次の値・行のミリメートル単位の高さをミリメートル単位の高さへ更新する。
 *
 * @param table 編集または検証の対象となる表
 * @param rowIndex 表内での行位置
 * @param heightMm ミリメートル単位の高さ
 * @returns 作成または検証する表の行数・行一覧・列・Widths・Percentを持つオブジェクト
 */
export function setTableRowHeight(table: EditableTableData, rowIndex: number, heightMm: number | null): EditableTableData | null {
    const row = table.rows[rowIndex];
    if (!row)
        return null;
    if (heightMm !== null && (!Number.isFinite(heightMm) || heightMm < TABLE_ROW_HEIGHT_MM.min || heightMm > TABLE_ROW_HEIGHT_MM.max))
        return null;
    const rows = structuredClone(table.rows);
    const nextRow = rows[rowIndex]!;
    if (heightMm === null)
        delete nextRow.heightMm;
    else
        nextRow.heightMm = heightMm;
    return { rows, columnWidthsPercent: [...table.columnWidthsPercent] };
}
/**
 * 表・列・幅を現在の編集結果へ反映する。
 *
 * @param table 編集または検証の対象となる表
 * @param columnIndex 表内での列位置
 * @param widthPercent 表全体に対する列幅の割合
 * @returns 作成または検証する表の行数・行一覧・列・Widths・Percentを持つオブジェクト
 */
export function setTableColumnWidth(table: EditableTableData, columnIndex: number, widthPercent: number): EditableTableData | null {
    const columnCount = table.columnWidthsPercent.length;
    if (columnCount <= 1 || columnIndex < 0 || columnIndex >= columnCount || !Number.isFinite(widthPercent))
        return null;
    if (widthPercent < TABLE_COLUMN_WIDTH_PERCENT.min || widthPercent > TABLE_COLUMN_WIDTH_PERCENT.max)
        return null;
    const currentWidth = table.columnWidthsPercent[columnIndex]!;
    const otherTotal = 100 - currentWidth;
    if (otherTotal <= 0)
        return null;
    const remaining = 100 - widthPercent;
    const columnWidthsPercent = table.columnWidthsPercent.map((/**
     * 各要素または列へ適用する幅を条件に応じて選択した値へ変換する。
     *
     * @param width 要素または列へ適用する幅
     * @param index 対象となる位置
     * @returns 条件に応じて選択した値
     */
    function mapItem33(width, index) {
        return index === columnIndex ? widthPercent : width / otherTotal * remaining;
    }));
    return { rows: structuredClone(table.rows), columnWidthsPercent };
}
