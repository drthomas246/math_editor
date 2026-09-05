import { MathWorksheetFileSchema, type AssetRecord, type BackupAsset, type MathWorksheetArchive, type MathWorksheetFile, type Worksheet, } from "../../domain/worksheet/worksheet";
import { createId } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import { assertImageByteSize, validateImageBlob, } from "../assets/image-validation";
export const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;
export class BackupSizeLimitError extends Error {
    /**
     * 利用に必要な初期状態を設定する。
     */
    constructor() {
        super("バックアップは100MiB以下にしてください。画像を減らしてからもう一度お試しください。");
        this.name = "BackupSizeLimitError";
    }
}
type BackupExportMetadata = {
    format: "math-worksheet";
    version: 1;
    exportedAt: string;
} & ({
    kind: "single";
    worksheet: Worksheet;
} | {
    kind: "archive";
    worksheets: readonly Worksheet[];
});
const bytesToBase64 = (/**
 * bytesToBase64に必要な処理を実行する。
 *
 * @param bytes bytesとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function bytesToBase64Implementation1(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
});
const base64ToBytes = (/**
 * base64ToBytesに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function base64ToBytesImplementation2(value: string): Uint8Array {
    const binary = atob(value);
    return Uint8Array.from(binary, (/**
     * fromへ渡す処理を実行する。
     *
     * @param character characterとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback3(character) {
        return character.charCodeAt(0);
    }));
});
/**
 * selectReferencedAssetsで必要な値を取得する。
 *
 * @param worksheets worksheetsとして使用する値
 * @param assets assetsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function selectReferencedAssets(worksheets: readonly Worksheet[], assets: readonly AssetRecord[]): AssetRecord[] {
    const worksheetIds = new Set(worksheets.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem4(worksheet) {
        return worksheet.id;
    })));
    const referencedAssetIds = collectReferencedAssetIds(worksheets);
    return assets.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param asset assetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem5(asset) {
        return (worksheetIds.has(asset.worksheetId) && referencedAssetIds.has(asset.id));
    }));
}
/**
 * toBackupAssetの入力値を必要な形式へ変換する。
 *
 * @param asset assetとして使用する値
 * @returns 非同期処理の結果
 */
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
/**
 * createSingleBackupで必要な値を作成する。
 *
 * @param worksheet worksheetとして使用する値
 * @param assets assetsとして使用する値
 * @returns 非同期処理の結果
 */
export async function createSingleBackup(worksheet: Worksheet, assets: AssetRecord[]): Promise<MathWorksheetFile> {
    const referencedAssets = selectReferencedAssets([worksheet], assets);
    const metadata = {
        format: "math-worksheet",
        kind: "single",
        version: 1,
        exportedAt: new Date().toISOString(),
        worksheet,
    } satisfies BackupExportMetadata;
    assertEstimatedBackupSize(metadata, referencedAssets);
    return MathWorksheetFileSchema.parse({
        ...metadata,
        assets: await toBackupAssets(referencedAssets),
    });
}
/**
 * createArchiveBackupで必要な値を作成する。
 *
 * @param worksheets worksheetsとして使用する値
 * @param assets assetsとして使用する値
 * @returns 非同期処理の結果
 */
export async function createArchiveBackup(worksheets: Worksheet[], assets: AssetRecord[]): Promise<MathWorksheetArchive> {
    const activeWorksheets = worksheets.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem6(worksheet) {
        return worksheet.deletedAt === null;
    }));
    const referencedAssets = selectReferencedAssets(activeWorksheets, assets);
    const metadata = {
        format: "math-worksheet",
        kind: "archive",
        version: 1,
        exportedAt: new Date().toISOString(),
        worksheets: activeWorksheets,
    } satisfies BackupExportMetadata;
    assertEstimatedBackupSize(metadata, referencedAssets);
    return MathWorksheetFileSchema.parse({
        ...metadata,
        assets: await toBackupAssets(referencedAssets),
    }) as MathWorksheetArchive;
}
/**
 * estimateBackupOutputBytesに必要な処理を実行する。
 *
 * @param metadata metadataとして使用する値
 * @param assets assetsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function estimateBackupOutputBytes(metadata: BackupExportMetadata, assets: readonly AssetRecord[]): number {
    const withoutImageData = JSON.stringify({
        ...metadata,
        assets: assets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem7(asset) {
            return ({
                id: asset.id,
                worksheetId: asset.worksheetId,
                mimeType: asset.mimeType,
                dataBase64: "",
                width: asset.width,
                height: asset.height,
                createdAt: asset.createdAt,
            });
        })),
    }, null, 2);
    return utf8ByteLength(withoutImageData)
        + assets.reduce((/**
         * 各要素を一つの集計結果へまとめる。
         *
         * @param total totalとして使用する値
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function reduceItems8(total, asset) {
            return total + base64EncodedLength(asset.blob.size);
        }), 0);
}
/**
 * parseBackupの入力値を必要な形式へ変換する。
 *
 * @param text textとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function parseBackup(text: string): MathWorksheetFile {
    return MathWorksheetFileSchema.parse(JSON.parse(text));
}
/**
 * assertBackupInputSizeに必要な処理を実行する。
 *
 * @param byteLength byteLengthとして使用する値
 */
export function assertBackupInputSize(byteLength: number): void {
    if (byteLength > MAX_BACKUP_FILE_BYTES)
        throw new BackupSizeLimitError();
}
/**
 * serializeBackupの入力値を必要な形式へ変換する。
 *
 * @param file fileとして使用する値
 * @param maximumBytes maximumBytesとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function serializeBackup(file: MathWorksheetFile, maximumBytes = MAX_BACKUP_FILE_BYTES): string {
    const serialized = JSON.stringify(file, null, 2);
    if (utf8ByteLengthExceeds(serialized, maximumBytes)) {
        throw new BackupSizeLimitError();
    }
    return serialized;
}
/**
 * hydrateBackupに必要な処理を実行する。
 *
 * @param file fileとして使用する値
 * @returns 非同期処理の結果
 */
export async function hydrateBackup(file: MathWorksheetFile): Promise<Array<{
    worksheet: Worksheet;
    assets: AssetRecord[];
}>> {
    const sourceAssetBlobs = new Map<string, Blob>();
    for (const [index, asset] of file.assets.entries()) {
        try {
            assertImageByteSize(base64DecodedByteLength(asset.dataBase64));
            const bytes = base64ToBytes(asset.dataBase64);
            const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
            const blob = new Blob([buffer], { type: asset.mimeType });
            await validateImageBlob(blob, { width: asset.width, height: asset.height });
            sourceAssetBlobs.set(asset.id, blob);
        }
        catch (reason) {
            const message = reason instanceof Error ? reason.message : "画像を読み込めませんでした。";
            throw new Error(`バックアップ内の画像${index + 1}を検証できませんでした。${message}`);
        }
    }
    const worksheets = file.kind === "single" ? [file.worksheet] : file.worksheets;
    return worksheets.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param sourceWorksheet sourceWorksheetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem9(sourceWorksheet) {
        const worksheet = structuredClone(sourceWorksheet);
        const worksheetId = createId();
        const remap = (/**
         * remapに必要な処理を実行する。
         *
         * @param value 処理対象の値
         */
        function remapImplementation10(value: unknown): void {
            if (Array.isArray(value))
                value.forEach(remap);
            else if (value && typeof value === "object") {
                const record = value as Record<string, unknown>;
                if (typeof record.id === "string") {
                    const next = record.id === sourceWorksheet.id ? worksheetId : createId();
                    record.id = next;
                }
                Object.values(record).forEach(remap);
            }
        });
        remap(worksheet);
        worksheet.updatedAt = new Date().toISOString();
        worksheet.createdAt = worksheet.updatedAt;
        const sourceAssets = file.assets.filter((/**
         * 対象要素を結果へ残すか判定する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function filterItem11(asset) {
            return asset.worksheetId === sourceWorksheet.id;
        }));
        const assetIds = new Map(sourceAssets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem12(asset) {
            return [asset.id, createId()];
        })));
        const replaceAssetIds = (/**
         * replaceAssetIdsの対象となる状態を更新する。
         *
         * @param value 処理対象の値
         */
        function replaceAssetIdsImplementation13(value: unknown): void {
            if (Array.isArray(value))
                value.forEach(replaceAssetIds);
            else if (value && typeof value === "object") {
                const record = value as Record<string, unknown>;
                if (typeof record.assetId === "string" && assetIds.has(record.assetId)) {
                    record.assetId = assetIds.get(record.assetId)!;
                }
                Object.values(record).forEach(replaceAssetIds);
            }
        });
        replaceAssetIds(worksheet);
        const assets = sourceAssets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem14(asset): AssetRecord {
            return {
                id: assetIds.get(asset.id)!,
                worksheetId,
                mimeType: asset.mimeType,
                blob: sourceAssetBlobs.get(asset.id)!,
                width: asset.width,
                height: asset.height,
                createdAt: worksheet.createdAt,
            };
        }));
        return { worksheet, assets };
    }));
}
/**
 * toBackupAssetsの入力値を必要な形式へ変換する。
 *
 * @param assets assetsとして使用する値
 * @returns 非同期処理の結果
 */
async function toBackupAssets(assets: readonly AssetRecord[]): Promise<BackupAsset[]> {
    const result: BackupAsset[] = [];
    for (const asset of assets)
        result.push(await toBackupAsset(asset));
    return result;
}
/**
 * base64DecodedByteLengthに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function base64DecodedByteLength(value: string): number {
    if (value.length === 0)
        return 0;
    const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
    return (value.length / 4) * 3 - padding;
}
/**
 * base64EncodedLengthに必要な処理を実行する。
 *
 * @param byteLength byteLengthとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function base64EncodedLength(byteLength: number): number {
    return Math.ceil(byteLength / 3) * 4;
}
/**
 * assertEstimatedBackupSizeに必要な処理を実行する。
 *
 * @param metadata metadataとして使用する値
 * @param assets assetsとして使用する値
 */
function assertEstimatedBackupSize(metadata: BackupExportMetadata, assets: readonly AssetRecord[]): void {
    if (estimateBackupOutputBytes(metadata, assets) > MAX_BACKUP_FILE_BYTES) {
        throw new BackupSizeLimitError();
    }
}
/**
 * utf8ByteLengthに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function utf8ByteLength(value: string): number {
    let bytes = 0;
    for (const character of value) {
        const codePoint = character.codePointAt(0)!;
        bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    }
    return bytes;
}
/**
 * utf8ByteLengthExceedsに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @param maximumBytes maximumBytesとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function utf8ByteLengthExceeds(value: string, maximumBytes: number): boolean {
    let bytes = 0;
    for (const character of value) {
        const codePoint = character.codePointAt(0)!;
        bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
        if (bytes > maximumBytes)
            return true;
    }
    return false;
}
