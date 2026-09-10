import { describe, expect, it, vi } from "vitest";
import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
import { createId, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { assertBackupInputSize, BackupSizeLimitError, createArchiveBackup, createSingleBackup, estimateBackupOutputBytes, hydrateBackup, MAX_BACKUP_FILE_BYTES, serializeBackup, } from "./backup";
/**
 * アセットを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param worksheet 処理対象となるプリント
 * @returns 対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・検証または保存するバイナリデータ・要素または列へ適用する幅を持つオブジェクト
 */
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
/**
 * reference・アセットをpushで処理し、その結果を呼び出し元へ反映する。
 *
 * @param worksheet 処理対象となるプリント
 * @param asset 処理対象の画像アセット
 */
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
describe("backup export", (/**
 * 「backup export」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    it("個別バックアップから参照されていない余剰Assetを除外する", (/**
     * 「個別バックアップから参照されていない余剰Assetを除外する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase2() {
        const worksheet = createWorksheet();
        const referencedAsset = createAsset(worksheet);
        const unusedAsset = createAsset(worksheet);
        referenceAsset(worksheet, referencedAsset);
        const backup = await createSingleBackup(worksheet, [unusedAsset, referencedAsset]);
        expect(backup.assets.map((/**
         * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 処理対象の画像アセットの対象を一意に特定する識別子
         */
        function mapItem3(asset) {
            return asset.id;
        }))).toEqual([referencedAsset.id]);
    }));
    it("全体バックアップから余剰Assetとゴミ箱専用Assetを除外する", (/**
     * 「全体バックアップから余剰Assetとゴミ箱専用Assetを除外する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase4() {
        const activeWorksheet = createWorksheet();
        const referencedAsset = createAsset(activeWorksheet);
        const unusedAsset = createAsset(activeWorksheet);
        referenceAsset(activeWorksheet, referencedAsset);
        const trashedWorksheet = createWorksheet();
        trashedWorksheet.deletedAt = new Date().toISOString();
        const trashedAsset = createAsset(trashedWorksheet);
        referenceAsset(trashedWorksheet, trashedAsset);
        const backup = await createArchiveBackup([activeWorksheet, trashedWorksheet], [unusedAsset, trashedAsset, referencedAsset]);
        expect(backup.worksheets.map((/**
         * 各処理対象となるプリントを処理対象となるプリントの対象を一意に特定する識別子へ変換する。
         *
         * @param worksheet 処理対象となるプリント
         * @returns 処理対象となるプリントの対象を一意に特定する識別子
         */
        function mapItem5(worksheet) {
            return worksheet.id;
        }))).toEqual([activeWorksheet.id]);
        expect(backup.assets.map((/**
         * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 処理対象の画像アセットの対象を一意に特定する識別子
         */
        function mapItem6(asset) {
            return asset.id;
        }))).toEqual([referencedAsset.id]);
    }));
    it("exportとimportで同じ100MiB境界を使用する", (/**
     * 「exportとimportで同じ100MiB境界を使用する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase7() {
        const backup = await createSingleBackup(createWorksheet(), []);
        const serialized = serializeBackup(backup);
        const byteLength = new TextEncoder().encode(serialized).byteLength;
        expect(serializeBackup(backup, byteLength)).toBe(serialized);
        expect((/**
         * expectをserialize・Backupで処理し、その結果を呼び出し元へ反映する。
         *
         * @returns serialize・Backupの結果
         */
        function expectCallback8() {
            return serializeBackup(backup, byteLength - 1);
        })).toThrow(BackupSizeLimitError);
        expect((/**
         * expectをassert・Backup・Input・寸法で処理し、その結果を呼び出し元へ反映する。
         *
         * @returns assert・Backup・Input・寸法の結果
         */
        function expectCallback9() {
            return assertBackupInputSize(MAX_BACKUP_FILE_BYTES);
        })).not.toThrow();
        expect((/**
         * expectをassert・Backup・Input・寸法で処理し、その結果を呼び出し元へ反映する。
         *
         * @returns assert・Backup・Input・寸法の結果
         */
        function expectCallback10() {
            return assertBackupInputSize(MAX_BACKUP_FILE_BYTES + 1);
        })).toThrow(BackupSizeLimitError);
    }));
    it("Base64化前の推定値が実際のUTF-8 JSONサイズと一致する", (/**
     * 「Base64化前の推定値が実際のUTF-8 JSONサイズと一致する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase11() {
        const worksheet = createWorksheet();
        worksheet.title = "日本語サイズ推定";
        worksheet.header.title = worksheet.title;
        const asset = createAsset(worksheet);
        referenceAsset(worksheet, asset);
        const backup = await createSingleBackup(worksheet, [asset]);
        if (backup.kind !== "single")
            throw new Error("単一バックアップを作成できませんでした");
        const { assets: _assets, ...metadata } = backup;
        expect(estimateBackupOutputBytes(metadata, [asset])).toBe(new TextEncoder().encode(serializeBackup(backup)).byteLength);
    }));
    it("推定サイズが100MiBを超える単体・全体exportはBlobをBase64化する前に拒否する", (/**
     * 「推定サイズが100MiBを超える単体・全体exportはBlobをBase64化する前に拒否する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase12() {
        const worksheet = createWorksheet();
        const asset = createAsset(worksheet);
        referenceAsset(worksheet, asset);
        Object.defineProperty(asset.blob, "size", { configurable: true, value: MAX_BACKUP_FILE_BYTES });
        const arrayBuffer = vi.spyOn(asset.blob, "arrayBuffer");
        await expect(createSingleBackup(worksheet, [asset])).rejects.toThrow(BackupSizeLimitError);
        await expect(createArchiveBackup([worksheet], [asset])).rejects.toThrow(BackupSizeLimitError);
        expect(arrayBuffer).not.toHaveBeenCalled();
    }));
    it("画像の実体が宣言MIMEと異なるバックアップを保存前に拒否する", (/**
     * 「画像の実体が宣言MIMEと異なるバックアップを保存前に拒否する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase13() {
        const worksheet = createWorksheet();
        const asset = createAsset(worksheet);
        referenceAsset(worksheet, asset);
        const backup = await createSingleBackup(worksheet, [asset]);
        await expect(hydrateBackup(backup)).rejects.toThrow("バックアップ内の画像1を検証できませんでした。画像のMIME型とファイル内容が一致しません。");
    }));
}));
