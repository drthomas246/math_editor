import { describe, expect, it } from "vitest";

import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
import { createId, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { createArchiveBackup, createSingleBackup } from "./backup";

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
});
