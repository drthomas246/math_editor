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
     * ごみ箱内を含む保存済みプリントを更新日時順で読み込む。
     *
     * @returns スキーマ検証済みのプリント一覧と、破損により除外した件数
     */
    list(): Promise<WorksheetListResult>;
    /**
     * 指定したプリントと、その本文から参照される画像アセットを読み込む。
     *
     * @param id 読み込むプリントの識別子
     * @returns プリントと画像アセット。対象が存在しない場合はnull
     */
    get(id: string): Promise<WorksheetWithAssets | null>;
    /**
     * 新しいプリントと画像アセットを一つのトランザクションで保存する。
     *
     * @param data 初回保存するプリントと画像アセット
     * @returns 保存が完了したときに解決するPromise
     */
    create(data: WorksheetWithAssets): Promise<void>;
    /**
     * 編集済みプリントを保存し、設定に応じて未参照アセットを整理する。
     *
     * @param worksheet 永続化する最新のプリント
     * @param options 未参照アセットの削除方法と履歴上保持するアセット
     * @returns 保存とアセット整理が完了したときに解決するPromise
     */
    save(worksheet: Worksheet, options?: SaveWorksheetOptions): Promise<void>;
    /**
     * 指定したプリントへ削除日時を設定してごみ箱へ移す。
     *
     * @param id ごみ箱へ移すプリントの識別子
     * @returns 削除日時を反映して保存したプリント
     */
    trash(id: string): Promise<Worksheet>;
    /**
     * ごみ箱内のプリントから削除日時を取り除いて一覧へ戻す。
     *
     * @param id 復元するプリントの識別子
     * @returns 復元状態を反映して保存したプリント
     */
    restore(id: string): Promise<Worksheet>;
    /**
     * 指定したプリントと所有する画像アセットをIndexedDBから完全に削除する。
     *
     * @param id 完全に削除するプリントの識別子
     * @returns 削除トランザクションが完了したときに解決するPromise
     */
    deletePermanently(id: string): Promise<void>;
    /**
     * ごみ箱内の全プリントと、それらが所有する画像アセットを完全に削除する。
     *
     * @returns 完全に削除したプリントの件数
     */
    emptyTrash(): Promise<number>;
    /**
     * プリントと参照画像を新しい識別子で複製し、独立して編集できる状態にする。
     *
     * @param id 複製元となるプリントの識別子
     * @returns 新しい識別子と題名を持つ複製済みプリント
     */
    duplicate(id: string): Promise<Worksheet>;
    /**
     * 画像アセットと、その参照を含む最新プリントを同じトランザクションで保存する。
     *
     * @param asset 追加または差し替えで保存する画像アセット
     * @param worksheet アセット参照を反映したプリント
     * @returns 両方の保存が完了したときに解決するPromise
     */
    putAsset(asset: AssetRecord, worksheet: Worksheet): Promise<void>;
    /**
     * ごみ箱内を含む保存済みプリントの総数を取得する。
     *
     * @returns IndexedDBに保存されているプリント件数
     */
    count(): Promise<number>;
}
