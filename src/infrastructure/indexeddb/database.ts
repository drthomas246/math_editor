import Dexie, { type EntityTable } from "dexie";
import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
export type EditLockRecord = {
    worksheetId: string;
    ownerTabId: string;
    lockToken: string;
    acquiredAt: string;
    heartbeatAt: string;
};
export class MathWorksheetDatabase extends Dexie {
    worksheets!: EntityTable<Worksheet, "id">;
    assets!: EntityTable<AssetRecord, "id">;
    editLocks!: EntityTable<EditLockRecord, "worksheetId">;
    /**
     * 利用に必要な初期状態を設定する。
     *
     * @param name nameとして使用する値
     */
    constructor(name = "math-worksheet-db") {
        super(name);
        this.version(1).stores({
            worksheets: "id, updatedAt, deletedAt, title",
            assets: "id, worksheetId, createdAt",
            editLocks: "worksheetId, ownerTabId, heartbeatAt",
        });
    }
}
export const database = new MathWorksheetDatabase();
