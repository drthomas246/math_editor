import type { Table } from "dexie";

import type {
  WorksheetListResult,
  WorksheetRepository,
  WorksheetWithAssets,
  SaveWorksheetOptions,
} from "../../application/repositories/worksheet-repository";
import { STRUCTURE_LIMITS } from "../../domain/worksheet/structure-limits";
import {
  AssetRecordSchema,
  WorksheetSchema,
  type AssetRecord,
  type Worksheet,
} from "../../domain/worksheet/worksheet";
import { cloneWorksheetWithNewIds, setWorksheetTitle } from "../../domain/worksheet/worksheet.commands";
import { createId } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import { database, type MathWorksheetDatabase } from "./database";

export class WorksheetLimitError extends Error {
  readonly code = "WORKSHEET_LIMIT_EXCEEDED";
}

export class DexieWorksheetRepository implements WorksheetRepository {
  constructor(private readonly db: MathWorksheetDatabase = database) {}

  async list(): Promise<WorksheetListResult> {
    const rows = await this.db.worksheets.toArray();
    const worksheets: Worksheet[] = [];
    let invalidCount = 0;
    for (const row of rows) {
      const result = WorksheetSchema.safeParse(row);
      if (result.success) worksheets.push(result.data);
      else invalidCount += 1;
    }
    return { worksheets, invalidCount };
  }

  async get(id: string): Promise<WorksheetWithAssets | null> {
    const row = await this.db.worksheets.get(id);
    if (!row) return null;
    const worksheet = WorksheetSchema.parse(row);
    const assetRows = await this.db.assets.where("worksheetId").equals(id).toArray();
    const assets = assetRows.map((asset) => AssetRecordSchema.parse(asset));
    return { worksheet, assets };
  }

  async count(): Promise<number> {
    return this.db.worksheets.count();
  }

  async create(data: WorksheetWithAssets): Promise<void> {
    const worksheet = WorksheetSchema.parse(data.worksheet);
    const assets = data.assets.map((asset) => AssetRecordSchema.parse(asset));
    await this.db.transaction("rw", this.db.worksheets, this.db.assets, async () => {
      const count = await this.db.worksheets.count();
      if (count >= STRUCTURE_LIMITS.worksheetsPerArchive) throw new WorksheetLimitError();
      await this.db.worksheets.add(worksheet);
      if (assets.length) await this.db.assets.bulkAdd(assets);
    });
  }

  async createMany(data: WorksheetWithAssets[]): Promise<void> {
    const parsed = data.map(({ worksheet, assets }) => ({
      worksheet: WorksheetSchema.parse(worksheet),
      assets: assets.map((asset) => AssetRecordSchema.parse(asset)),
    }));
    await this.db.transaction("rw", this.db.worksheets, this.db.assets, async () => {
      const count = await this.db.worksheets.count();
      if (count + parsed.length > STRUCTURE_LIMITS.worksheetsPerArchive) throw new WorksheetLimitError();
      await this.db.worksheets.bulkAdd(parsed.map((item) => item.worksheet));
      const assets = parsed.flatMap((item) => item.assets);
      if (assets.length) await this.db.assets.bulkAdd(assets);
    });
  }

  async save(value: Worksheet, options: SaveWorksheetOptions = {}): Promise<void> {
    const worksheet = WorksheetSchema.parse(value);
    if (!options.pruneUnreferencedAssets) {
      await this.db.worksheets.put(worksheet);
      return;
    }

    const retainedAssetIds = collectReferencedAssetIds(worksheet);
    options.retainedAssetIds?.forEach((assetId) => retainedAssetIds.add(assetId));
    await this.db.transaction("rw", this.db.worksheets, this.db.assets, async () => {
      await this.db.worksheets.put(worksheet);
      const assets = await this.db.assets.where("worksheetId").equals(worksheet.id).toArray();
      const unreferencedIds = assets
        .filter((asset) => !retainedAssetIds.has(asset.id))
        .map((asset) => asset.id);
      if (unreferencedIds.length) await this.db.assets.bulkDelete(unreferencedIds);
    });
  }

  async trash(id: string): Promise<Worksheet> {
    return this.updateDeletion(id, new Date().toISOString());
  }

  async restore(id: string): Promise<Worksheet> {
    return this.updateDeletion(id, null);
  }

  private async updateDeletion(id: string, deletedAt: string | null): Promise<Worksheet> {
    const current = await this.db.worksheets.get(id);
    if (!current) throw new Error("プリントが見つかりません");
    const worksheet = structuredClone(current);
    worksheet.deletedAt = deletedAt;
    worksheet.updatedAt = new Date().toISOString();
    WorksheetSchema.parse(worksheet);
    await this.db.worksheets.put(worksheet);
    return worksheet;
  }

  async deletePermanently(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.worksheets, this.db.assets, async () => {
      await this.db.assets.where("worksheetId").equals(id).delete();
      await this.db.worksheets.delete(id);
    });
  }

  async emptyTrash(): Promise<number> {
    return this.db.transaction("rw", this.db.worksheets, this.db.assets, async () => {
      const deleted = (await this.db.worksheets.toArray()).filter((worksheet) => worksheet.deletedAt !== null);
      for (const worksheet of deleted) {
        await this.db.assets.where("worksheetId").equals(worksheet.id).delete();
      }
      await this.db.worksheets.bulkDelete(deleted.map((worksheet) => worksheet.id));
      return deleted.length;
    });
  }

  async duplicate(id: string): Promise<Worksheet> {
    const source = await this.get(id);
    if (!source) throw new Error("プリントが見つかりません");
    let worksheet = cloneWorksheetWithNewIds(source.worksheet);
    const assetMap = new Map<string, string>();
    const assets = source.assets.map((asset) => {
      const nextId = createId();
      assetMap.set(asset.id, nextId);
      return { ...asset, id: nextId, worksheetId: worksheet.id, createdAt: new Date().toISOString() };
    });
    const replaceReferences = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(replaceReferences);
      else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.assetId === "string" && assetMap.has(record.assetId)) {
          record.assetId = assetMap.get(record.assetId)!;
        }
        Object.values(record).forEach(replaceReferences);
      }
    };
    replaceReferences(worksheet);
    worksheet = setWorksheetTitle(worksheet, worksheet.title);
    await this.create({ worksheet, assets });
    return worksheet;
  }

  async putAsset(assetValue: AssetRecord, worksheetValue: Worksheet): Promise<void> {
    const asset = AssetRecordSchema.parse(assetValue);
    const worksheet = WorksheetSchema.parse(worksheetValue);
    if (asset.worksheetId !== worksheet.id) throw new Error("Assetの所属プリントが一致しません");
    await this.db.transaction("rw", this.db.assets, this.db.worksheets, async () => {
      await this.db.assets.put(asset);
      await this.db.worksheets.put(worksheet);
    });
  }
}

export const worksheetRepository = new DexieWorksheetRepository();

export async function clearDatabaseForTests(db: MathWorksheetDatabase): Promise<void> {
  const tables: Table[] = [db.worksheets, db.assets, db.editLocks];
  await db.transaction("rw", tables, async () => Promise.all(tables.map((table) => table.clear())));
}
