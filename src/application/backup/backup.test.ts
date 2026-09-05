import { describe, expect, it, vi } from "vitest";
import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
import { createId, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { assertBackupInputSize, BackupSizeLimitError, createArchiveBackup, createSingleBackup, estimateBackupOutputBytes, hydrateBackup, MAX_BACKUP_FILE_BYTES, serializeBackup, } from "./backup";
/**
 * createAssetで必要な値を作成する。
 *
 * @param worksheet worksheetとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * referenceAssetに必要な処理を実行する。
 *
 * @param worksheet worksheetとして使用する値
 * @param asset assetとして使用する値
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
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("個別バックアップから参照されていない余剰Assetを除外する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase2() {
        const worksheet = createWorksheet();
        const referencedAsset = createAsset(worksheet);
        const unusedAsset = createAsset(worksheet);
        referenceAsset(worksheet, referencedAsset);
        const backup = await createSingleBackup(worksheet, [unusedAsset, referencedAsset]);
        expect(backup.assets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem3(asset) {
            return asset.id;
        }))).toEqual([referencedAsset.id]);
    }));
    it("全体バックアップから余剰Assetとゴミ箱専用Assetを除外する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
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
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param worksheet worksheetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem5(worksheet) {
            return worksheet.id;
        }))).toEqual([activeWorksheet.id]);
        expect(backup.assets.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem6(asset) {
            return asset.id;
        }))).toEqual([referencedAsset.id]);
    }));
    it("exportとimportで同じ100MiB境界を使用する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase7() {
        const backup = await createSingleBackup(createWorksheet(), []);
        const serialized = serializeBackup(backup);
        const byteLength = new TextEncoder().encode(serialized).byteLength;
        expect(serializeBackup(backup, byteLength)).toBe(serialized);
        expect((/**
         * expectへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function expectCallback8() {
            return serializeBackup(backup, byteLength - 1);
        })).toThrow(BackupSizeLimitError);
        expect((/**
         * expectへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function expectCallback9() {
            return assertBackupInputSize(MAX_BACKUP_FILE_BYTES);
        })).not.toThrow();
        expect((/**
         * expectへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function expectCallback10() {
            return assertBackupInputSize(MAX_BACKUP_FILE_BYTES + 1);
        })).toThrow(BackupSizeLimitError);
    }));
    it("Base64化前の推定値が実際のUTF-8 JSONサイズと一致する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
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
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
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
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase13() {
        const worksheet = createWorksheet();
        const asset = createAsset(worksheet);
        referenceAsset(worksheet, asset);
        const backup = await createSingleBackup(worksheet, [asset]);
        await expect(hydrateBackup(backup)).rejects.toThrow("バックアップ内の画像1を検証できませんでした。画像のMIME型とファイル内容が一致しません。");
    }));
}));
