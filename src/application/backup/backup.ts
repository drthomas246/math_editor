import {
  MathWorksheetFileSchema,
  type AssetRecord,
  type BackupAsset,
  type MathWorksheetArchive,
  type MathWorksheetFile,
  type Worksheet,
} from "../../domain/worksheet/worksheet";
import { createId } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

function selectReferencedAssets(
  worksheets: readonly Worksheet[],
  assets: readonly AssetRecord[],
): AssetRecord[] {
  const worksheetIds = new Set(worksheets.map((worksheet) => worksheet.id));
  const referencedAssetIds = collectReferencedAssetIds(worksheets);
  return assets.filter((asset) => (
    worksheetIds.has(asset.worksheetId) && referencedAssetIds.has(asset.id)
  ));
}

export async function toBackupAsset(asset: AssetRecord): Promise<BackupAsset> {
  return {
    id: asset.id,
    worksheetId: asset.worksheetId,
    mimeType: asset.mimeType,
    dataBase64: bytesToBase64(new Uint8Array(await asset.blob.arrayBuffer())),
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt,
  };
}

export async function createSingleBackup(
  worksheet: Worksheet,
  assets: AssetRecord[],
): Promise<MathWorksheetFile> {
  const referencedAssets = selectReferencedAssets([worksheet], assets);
  return MathWorksheetFileSchema.parse({
    format: "math-worksheet",
    kind: "single",
    version: 1,
    exportedAt: new Date().toISOString(),
    worksheet,
    assets: await Promise.all(referencedAssets.map(toBackupAsset)),
  });
}

export async function createArchiveBackup(
  worksheets: Worksheet[],
  assets: AssetRecord[],
): Promise<MathWorksheetArchive> {
  const activeWorksheets = worksheets.filter((worksheet) => worksheet.deletedAt === null);
  const referencedAssets = selectReferencedAssets(activeWorksheets, assets);
  return MathWorksheetFileSchema.parse({
    format: "math-worksheet",
    kind: "archive",
    version: 1,
    exportedAt: new Date().toISOString(),
    worksheets: activeWorksheets,
    assets: await Promise.all(referencedAssets.map(toBackupAsset)),
  }) as MathWorksheetArchive;
}

export function parseBackup(text: string): MathWorksheetFile {
  return MathWorksheetFileSchema.parse(JSON.parse(text));
}

export function hydrateBackup(file: MathWorksheetFile): Array<{ worksheet: Worksheet; assets: AssetRecord[] }> {
  const worksheets = file.kind === "single" ? [file.worksheet] : file.worksheets;
  return worksheets.map((sourceWorksheet) => {
    const worksheet = structuredClone(sourceWorksheet);
    const worksheetId = createId();
    const remap = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(remap);
      else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.id === "string") {
          const next = record.id === sourceWorksheet.id ? worksheetId : createId();
          record.id = next;
        }
        Object.values(record).forEach(remap);
      }
    };
    remap(worksheet);
    worksheet.updatedAt = new Date().toISOString();
    worksheet.createdAt = worksheet.updatedAt;
    const sourceAssets = file.assets.filter((asset) => asset.worksheetId === sourceWorksheet.id);
    const assetIds = new Map(sourceAssets.map((asset) => [asset.id, createId()]));
    const replaceAssetIds = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(replaceAssetIds);
      else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.assetId === "string" && assetIds.has(record.assetId)) {
          record.assetId = assetIds.get(record.assetId)!;
        }
        Object.values(record).forEach(replaceAssetIds);
      }
    };
    replaceAssetIds(worksheet);
    const assets = sourceAssets.map((asset): AssetRecord => {
      const bytes = base64ToBytes(asset.dataBase64);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return {
      id: assetIds.get(asset.id)!,
      worksheetId,
      mimeType: asset.mimeType,
      blob: new Blob([buffer], { type: asset.mimeType }),
      width: asset.width,
      height: asset.height,
      createdAt: worksheet.createdAt,
      };
    });
    return { worksheet, assets };
  });
}
