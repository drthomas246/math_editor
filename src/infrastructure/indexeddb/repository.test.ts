import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSingleBackup, hydrateBackup, parseBackup } from "../../application/backup/backup";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import type { AssetRecord } from "../../domain/worksheet/worksheet";
import { MathWorksheetDatabase } from "./database";
import { DexieWorksheetRepository } from "./dexie-worksheet-repository";

let db: MathWorksheetDatabase;
let repository: DexieWorksheetRepository;

beforeEach(() => {
  db = new MathWorksheetDatabase(`test-${crypto.randomUUID()}`);
  repository = new DexieWorksheetRepository(db);
});

afterEach(async () => db.delete());

describe("DexieWorksheetRepository", () => {
  it("作成・保存・ゴミ箱・復元・完全削除を往復する", async () => {
    const worksheet = createWorksheet();
    await repository.create({ worksheet, assets: [] });
    expect((await repository.list()).worksheets).toHaveLength(1);
    const trashed = await repository.trash(worksheet.id);
    expect(trashed.deletedAt).not.toBeNull();
    const restored = await repository.restore(worksheet.id);
    expect(restored.deletedAt).toBeNull();
    await repository.deletePermanently(worksheet.id);
    expect(await repository.get(worksheet.id)).toBeNull();
  });

  it("完全削除で関連Assetも削除する", async () => {
    const worksheet = createWorksheet();
    const asset: AssetRecord = { id: crypto.randomUUID(), worksheetId: worksheet.id, mimeType: "image/png", blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), width: 1, height: 1, createdAt: new Date().toISOString() };
    await repository.create({ worksheet, assets: [asset] });
    await repository.deletePermanently(worksheet.id);
    expect(await db.assets.count()).toBe(0);
  });

  it("単一JSONを別IDとして復元し画像バイト列を維持する", async () => {
    const worksheet = createWorksheet();
    const asset: AssetRecord = { id: crypto.randomUUID(), worksheetId: worksheet.id, mimeType: "image/png", blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), width: 2, height: 3, createdAt: new Date().toISOString() };
    worksheet.problems[0]!.contents.push({ id: crypto.randomUUID(), type: "image", assetId: asset.id, alt: "", placement: "block", widthPercent: 50 });
    const backup = await createSingleBackup(worksheet, [asset]);
    const parsed = parseBackup(JSON.stringify(backup));
    const [hydrated] = hydrateBackup(parsed);
    expect(hydrated!.worksheet.id).not.toBe(worksheet.id);
    expect([...new Uint8Array(await hydrated!.assets[0]!.blob.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});
