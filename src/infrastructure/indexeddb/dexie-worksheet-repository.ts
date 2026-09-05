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
     * 利用に必要な初期状態を設定する。
     */
    constructor() {
        super("プリント数の上限に達しています");
    }
}
export class DexieWorksheetRepository implements WorksheetRepository {
    /**
     * 利用に必要な初期状態を設定する。
     *
     * @param db dbとして使用する値
     */
    constructor(private readonly db: MathWorksheetDatabase = database) { }
    /**
     * listに必要な処理を実行する。
     *
     * @returns 非同期処理の結果
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
     * getで必要な値を取得する。
     *
     * @param id 対象を識別するID
     * @returns 非同期処理の結果
     */
    async get(id: string): Promise<WorksheetWithAssets | null> {
        const row = await this.db.worksheets.get(id);
        if (!row)
            return null;
        const worksheet = WorksheetSchema.parse(row);
        const assetRows = await this.db.assets.where("worksheetId").equals(id).toArray();
        const assets = assetRows.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem1(asset) {
            return AssetRecordSchema.parse(asset);
        }));
        return { worksheet, assets };
    }
    /**
     * countで必要な値を取得する。
     *
     * @returns 非同期処理の結果
     */
    async count(): Promise<number> {
        return this.db.worksheets.count();
    }
    /**
     * createで必要な値を作成する。
     *
     * @param data 処理対象の値
     * @returns 非同期処理の結果
     */
    async create(data: WorksheetWithAssets): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis2 = this;
        const worksheet = WorksheetSchema.parse(data.worksheet);
        const assets = data.assets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem3(asset) {
            return AssetRecordSchema.parse(asset);
        }));
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 一連のデータ更新を同じトランザクション内で実行する。
         *
         * @returns 非同期処理の結果
         */
        async function runDatabaseTransaction4() {
            const count = await commentRuleThis2.db.worksheets.count();
            if (count >= STRUCTURE_LIMITS.worksheetsPerArchive)
                throw new WorksheetLimitError();
            await commentRuleThis2.db.worksheets.add(worksheet);
            if (assets.length)
                await commentRuleThis2.db.assets.bulkAdd(assets);
        }));
    }
    /**
     * createManyで必要な値を作成する。
     *
     * @param data 処理対象の値
     * @returns 非同期処理の結果
     */
    async createMany(data: WorksheetWithAssets[]): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis5 = this;
        const parsed = data.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param parameter1 parameter1として使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem6(parameter1) {
            let { worksheet, assets } = parameter1;
            return ({
                worksheet: WorksheetSchema.parse(worksheet),
                assets: assets.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param asset assetとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem7(asset) {
                    return AssetRecordSchema.parse(asset);
                })),
            });
        }));
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 一連のデータ更新を同じトランザクション内で実行する。
         *
         * @returns 非同期処理の結果
         */
        async function runDatabaseTransaction8() {
            const count = await commentRuleThis5.db.worksheets.count();
            if (count + parsed.length > STRUCTURE_LIMITS.worksheetsPerArchive)
                throw new WorksheetLimitError();
            await commentRuleThis5.db.worksheets.bulkAdd(parsed.map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem9(item) {
                return item.worksheet;
            })));
            const assets = parsed.flatMap((/**
             * 各要素を変換しながら一つの配列へ展開する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function expandItem10(item) {
                return item.assets;
            }));
            if (assets.length)
                await commentRuleThis5.db.assets.bulkAdd(assets);
        }));
    }
    /**
     * saveの対象となるデータを保存または出力する。
     *
     * @param value 処理対象の値
     * @param options optionsとして使用する値
     * @returns 非同期処理の結果
     */
    async save(value: Worksheet, options: SaveWorksheetOptions = {}): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis11 = this;
        const worksheet = WorksheetSchema.parse(value);
        if (!options.pruneUnreferencedAssets) {
            await this.db.worksheets.put(worksheet);
            return;
        }
        const retainedAssetIds = collectReferencedAssetIds(worksheet);
        options.retainedAssetIds?.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param assetId 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function processItem12(assetId) {
            return retainedAssetIds.add(assetId);
        }));
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 一連のデータ更新を同じトランザクション内で実行する。
         *
         * @returns 非同期処理の結果
         */
        async function runDatabaseTransaction13() {
            await commentRuleThis11.db.worksheets.put(worksheet);
            const assets = await commentRuleThis11.db.assets.where("worksheetId").equals(worksheet.id).toArray();
            const unreferencedIds = assets
                .filter((/**
             * 対象要素を結果へ残すか判定する。
             *
             * @param asset assetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function filterItem14(asset) {
                return !retainedAssetIds.has(asset.id);
            }))
                .map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param asset assetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem15(asset) {
                return asset.id;
            }));
            if (unreferencedIds.length)
                await commentRuleThis11.db.assets.bulkDelete(unreferencedIds);
        }));
    }
    /**
     * trashに必要な処理を実行する。
     *
     * @param id 対象を識別するID
     * @returns 非同期処理の結果
     */
    async trash(id: string): Promise<Worksheet> {
        return this.updateDeletion(id, new Date().toISOString());
    }
    /**
     * restoreに必要な処理を実行する。
     *
     * @param id 対象を識別するID
     * @returns 非同期処理の結果
     */
    async restore(id: string): Promise<Worksheet> {
        return this.updateDeletion(id, null);
    }
    /**
     * updateDeletionの対象となる状態を更新する。
     *
     * @param id 対象を識別するID
     * @param deletedAt deletedAtとして使用する値
     * @returns 非同期処理の結果
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
     * deletePermanentlyの対象となる要素を削除または解放する。
     *
     * @param id 対象を識別するID
     * @returns 非同期処理の結果
     */
    async deletePermanently(id: string): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis16 = this;
        await this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 一連のデータ更新を同じトランザクション内で実行する。
         *
         * @returns 非同期処理の結果
         */
        async function runDatabaseTransaction17() {
            await commentRuleThis16.db.assets.where("worksheetId").equals(id).delete();
            await commentRuleThis16.db.worksheets.delete(id);
        }));
    }
    /**
     * emptyTrashに必要な処理を実行する。
     *
     * @returns 非同期処理の結果
     */
    async emptyTrash(): Promise<number> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis18 = this;
        return this.db.transaction("rw", this.db.worksheets, this.db.assets, (/**
         * 一連のデータ更新を同じトランザクション内で実行する。
         *
         * @returns 非同期処理の結果
         */
        async function runDatabaseTransaction19() {
            const deleted = (await commentRuleThis18.db.worksheets.toArray()).filter((/**
             * 対象要素を結果へ残すか判定する。
             *
             * @param worksheet worksheetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function filterItem20(worksheet) {
                return worksheet.deletedAt !== null;
            }));
            for (const worksheet of deleted) {
                await commentRuleThis18.db.assets.where("worksheetId").equals(worksheet.id).delete();
            }
            await commentRuleThis18.db.worksheets.bulkDelete(deleted.map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param worksheet worksheetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem21(worksheet) {
                return worksheet.id;
            })));
            return deleted.length;
        }));
    }
    /**
     * duplicateで必要な値を作成する。
     *
     * @param id 対象を識別するID
     * @returns 非同期処理の結果
     */
    async duplicate(id: string): Promise<Worksheet> {
        const source = await this.get(id);
        if (!source)
            throw new Error("プリントが見つかりません");
        let worksheet = cloneWorksheetWithNewIds(source.worksheet);
        const assetMap = new Map<string, string>();
        const assets = source.assets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem22(asset) {
            const nextId = createId();
            assetMap.set(asset.id, nextId);
            return { ...asset, id: nextId, worksheetId: worksheet.id, createdAt: new Date().toISOString() };
        }));
        const replaceReferences = (/**
         * replaceReferencesの対象となる状態を更新する。
         *
         * @param value 処理対象の値
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
     * putAssetに必要な処理を実行する。
     *
     * @param assetValue assetValueとして使用する値
     * @param worksheetValue worksheetValueとして使用する値
     * @returns 非同期処理の結果
     */
    async putAsset(assetValue: AssetRecord, worksheetValue: Worksheet): Promise<void> {
        // 名前付きコールバックでもリポジトリのDB参照を維持するためthisを退避する。
        // oxlint-disable-next-line typescript/no-this-alias
        const commentRuleThis24 = this;
        const asset = AssetRecordSchema.parse(assetValue);
        const worksheet = WorksheetSchema.parse(worksheetValue);
        if (asset.worksheetId !== worksheet.id)
            throw new Error("Assetの所属プリントが一致しません");
        await this.db.transaction("rw", this.db.assets, this.db.worksheets, (/**
         * 一連のデータ更新を同じトランザクション内で実行する。
         *
         * @returns 非同期処理の結果
         */
        async function runDatabaseTransaction25() {
            await commentRuleThis24.db.assets.put(asset);
            await commentRuleThis24.db.worksheets.put(worksheet);
        }));
    }
}
export const worksheetRepository = new DexieWorksheetRepository();
/**
 * clearDatabaseForTestsの対象となる要素を削除または解放する。
 *
 * @param db dbとして使用する値
 * @returns 非同期処理の結果
 */
export async function clearDatabaseForTests(db: MathWorksheetDatabase): Promise<void> {
    const tables: Table[] = [db.worksheets, db.assets, db.editLocks];
    await db.transaction("rw", tables, (/**
     * 一連のデータ更新を同じトランザクション内で実行する。
     *
     * @returns 非同期処理の結果
     */
    async function runDatabaseTransaction26() {
        return Promise.all(tables.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param table tableとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem27(table) {
            return table.clear();
        })));
    }));
}
