import type { Table } from "dexie";
import type { WorksheetListResult, WorksheetRepository, WorksheetWithAssets, SaveWorksheetOptions, } from "../../application/repositories/worksheet-repository";
import { STRUCTURE_LIMITS } from "../../domain/worksheet/structure-limits";
import { AssetRecordSchema, WorksheetSchema, type AssetRecord, type Worksheet, } from "../../domain/worksheet/worksheet";
import { cloneWorksheetWithNewIds, setWorksheetTitle } from "../../domain/worksheet/worksheet.commands";
import { createId } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import { database, type MathWorksheetDatabase } from "./database";
export class WorksheetLimitError extends Error {
    readonly code = "WORKSHEET_LIMIT_EXCEEDED";
    /**
     * プリント・Limit・エラーの基底クラスを、受け取った初期値で初期化する。
     */
    constructor() {
        super("プリント数の上限に達しています");
    }
}
export class DexieWorksheetRepository implements WorksheetRepository {
    /**
     * 読み書きに使用するIndexedDBデータベースを基に条件成立後に実行する処理を導出する。
     *
     * @param db 読み書きに使用するIndexedDBデータベース
     */
    constructor(private readonly db: MathWorksheetDatabase = database) { }
    /**
     * 保存済みプリントをIndexedDBから読み込み、一覧表示用の順序と検証結果を返す。
     *
     * @returns 保存済みプリントをIndexedDBから読み込み、一覧表示用の順序と検証結果を返す処理の完了時に解決するPromise
     */
    async list(): Promise<WorksheetListResult> {
        const rows = await this.db.worksheets.toArray();
        const worksheets: Worksheet[] = [];
        let invalidCount = 0;
        for (const row of rows) {
            const result = WorksheetSchema.safeParse(row);
            if (result.success)
                worksheets.push(result.data);
            else
                invalidCount += 1;
        }
        return { worksheets, invalidCount };
    }
    /**
     * 指定された識別子のプリントと参照画像をIndexedDBから読み込む。
     *
     * @param id 対象を識別するID
     * @returns 指定された識別子のプリントと参照画像をIndexedDBから読み込む処理の完了時に解決するPromise
     */
    async get(id: string): Promise<WorksheetWithAssets | null> {
        const row = await this.db.worksheets.get(id);
        if (!row)
            return null;
        const worksheet = WorksheetSchema.parse(row);
        const assetRows = await this.db.assets.where("worksheetId").equals(id).toArray();
        const assets = assetRows.map((/**
         * 各処理対象の画像アセットをスキーマ検証済みのデータへ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns スキーマ検証済みのデータ
         */
        function mapItem1(asset) {
            return AssetRecordSchema.parse(asset);
        }));
        return { worksheet, assets };
    }
    /**
     * IndexedDBに保存されているプリントの総数を取得する。
     *
     * @returns IndexedDBに保存されているプリントの総数を取得する処理の完了時に解決するPromise
     */
    async count(): Promise<number> {
        return this.db.worksheets.count();
    }
    /**
     * 新しいプリントと画像アセットを同じトランザクションで保存する。
     *
     * @param data 今回の判定・変換・更新で参照するデータ
     * @returns 新しいプリントと画像アセットを同じトランザクションで保存する処理の完了時に解決するPromise
     */
    async create(data: WorksheetWithAssets): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext2 = this;
        const worksheet = WorksheetSchema.parse(data.worksheet);
        const assets = data.assets.map((/**
         * 各処理対象の画像アセットをスキーマ検証済みのデータへ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns スキーマ検証済みのデータ
         */
        function mapItem3(asset) {
            return AssetRecordSchema.parse(asset);
        }));
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
         *
         * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
         */
        async function runDatabaseTransaction4() {
            const count = await instanceContext2.db.worksheets.count();
            if (count >= STRUCTURE_LIMITS.worksheetsPerArchive)
                throw new WorksheetLimitError();
            await instanceContext2.db.worksheets.add(worksheet);
            if (assets.length)
                await instanceContext2.db.assets.bulkAdd(assets);
        }));
    }
    /**
     * 性能試験用の複数プリントと画像アセットをまとめて保存する。
     *
     * @param data データを順序または対応関係ごと保持する集合
     * @returns 性能試験用の複数プリントと画像アセットをまとめて保存する処理の完了時に解決するPromise
     */
    async createMany(data: WorksheetWithAssets[]): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext5 = this;
        const parsed = data.map((/**
         * プリントと画像アセットをスキーマ検証し、まとめて保存できる形式へ整える。
         *
         * @param callbackInput 検証するプリントと関連画像アセット
         * @returns スキーマ検証済みのプリントと画像アセット
         */
        function mapItem6(callbackInput) {
            let { worksheet, assets } = callbackInput;
            return ({
                worksheet: WorksheetSchema.parse(worksheet),
                assets: assets.map((/**
                 * 各処理対象の画像アセットをスキーマ検証済みのデータへ変換する。
                 *
                 * @param asset 処理対象の画像アセット
                 * @returns スキーマ検証済みのデータ
                 */
                function mapItem7(asset) {
                    return AssetRecordSchema.parse(asset);
                })),
            });
        }));
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
         *
         * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
         */
        async function runDatabaseTransaction8() {
            const count = await instanceContext5.db.worksheets.count();
            if (count + parsed.length > STRUCTURE_LIMITS.worksheetsPerArchive)
                throw new WorksheetLimitError();
            await instanceContext5.db.worksheets.bulkAdd(parsed.map((/**
             * 各要素を要素の処理対象となるプリントへ変換する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素の処理対象となるプリント
             */
            function mapItem9(item) {
                return item.worksheet;
            })));
            const assets = parsed.flatMap((/**
             * 各要素を要素のプリントに関連付ける画像アセット一覧へ変換し、空の結果を除いて一つの配列へ展開する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素のプリントに関連付ける画像アセット一覧
             */
            function expandItem10(item) {
                return item.assets;
            }));
            if (assets.length)
                await instanceContext5.db.assets.bulkAdd(assets);
        }));
    }
    /**
     * 保存を利用者が再利用できる永続形式へ出力する。
     *
     * @param value 保存で判定または変換する入力値
     * @param options 処理方法を指定するオプション
     * @returns 編集済みプリントを保存し、設定に応じて未参照画像を整理する処理の完了時に解決するPromise
     */
    async save(value: Worksheet, options: SaveWorksheetOptions = {}): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext11 = this;
        const worksheet = WorksheetSchema.parse(value);
        if (!options.pruneUnreferencedAssets) {
            await this.db.worksheets.put(worksheet);
            return;
        }
        const retainedAssetIds = collectReferencedAssetIds(worksheet);
        options.retainedAssetIds?.forEach((/**
         * 各アセット・Idについてaddを実行し、対応関係または検証状態を更新する。
         *
         * @param assetId 対象を識別するID
         */
        function processItem12(assetId) {
            return retainedAssetIds.add(assetId);
        }));
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
         *
         * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
         */
        async function runDatabaseTransaction13() {
            await instanceContext11.db.worksheets.put(worksheet);
            const assets = await instanceContext11.db.assets.where("worksheetId").equals(worksheet.id).toArray();
            const unreferencedIds = assets
                .filter((/**
             * retained・アセット・Idsに対するhas条件が存在しない要素だけを後続処理へ残す。
             *
             * @param asset 処理対象の画像アセット
             * @returns retained・アセット・Idsに対するhas条件が存在しない場合はtrue
             */
            function filterItem14(asset) {
                return !retainedAssetIds.has(asset.id);
            }))
                .map((/**
             * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
             *
             * @param asset 処理対象の画像アセット
             * @returns 処理対象の画像アセットの対象を一意に特定する識別子
             */
            function mapItem15(asset) {
                return asset.id;
            }));
            if (unreferencedIds.length)
                await instanceContext11.db.assets.bulkDelete(unreferencedIds);
        }));
    }
    /**
     * プリントへ削除日時を記録し、一覧からごみ箱へ移す。
     *
     * @param id 対象を識別するID
     * @returns プリントへ削除日時を記録し、一覧からごみ箱へ移す処理の完了時に解決するPromise
     */
    async trash(id: string): Promise<Worksheet> {
        return this.updateDeletion(id, new Date().toISOString());
    }
    /**
     * ごみ箱内のプリントから削除日時を取り除き、通常一覧へ戻す。
     *
     * @param id 対象を識別するID
     * @returns ごみ箱内のプリントから削除日時を取り除き、通常一覧へ戻す処理の完了時に解決するPromise
     */
    async restore(id: string): Promise<Worksheet> {
        return this.updateDeletion(id, null);
    }
    /**
     * 処理対象となるプリントの削除日時をごみ箱へ移した日時へ更新する。
     *
     * @param id 対象を識別するID
     * @param deletedAt ごみ箱へ移した日時
     * @returns 処理対象となるプリントの削除日時をごみ箱へ移した日時へ更新する処理の完了時に解決するPromise
     */
    private async updateDeletion(id: string, deletedAt: string | null): Promise<Worksheet> {
        const current = await this.db.worksheets.get(id);
        if (!current)
            throw new Error("プリントが見つかりません");
        const worksheet = structuredClone(current);
        worksheet.deletedAt = deletedAt;
        worksheet.updatedAt = new Date().toISOString();
        WorksheetSchema.parse(worksheet);
        await this.db.worksheets.put(worksheet);
        return worksheet;
    }
    /**
     * Permanentlyと不要になった関連データを安全に取り除く。
     *
     * @param id 対象を識別するID
     * @returns プリントと所有画像を同じトランザクションで完全に削除する処理の完了時に解決するPromise
     */
    async deletePermanently(id: string): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext16 = this;
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
         *
         * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
         */
        async function runDatabaseTransaction17() {
            await instanceContext16.db.assets.where("worksheetId").equals(id).delete();
            await instanceContext16.db.worksheets.delete(id);
        }));
    }
    /**
     * ごみ箱内の全プリントと所有画像を完全に削除する。
     *
     * @returns ごみ箱内の全プリントと所有画像を完全に削除する処理の完了時に解決するPromise
     */
    async emptyTrash(): Promise<number> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext18 = this;
        return this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
         *
         * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
         */
        async function runDatabaseTransaction19() {
            const deleted = (await instanceContext18.db.worksheets.toArray()).filter((/**
             * 処理対象となるプリントのごみ箱へ移した日時がnullと異なる要素だけを後続処理へ残す。
             *
             * @param worksheet 処理対象となるプリント
             * @returns 処理対象となるプリントのごみ箱へ移した日時がnullと異なる場合はtrue
             */
            function filterItem20(worksheet) {
                return worksheet.deletedAt !== null;
            }));
            for (const worksheet of deleted) {
                await instanceContext18.db.assets.where("worksheetId").equals(worksheet.id).delete();
            }
            await instanceContext18.db.worksheets.bulkDelete(deleted.map((/**
             * 各処理対象となるプリントを処理対象となるプリントの対象を一意に特定する識別子へ変換する。
             *
             * @param worksheet 処理対象となるプリント
             * @returns 処理対象となるプリントの対象を一意に特定する識別子
             */
            function mapItem21(worksheet) {
                return worksheet.id;
            })));
            return deleted.length;
        }));
    }
    /**
     * プリントと参照画像を新しい識別子で複製し、独立編集できる状態にする。
     *
     * @param id 対象を識別するID
     * @returns プリントと参照画像を新しい識別子で複製し、独立編集できる状態にする処理の完了時に解決するPromise
     */
    async duplicate(id: string): Promise<Worksheet> {
        const source = await this.get(id);
        if (!source)
            throw new Error("プリントが見つかりません");
        let worksheet = cloneWorksheetWithNewIds(source.worksheet);
        const assetMap = new Map<string, string>();
        const assets = source.assets.map((/**
         * 各処理対象の画像アセットを値・対象を一意に特定する識別子・プリント・Id・created・Atを持つオブジェクトへ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 値・対象を一意に特定する識別子・プリント・Id・created・Atを持つオブジェクト
         */
        function mapItem22(asset) {
            const nextId = createId();
            assetMap.set(asset.id, nextId);
            return { ...asset, id: nextId, worksheetId: worksheet.id, createdAt: new Date().toISOString() };
        }));
        const replaceReferences = (/**
         * replace・Referencesをis・Arrayで処理し、その結果を呼び出し元へ反映する。
         *
         * @param value replace・Referencesで判定または変換する入力値
         */
        function replaceReferencesImplementation23(value: unknown): void {
            if (Array.isArray(value))
                value.forEach(replaceReferences);
            else if (value && typeof value === "object") {
                const record = value as Record<string, unknown>;
                if (typeof record.assetId === "string" && assetMap.has(record.assetId)) {
                    record.assetId = assetMap.get(record.assetId)!;
                }
                Object.values(record).forEach(replaceReferences);
            }
        });
        replaceReferences(worksheet);
        worksheet = setWorksheetTitle(worksheet, worksheet.title);
        await this.create({ worksheet, assets });
        return worksheet;
    }
    /**
     * 画像アセットとその参照を含む最新プリントを同じトランザクションで保存する。
     *
     * @param assetValue リポジトリへ保存する画像アセット
     * @param worksheetValue リポジトリへ保存するプリント
     * @returns 画像アセットとその参照を含む最新プリントを同じトランザクションで保存する処理の完了時に解決するPromise
     */
    async putAsset(assetValue: AssetRecord, worksheetValue: Worksheet): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const instanceContext24 = this;
        const asset = AssetRecordSchema.parse(assetValue);
        const worksheet = WorksheetSchema.parse(worksheetValue);
        if (asset.worksheetId !== worksheet.id)
            throw new Error("Assetの所属プリントが一致しません");
        await this.db.transaction("rw", this.db.assets, this.db.worksheets, (/**
         * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
         *
         * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
         */
        async function runDatabaseTransaction25() {
            await instanceContext24.db.assets.put(asset);
            await instanceContext24.db.worksheets.put(worksheet);
        }));
    }
}
export const worksheetRepository = new DexieWorksheetRepository();
/**
 * Database・For・Testsと不要になった関連データを安全に取り除く。
 *
 * @param db 読み書きに使用するIndexedDBデータベース
 * @returns Database・For・Testsと、参照されなくなった関連データを安全に取り除く処理の完了時に解決するPromise
 */
export async function clearDatabaseForTests(db: MathWorksheetDatabase): Promise<void> {
    const tables: Table[] = [db.worksheets, db.assets, db.editLocks];
    await db.transaction("rw", tables, (/**
     * 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする。
     *
     * @returns 関連するIndexedDB更新を同一トランザクションへまとめ、途中状態が残らないようにする処理の完了時に解決するPromise
     */
    async function runDatabaseTransaction26() {
        return Promise.all(tables.map((/**
         * 各編集または検証の対象となる表をclearの結果へ変換する。
         *
         * @param table 編集または検証の対象となる表
         * @returns clearの結果
         */
        function mapItem27(table) {
            return table.clear();
        })));
    }));
}
