import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSingleBackup, hydrateBackup, parseBackup } from "../../application/backup/backup";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import type { AssetRecord } from "../../domain/worksheet/worksheet";
import { MathWorksheetDatabase } from "./database";
import { DexieWorksheetRepository, WorksheetLimitError } from "./dexie-worksheet-repository";
let db: MathWorksheetDatabase;
let repository: DexieWorksheetRepository;
beforeEach((/**
 * 各テストが互いに影響しない初期状態とモックを準備する。
 */
function prepareTestCase1() {
    db = new MathWorksheetDatabase(`test-${crypto.randomUUID()}`);
    repository = new DexieWorksheetRepository(db);
}));
afterEach((/**
 * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
 *
 * @returns 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する処理の完了時に解決するPromise
 */
async function cleanUpTestCase2() {
    vi.unstubAllGlobals();
    await db.delete();
}));
describe("DexieWorksheetRepository", (/**
 * 「DexieWorksheetRepository」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite3() {
    it("プリント数の上限エラーに画面表示用のメッセージを持たせる", (/**
     * 「プリント数の上限エラーに画面表示用のメッセージを持たせる」という仕様を操作結果から検証する。
     */
    function runTestCase4() {
        const error = new WorksheetLimitError();
        expect(error.message).toBe("プリント数の上限に達しています");
        expect(error.code).toBe("WORKSHEET_LIMIT_EXCEEDED");
    }));
    it("作成・保存・ゴミ箱・復元・完全削除を往復する", (/**
     * 「作成・保存・ゴミ箱・復元・完全削除を往復する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase5() {
        const worksheet = createWorksheet();
        await repository.create({ worksheet, assets: [] });
        expect((await repository.list()).worksheets).toHaveLength(1);
        const trashed = await repository.trash(worksheet.id);
        expect(trashed.deletedAt).not.toBeNull();
        const restored = await repository.restore(worksheet.id);
        expect(restored.deletedAt).toBeNull();
        await repository.deletePermanently(worksheet.id);
        expect(await repository.get(worksheet.id)).toBeNull();
    }));
    it("完全削除で関連Assetも削除する", (/**
     * 「完全削除で関連Assetも削除する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase6() {
        const worksheet = createWorksheet();
        const asset: AssetRecord = { id: crypto.randomUUID(), worksheetId: worksheet.id, mimeType: "image/png", blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), width: 1, height: 1, createdAt: new Date().toISOString() };
        await repository.create({ worksheet, assets: [asset] });
        await repository.deletePermanently(worksheet.id);
        expect(await db.assets.count()).toBe(0);
    }));
    it("保存時に現在参照中またはUndo/Redoで保持中のAsset以外を削除する", (/**
     * 「保存時に現在参照中またはUndo/Redoで保持中のAsset以外を削除する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase7() {
        const worksheet = createWorksheet();
        const referencedAsset: AssetRecord = { id: crypto.randomUUID(), worksheetId: worksheet.id, mimeType: "image/png", blob: new Blob([new Uint8Array([1])], { type: "image/png" }), width: 1, height: 1, createdAt: new Date().toISOString() };
        const historyAsset: AssetRecord = { ...referencedAsset, id: crypto.randomUUID(), blob: new Blob([new Uint8Array([2])], { type: "image/png" }) };
        const unreferencedAsset: AssetRecord = { ...referencedAsset, id: crypto.randomUUID(), blob: new Blob([new Uint8Array([3])], { type: "image/png" }) };
        worksheet.problems[0]!.contents.push({ id: crypto.randomUUID(), type: "image", assetId: referencedAsset.id, alt: "", placement: "block", widthPercent: 50 });
        await repository.create({ worksheet, assets: [referencedAsset, historyAsset, unreferencedAsset] });
        await repository.save(worksheet, {
            pruneUnreferencedAssets: true,
            retainedAssetIds: new Set([historyAsset.id]),
        });
        expect(new Set((await db.assets.toArray()).map((/**
         * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 処理対象の画像アセットの対象を一意に特定する識別子
         */
        function mapItem8(asset) {
            return asset.id;
        })))).toEqual(new Set([
            referencedAsset.id,
            historyAsset.id,
        ]));
        await repository.save(worksheet, {
            pruneUnreferencedAssets: true,
            retainedAssetIds: new Set(),
        });
        expect((await db.assets.toArray()).map((/**
         * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 処理対象の画像アセットの対象を一意に特定する識別子
         */
        function mapItem9(asset) {
            return asset.id;
        }))).toEqual([referencedAsset.id]);
    }));
    it("単一JSONを別IDとして復元し画像バイト列を維持する", (/**
     * 「単一JSONを別IDとして復元し画像バイト列を維持する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase10() {
        const worksheet = createWorksheet();
        const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const asset: AssetRecord = { id: crypto.randomUUID(), worksheetId: worksheet.id, mimeType: "image/png", blob: new Blob([bytes], { type: "image/png" }), width: 2, height: 3, createdAt: new Date().toISOString() };
        worksheet.problems[0]!.contents.push({ id: crypto.randomUUID(), type: "image", assetId: asset.id, alt: "", placement: "block", widthPercent: 50 });
        const backup = await createSingleBackup(worksheet, [asset]);
        const parsed = parseBackup(JSON.stringify(backup));
        vi.stubGlobal("createImageBitmap", vi.fn((/**
         * 「単一JSONを別IDとして復元し画像バイト列を維持する」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする。
         *
         * @returns 「単一JSONを別IDとして復元し画像バイト列を維持する」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function fnCallback11() {
            return ({ width: 2, height: 3, close: vi.fn() });
        })));
        const [hydrated] = await hydrateBackup(parsed);
        expect(hydrated!.worksheet.id).not.toBe(worksheet.id);
        expect([...new Uint8Array(await hydrated!.assets[0]!.blob.arrayBuffer())]).toEqual([...bytes]);
    }));
}));
