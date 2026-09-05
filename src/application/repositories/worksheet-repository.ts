import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
export type WorksheetWithAssets = {
    worksheet: Worksheet;
    assets: AssetRecord[];
};
export type WorksheetListResult = {
    worksheets: Worksheet[];
    invalidCount: number;
};
export type SaveWorksheetOptions = {
    pruneUnreferencedAssets?: boolean;
    retainedAssetIds?: ReadonlySet<string>;
};
export interface WorksheetRepository {
    /**
     * listに必要な処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    list(): Promise<WorksheetListResult>;
    /**
     * getで必要な値を取得する。
     *
     * @param id 対象を識別するID
     * @returns 呼び出し元で使用する処理結果
     */
    get(id: string): Promise<WorksheetWithAssets | null>;
    /**
     * createで必要な値を作成する。
     *
     * @param data 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    create(data: WorksheetWithAssets): Promise<void>;
    /**
     * saveの対象となるデータを保存または出力する。
     *
     * @param worksheet worksheetとして使用する値
     * @param options optionsとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    save(worksheet: Worksheet, options?: SaveWorksheetOptions): Promise<void>;
    /**
     * trashに必要な処理を実行する。
     *
     * @param id 対象を識別するID
     * @returns 呼び出し元で使用する処理結果
     */
    trash(id: string): Promise<Worksheet>;
    /**
     * restoreに必要な処理を実行する。
     *
     * @param id 対象を識別するID
     * @returns 呼び出し元で使用する処理結果
     */
    restore(id: string): Promise<Worksheet>;
    /**
     * deletePermanentlyの対象となる要素を削除または解放する。
     *
     * @param id 対象を識別するID
     * @returns 呼び出し元で使用する処理結果
     */
    deletePermanently(id: string): Promise<void>;
    /**
     * emptyTrashに必要な処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    emptyTrash(): Promise<number>;
    /**
     * duplicateで必要な値を作成する。
     *
     * @param id 対象を識別するID
     * @returns 呼び出し元で使用する処理結果
     */
    duplicate(id: string): Promise<Worksheet>;
    /**
     * putAssetに必要な処理を実行する。
     *
     * @param asset assetとして使用する値
     * @param worksheet worksheetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    putAsset(asset: AssetRecord, worksheet: Worksheet): Promise<void>;
    /**
     * countで必要な値を取得する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    count(): Promise<number>;
}
