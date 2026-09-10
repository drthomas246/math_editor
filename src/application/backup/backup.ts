import { MathWorksheetFileSchema, type AssetRecord, type BackupAsset, type MathWorksheetArchive, type MathWorksheetFile, type Worksheet, } from "../../domain/worksheet/worksheet";
import { createId } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import { assertImageByteSize, validateImageBlob, } from "../assets/image-validation";
export const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;
export class BackupSizeLimitError extends Error {
    /**
     * このインスタンスの生成物または計測項目を識別する名前を「BackupSizeLimitError」へ更新する。
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
 * bytes・To・Baseをfrom・Char・コードで処理し、その結果を呼び出し元へ反映する。
 *
 * @param bytes 検証または変換するバイト列
 * @returns btoaの結果として得た文字列。変換できない場合は関数固有の既定値
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
 * base64・To・Bytesをatobで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value base64・To・Bytesで判定または変換する入力値
 * @returns fromの結果として得た要素一覧
 */
function base64ToBytesImplementation2(value: string): Uint8Array {
    const binary = atob(value);
    return Uint8Array.from(binary, (/**
     * 配列位置ごとにchar・結果理由・Atの結果を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param character 検査中の一文字
     * @returns char・コード・位置の結果
     */
    function fromCallback3(character) {
        return character.charCodeAt(0);
    }));
});
/**
 * Referenced・Assetsを入力データまたは現在の状態から取り出す。
 *
 * @param worksheets 処理対象となるプリント一覧
 * @param assets プリントに関連付ける画像アセット一覧
 * @returns 条件に合う要素だけを残した配列として得た要素一覧
 */
function selectReferencedAssets(worksheets: readonly Worksheet[], assets: readonly AssetRecord[]): AssetRecord[] {
    const worksheetIds = new Set(worksheets.map((/**
     * 各処理対象となるプリントを処理対象となるプリントの対象を一意に特定する識別子へ変換する。
     *
     * @param worksheet 処理対象となるプリント
     * @returns 処理対象となるプリントの対象を一意に特定する識別子
     */
    function mapItem4(worksheet) {
        return worksheet.id;
    })));
    const referencedAssetIds = collectReferencedAssetIds(worksheets);
    return assets.filter((/**
     * プリント・Idsに処理対象の画像アセットのプリント・Idが登録されているかつreferenced・アセット・Idsに処理対象の画像アセットの対象を一意に特定する識別子が登録されている要素だけを後続処理へ残す。
     *
     * @param asset 処理対象の画像アセット
     * @returns プリント・Idsに処理対象の画像アセットのプリント・Idが登録されているかつreferenced・アセット・Idsに処理対象の画像アセットの対象を一意に特定する識別子が登録されている場合はtrue
     */
    function filterItem5(asset) {
        return (worksheetIds.has(asset.worksheetId) && referencedAssetIds.has(asset.id));
    }));
}
/**
 * 識別子・プリント・識別子・画像ファイルのMIME形式・データ・Base64・要素または列へ適用する幅を持つオブジェクトを一つの結果へまとめる。
 *
 * @param asset 処理対象の画像アセット
 * @returns 識別子・プリント・識別子・画像ファイルのMIME形式・データ・Base64・要素または列へ適用する幅を持つオブジェクトを一つの結果へまとめる処理の完了時に解決するPromise
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
 * Single・Backupを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param worksheet 処理対象となるプリント
 * @param assets プリントに関連付ける画像アセット一覧
 * @returns Single・Backupを識別子・初期値・関連データが揃った新しい値として組み立てる処理の完了時に解決するPromise
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
 * Archive・Backupを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param worksheets 処理対象となるプリント一覧
 * @param assets プリントに関連付ける画像アセット一覧
 * @returns Archive・Backupを識別子・初期値・関連データが揃った新しい値として組み立てる処理の完了時に解決するPromise
 */
export async function createArchiveBackup(worksheets: Worksheet[], assets: AssetRecord[]): Promise<MathWorksheetArchive> {
    const activeWorksheets = worksheets.filter((/**
     * 処理対象となるプリントのごみ箱へ移した日時がnullと一致する要素だけを後続処理へ残す。
     *
     * @param worksheet 処理対象となるプリント
     * @returns 処理対象となるプリントのごみ箱へ移した日時がnullと一致する場合はtrue
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
 * estimate・Backup・Output・Bytesをstringifyで処理し、その結果を呼び出し元へ反映する。
 *
 * @param metadata 復元または検証に使う付随情報
 * @param assets プリントに関連付ける画像アセット一覧
  * @returns utf8・Byte・Lengthの結果とreduceの結果を加算した値から算出した数値
 */
export function estimateBackupOutputBytes(metadata: BackupExportMetadata, assets: readonly AssetRecord[]): number {
    const withoutImageData = JSON.stringify({
        ...metadata,
        assets: assets.map((/**
         * 各処理対象の画像アセットを対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・データ・Base64・要素または列へ適用する幅を持つオブジェクトへ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・データ・Base64・要素または列へ適用する幅を持つオブジェクト
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
         * 現在の計算途中の累積値を、それまでの集計結果へ重複なく反映する。
         *
         * @param total 計算途中の累積値
         * @param asset 処理対象の画像アセット
         * @returns 計算途中の累積値を反映した次の累積結果
         */
        function reduceItems8(total, asset) {
            return total + base64EncodedLength(asset.blob.size);
        }), 0);
}
/**
 * Backupを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param text 文書または画面へ設定する文字列
 * @returns スキーマ検証済みのデータ
 */
export function parseBackup(text: string): MathWorksheetFile {
    return MathWorksheetFileSchema.parse(JSON.parse(text));
}
/**
 * assert・Backup・Input・寸法が永続化・表示・テストの制約を満たすか検証する。
 *
 * @param byteLength 許容するバイト数
 */
export function assertBackupInputSize(byteLength: number): void {
    if (byteLength > MAX_BACKUP_FILE_BYTES)
        throw new BackupSizeLimitError();
}
/**
 * Backupを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param file 読み込みまたは検証の対象ファイル
 * @param maximumBytes バックアップへ許容する最大バイト数
 * @returns serializedとして得た文字列。変換できない場合は関数固有の既定値
 */
export function serializeBackup(file: MathWorksheetFile, maximumBytes = MAX_BACKUP_FILE_BYTES): string {
    const serialized = JSON.stringify(file, null, 2);
    if (utf8ByteLengthExceeds(serialized, maximumBytes)) {
        throw new BackupSizeLimitError();
    }
    return serialized;
}
/**
 * hydrate・Backupをentriesで処理し、その結果を呼び出し元へ反映する。
 *
 * @param file 読み込みまたは検証の対象ファイル
 * @returns hydrate・Backupをentriesで処理し、その結果を呼び出し元へ反映する処理の完了時に解決するPromise
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
     * 各バックアップから復元した元プリントを処理対象となるプリント・プリントに関連付ける画像アセット一覧を持つオブジェクトへ変換する。
     *
     * @param sourceWorksheet バックアップから復元した元プリント
     * @returns 処理対象となるプリント・プリントに関連付ける画像アセット一覧を持つオブジェクト
     */
    function mapItem9(sourceWorksheet) {
        const worksheet = structuredClone(sourceWorksheet);
        const worksheetId = createId();
        const remap = (/**
         * remapをis・Arrayで処理し、その結果を呼び出し元へ反映する。
         *
         * @param value remapで判定または変換する入力値
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
         * 処理対象の画像アセットのプリント・Idがバックアップから復元した元プリントの対象を一意に特定する識別子と一致する要素だけを後続処理へ残す。
         *
         * @param asset 処理対象の画像アセット
         * @returns 処理対象の画像アセットのプリント・Idがバックアップから復元した元プリントの対象を一意に特定する識別子と一致する場合はtrue
         */
        function filterItem11(asset) {
            return asset.worksheetId === sourceWorksheet.id;
        }));
        const assetIds = new Map(sourceAssets.map((/**
         * 各処理対象の画像アセットを順序を保った要素一覧へ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 順序を保った要素一覧
         */
        function mapItem12(asset) {
            return [asset.id, createId()];
        })));
        const replaceAssetIds = (/**
         * replace・アセット・Idsをis・Arrayで処理し、その結果を呼び出し元へ反映する。
         *
         * @param value replace・アセット・Idsで判定または変換する入力値
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
         * 各処理対象の画像アセットを対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・検証または保存するバイナリデータ・要素または列へ適用する幅を持つオブジェクトへ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・検証または保存するバイナリデータ・要素または列へ適用する幅を持つオブジェクト
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
 * to・Backup・Assetsを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param assets プリントに関連付ける画像アセット一覧
 * @returns to・Backup・Assetsを比較・保存・表示先が要求する形式へ変換する処理の完了時に解決するPromise
 */
async function toBackupAssets(assets: readonly AssetRecord[]): Promise<BackupAsset[]> {
    const result: BackupAsset[] = [];
    for (const asset of assets)
        result.push(await toBackupAsset(asset));
    return result;
}
/**
 * base64・Decoded・Byte・Lengthをends・Withで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value base64・Decoded・Byte・Lengthで判定または変換する入力値
 * @returns 0から算出した数値
 */
function base64DecodedByteLength(value: string): number {
    if (value.length === 0)
        return 0;
    const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
    return (value.length / 4) * 3 - padding;
}
/**
 * base64・Encoded・Lengthをceilで処理し、その結果を呼び出し元へ反映する。
 *
 * @param byteLength 許容するバイト数
 * base64・Encoded・Lengthをceilで処理し、その結果を呼び出し元へ反映する。
  * @returns ceilの結果と4を乗算した値から算出した数値
 */
function base64EncodedLength(byteLength: number): number {
    return Math.ceil(byteLength / 3) * 4;
}
/**
 * assert・Estimated・Backup・寸法が永続化・表示・テストの制約を満たすか検証する。
 *
 * @param metadata 復元または検証に使う付随情報
 * @param assets プリントに関連付ける画像アセット一覧
 */
function assertEstimatedBackupSize(metadata: BackupExportMetadata, assets: readonly AssetRecord[]): void {
    if (estimateBackupOutputBytes(metadata, assets) > MAX_BACKUP_FILE_BYTES) {
        throw new BackupSizeLimitError();
    }
}
/**
 * utf8・Byte・Lengthをコード・Point・Atで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value utf8・Byte・Lengthで判定または変換する入力値
 * @returns 検証または変換するバイト列から算出した数値
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
 * utf8・Byte・Length・Exceedsをコード・Point・Atで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value utf8・Byte・Length・Exceedsで判定または変換する入力値
 * @param maximumBytes バックアップへ許容する最大バイト数
 * @returns この実装では常にtrue
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
