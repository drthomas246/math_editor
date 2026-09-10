import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSingleBackup } from "../../application/backup/backup";
import type { AssetRecord } from "../../domain/worksheet/worksheet";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { database } from "../../infrastructure/indexeddb/database";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { WorksheetListScreen } from "./WorksheetListScreen";
beforeEach((/**
 * 各テストが互いに影響しない初期状態とモックを準備する。
 *
 * @returns 各テストが互いに影響しない初期状態とモックを準備する処理の完了時に解決するPromise
 */
async function prepareTestCase1() {
    await database.worksheets.clear();
    await database.assets.clear();
}));
afterEach((/**
 * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
 *
 */
function cleanUpTestCase2() {
    return vi.restoreAllMocks();
}));
describe("WorksheetListScreen", (/**
 * 「WorksheetListScreen」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite3() {
    it("個別JSONを利用者が直接保存できるリンクとして準備する", (/**
     * 「個別JSONを利用者が直接保存できるリンクとして準備する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase4() {
        const worksheet = createWorksheet();
        worksheet.title = "JSON出力テスト";
        worksheet.header.title = worksheet.title;
        await worksheetRepository.create({ worksheet, assets: [] });
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "JSON出力テストのメニュー" }));
        await userEvent.click(screen.getByRole("button", { name: "JSONエクスポート" }));
        const download = await screen.findByRole("link", { name: "JSONをダウンロード" });
        expect(download).toHaveAttribute("href", "blob:test");
        expect(download).toHaveAttribute("download", expect.stringMatching(/^JSON出力テスト_\d{8}-\d{4}\.json$/u));
    }));
    it("全体バックアップを利用者が直接保存できるリンクとして準備する", (/**
     * 「全体バックアップを利用者が直接保存できるリンクとして準備する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase5() {
        await worksheetRepository.create({ worksheet: createWorksheet(), assets: [] });
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "設定・バックアップ" }));
        await userEvent.click(screen.getByRole("button", { name: "全体をエクスポート" }));
        const download = await screen.findByRole("link", { name: "JSONをダウンロード" });
        expect(download).toHaveAttribute("href", "blob:test");
        expect(download).toHaveAttribute("download", expect.stringMatching(/^math-worksheet-backup-\d{8}-\d{4}\.json$/u));
    }));
    it("全体バックアップ中は操作を無効化して多重実行を防ぐ", (/**
     * 「全体バックアップ中は操作を無効化して多重実行を防ぐ」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase6() {
        await worksheetRepository.create({ worksheet: createWorksheet(), assets: [] });
        let release: (() => void) | undefined;
        const assets = vi.spyOn(database.assets, "bulkGet").mockImplementation((/**
         * 「全体バックアップ中は操作を無効化して多重実行を防ぐ」で外部依存から返すPromiseの新しいインスタンスを固定し、検証を決定的にする。
         *
         * @returns Promiseの新しいインスタンス
         */
        function mockImplementationCallback7() {
            return new Promise((/**
             * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
             *
             * @param resolve 非同期処理を正常完了させるPromise関数
             */
            function settlePromise8(resolve) {
                release = (/**
                 * 外部イベントの結果を待機中のPromiseへ通知する。
                 *
                 */
                function applyDeferredOperation9() {
                    return resolve([]);
                });
            })) as ReturnType<typeof database.assets.bulkGet>;
        }));
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "設定・バックアップ" }));
        const exportButton = screen.getByRole("button", { name: "全体をエクスポート" });
        fireEvent.click(exportButton);
        expect(await screen.findByRole("button", { name: "書き出し中…" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "書き出し中…" }));
        expect(assets).toHaveBeenCalledOnce();
        release?.();
        expect(await screen.findByRole("link", { name: "JSONをダウンロード" })).toBeInTheDocument();
    }));
    it("全体バックアップの失敗をダイアログ内に表示して再実行できる", (/**
     * 「全体バックアップの失敗をダイアログ内に表示して再実行できる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase10() {
        await worksheetRepository.create({ worksheet: createWorksheet(), assets: [] });
        vi.spyOn(database.assets, "bulkGet").mockRejectedValueOnce(new Error("IndexedDB failure"));
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "設定・バックアップ" }));
        await userEvent.click(screen.getByRole("button", { name: "全体をエクスポート" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("IndexedDB failure");
        expect(screen.getByRole("button", { name: "全体をエクスポート" })).toBeEnabled();
    }));
    it("全体バックアップは参照されるAssetだけをIndexedDBから取得する", (/**
     * 「全体バックアップは参照されるAssetだけをIndexedDBから取得する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase11() {
        const worksheet = createWorksheet();
        const referencedAsset: AssetRecord = {
            id: crypto.randomUUID(),
            worksheetId: worksheet.id,
            mimeType: "image/png",
            blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
            width: 1,
            height: 1,
            createdAt: worksheet.createdAt,
        };
        const unusedAsset = { ...referencedAsset, id: crypto.randomUUID() };
        worksheet.problems[0]!.contents.push({ id: crypto.randomUUID(), type: "image", assetId: referencedAsset.id, alt: "", placement: "block", widthPercent: 50 });
        await worksheetRepository.create({ worksheet, assets: [referencedAsset, unusedAsset] });
        const bulkGet = vi.spyOn(database.assets, "bulkGet").mockResolvedValue([referencedAsset]);
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "設定・バックアップ" }));
        await userEvent.click(screen.getByRole("button", { name: "全体をエクスポート" }));
        expect(await screen.findByRole("link", { name: "JSONをダウンロード" })).toBeInTheDocument();
        expect(bulkGet).toHaveBeenCalledWith([referencedAsset.id]);
    }));
    it("ゴミ箱移動の失敗を捕捉し、ダイアログから再実行できる", (/**
     * 「ゴミ箱移動の失敗を捕捉し、ダイアログから再実行できる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase12() {
        const worksheet = createWorksheet();
        worksheet.title = "削除失敗テスト";
        worksheet.header.title = worksheet.title;
        await worksheetRepository.create({ worksheet, assets: [] });
        const trash = vi.spyOn(worksheetRepository, "trash").mockRejectedValueOnce(new Error("IndexedDB failure"));
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "削除失敗テストのメニュー" }));
        await userEvent.click(screen.getByRole("button", { name: "ゴミ箱へ移動" }));
        await userEvent.click(screen.getByRole("button", { name: "移動する" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("IndexedDB failure");
        expect(screen.getByRole("button", { name: "移動する" })).toBeEnabled();
        expect(trash).toHaveBeenCalledOnce();
    }));
    it("ゴミ箱移動の取り消し失敗を捕捉して再実行できる", (/**
     * 「ゴミ箱移動の取り消し失敗を捕捉して再実行できる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase13() {
        const worksheet = createWorksheet();
        worksheet.title = "復元失敗テスト";
        worksheet.header.title = worksheet.title;
        await worksheetRepository.create({ worksheet, assets: [] });
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "復元失敗テストのメニュー" }));
        await userEvent.click(screen.getByRole("button", { name: "ゴミ箱へ移動" }));
        await userEvent.click(screen.getByRole("button", { name: "移動する" }));
        const restore = vi.spyOn(worksheetRepository, "restore").mockRejectedValueOnce(new Error("restore failure"));
        await userEvent.click(await screen.findByRole("button", { name: "元に戻す" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("restore failure");
        expect(screen.getByRole("button", { name: "元に戻す" })).toBeEnabled();
        expect(restore).toHaveBeenCalledOnce();
    }));
    it("インポート中は操作を無効化してcreateManyの多重実行を防ぐ", (/**
     * 「インポート中は操作を無効化してcreateManyの多重実行を防ぐ」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase14() {
        const backup = await createSingleBackup(createWorksheet(), []);
        let release: (() => void) | undefined;
        const createMany = vi.spyOn(worksheetRepository, "createMany").mockImplementation((/**
         * 「インポート中は操作を無効化してcreateManyの多重実行を防ぐ」で外部依存から返すPromiseの新しいインスタンスを固定し、検証を決定的にする。
         *
         * @returns Promiseの新しいインスタンス
         */
        function mockImplementationCallback15() {
            return new Promise((/**
             * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
             *
             * @param resolve 非同期処理を正常完了させるPromise関数
             */
            function settlePromise16(resolve) {
                release = resolve;
            }));
        }));
        const view = render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await screen.findByText("まだプリントがありません");
        await userEvent.click(screen.getAllByRole("button", { name: "インポート" })[0]!);
        const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
        await userEvent.upload(input, new File([JSON.stringify(backup)], "backup.json", { type: "application/json" }));
        fireEvent.click(screen.getByRole("button", { name: "インポート実行" }));
        expect(await screen.findByRole("button", { name: "インポート中…" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "インポート中…" }));
        expect(createMany).toHaveBeenCalledOnce();
        release?.();
        expect(await screen.findByText("1件をインポートしました")).toBeInTheDocument();
    }));
    it("インポート画像のMIME偽装をcreateMany前に拒否する", (/**
     * 「インポート画像のMIME偽装をcreateMany前に拒否する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase17() {
        const worksheet = createWorksheet();
        const asset: AssetRecord = {
            id: crypto.randomUUID(),
            worksheetId: worksheet.id,
            mimeType: "image/png",
            blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/png" }),
            width: 1,
            height: 1,
            createdAt: worksheet.createdAt,
        };
        worksheet.problems[0]!.contents.push({ id: crypto.randomUUID(), type: "image", assetId: asset.id, alt: "", placement: "block", widthPercent: 50 });
        const backup = await createSingleBackup(worksheet, [asset]);
        const createMany = vi.spyOn(worksheetRepository, "createMany");
        const view = render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await screen.findByText("まだプリントがありません");
        await userEvent.click(screen.getAllByRole("button", { name: "インポート" })[0]!);
        const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
        await userEvent.upload(input, new File([JSON.stringify(backup)], "invalid-image.json", { type: "application/json" }));
        await userEvent.click(screen.getByRole("button", { name: "インポート実行" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("画像のMIME型とファイル内容が一致しません");
        expect(createMany).not.toHaveBeenCalled();
    }));
    it("プリントの操作メニューを外側の操作で閉じる", (/**
     * 「プリントの操作メニューを外側の操作で閉じる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase18() {
        const worksheet = createWorksheet();
        worksheet.title = "外側クリックテスト";
        worksheet.header.title = worksheet.title;
        await worksheetRepository.create({ worksheet, assets: [] });
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        await userEvent.click(await screen.findByRole("button", { name: "外側クリックテストのメニュー" }));
        expect(screen.getByRole("button", { name: "JSONエクスポート" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("heading", { name: "プリント" }));
        expect(screen.queryByRole("button", { name: "JSONエクスポート" })).not.toBeInTheDocument();
    }));
    it("空状態と主要操作を表示する", (/**
     * 「空状態と主要操作を表示する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase19() {
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        expect(await screen.findByText("まだプリントがありません")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /使い方/u })).toHaveAttribute("href", "/help/overview");
        expect(screen.getByRole("link", { name: /使い方/u })).toHaveAttribute("target", "_blank");
        expect(screen.getAllByRole("button", { name: /新しいプリント/u }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: /インポート/u }).length).toBeGreaterThan(0);
    }));
    it("正規化した題名検索で一覧を絞り込む", (/**
     * 「正規化した題名検索で一覧を絞り込む」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase20() {
        const worksheet = createWorksheet();
        worksheet.title = "１年Ａ組";
        worksheet.header.title = worksheet.title;
        await worksheetRepository.create({ worksheet, assets: [] });
        render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
        expect(await screen.findByRole("button", { name: "１年Ａ組" })).toBeInTheDocument();
        await userEvent.type(screen.getByRole("textbox", { name: "題名で検索" }), "1年a組");
        await waitFor((/**
         * 「正規化した題名検索で一覧を絞り込む」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback21() {
            return expect(screen.getByRole("button", { name: "１年Ａ組" })).toBeInTheDocument();
        }));
        await userEvent.clear(screen.getByRole("textbox", { name: "題名で検索" }));
        await userEvent.type(screen.getByRole("textbox", { name: "題名で検索" }), "ぷりんと");
        expect(await screen.findByText(/一致するプリントはありません/u)).toBeInTheDocument();
    }));
}));
