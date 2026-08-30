import { describe, expect, it, vi } from "vitest";

import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
import { createId, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import {
  assertBackupInputSize,
  BackupSizeLimitError,
  createArchiveBackup,
  createSingleBackup,
  estimateBackupOutputBytes,
  hydrateBackup,
  MAX_BACKUP_FILE_BYTES,
  serializeBackup,
} from "./backup";

function createAsset(worksheet: Worksheet): AssetRecord {
  return {
    id: createId(),
    worksheetId: worksheet.id,
    mimeType: "image/png",
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    width: 100,
    height: 100,
    createdAt: worksheet.createdAt,
  };
}

function referenceAsset(worksheet: Worksheet, asset: AssetRecord): void {
  worksheet.problems[0]!.contents.push({
    id: createId(),
    type: "image",
    assetId: asset.id,
    alt: "",
    placement: "block",
    widthPercent: 50,
  });
}

describe("backup export", () => {
  it("個別バックアップから参照されていない余剰Assetを除外する", async () => {
    const worksheet = createWorksheet();
    const referencedAsset = createAsset(worksheet);
    const unusedAsset = createAsset(worksheet);
    referenceAsset(worksheet, referencedAsset);

    const backup = await createSingleBackup(worksheet, [unusedAsset, referencedAsset]);

    expect(backup.assets.map((asset) => asset.id)).toEqual([referencedAsset.id]);
  });

  it("全体バックアップから余剰Assetとゴミ箱専用Assetを除外する", async () => {
    const activeWorksheet = createWorksheet();
    const referencedAsset = createAsset(activeWorksheet);
    const unusedAsset = createAsset(activeWorksheet);
    referenceAsset(activeWorksheet, referencedAsset);

    const trashedWorksheet = createWorksheet();
    trashedWorksheet.deletedAt = new Date().toISOString();
    const trashedAsset = createAsset(trashedWorksheet);
    referenceAsset(trashedWorksheet, trashedAsset);

    const backup = await createArchiveBackup(
      [activeWorksheet, trashedWorksheet],
      [unusedAsset, trashedAsset, referencedAsset],
    );

    expect(backup.worksheets.map((worksheet) => worksheet.id)).toEqual([activeWorksheet.id]);
    expect(backup.assets.map((asset) => asset.id)).toEqual([referencedAsset.id]);
  });

  it("exportとimportで同じ100MiB境界を使用する", async () => {
    const backup = await createSingleBackup(createWorksheet(), []);
    const serialized = serializeBackup(backup);
    const byteLength = new TextEncoder().encode(serialized).byteLength;

    expect(serializeBackup(backup, byteLength)).toBe(serialized);
    expect(() => serializeBackup(backup, byteLength - 1)).toThrow(BackupSizeLimitError);
    expect(() => assertBackupInputSize(MAX_BACKUP_FILE_BYTES)).not.toThrow();
    expect(() => assertBackupInputSize(MAX_BACKUP_FILE_BYTES + 1)).toThrow(BackupSizeLimitError);
  });

  it("Base64化前の推定値が実際のUTF-8 JSONサイズと一致する", async () => {
    const worksheet = createWorksheet();
    worksheet.title = "日本語サイズ推定";
    worksheet.header.title = worksheet.title;
    const asset = createAsset(worksheet);
    referenceAsset(worksheet, asset);
    const backup = await createSingleBackup(worksheet, [asset]);
    if (backup.kind !== "single") throw new Error("単一バックアップを作成できませんでした");
    const { assets: _assets, ...metadata } = backup;

    expect(estimateBackupOutputBytes(metadata, [asset])).toBe(
      new TextEncoder().encode(serializeBackup(backup)).byteLength,
    );
  });

  it("推定サイズが100MiBを超える単体・全体exportはBlobをBase64化する前に拒否する", async () => {
    const worksheet = createWorksheet();
    const asset = createAsset(worksheet);
    referenceAsset(worksheet, asset);
    Object.defineProperty(asset.blob, "size", { configurable: true, value: MAX_BACKUP_FILE_BYTES });
    const arrayBuffer = vi.spyOn(asset.blob, "arrayBuffer");

    await expect(createSingleBackup(worksheet, [asset])).rejects.toThrow(BackupSizeLimitError);
    await expect(createArchiveBackup([worksheet], [asset])).rejects.toThrow(BackupSizeLimitError);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("画像の実体が宣言MIMEと異なるバックアップを保存前に拒否する", async () => {
    const worksheet = createWorksheet();
    const asset = createAsset(worksheet);
    referenceAsset(worksheet, asset);
    const backup = await createSingleBackup(worksheet, [asset]);

    await expect(hydrateBackup(backup)).rejects.toThrow(
      "バックアップ内の画像1を検証できませんでした。画像のMIME型とファイル内容が一致しません。",
    );
  });
});
