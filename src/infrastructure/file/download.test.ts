import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareJsonDownload } from "./download";
describe("prepareJsonDownload", (/**
 * 「prepareJsonDownload」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    afterEach((/**
     * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
     */
    function cleanUpTestCase2() {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.replaceChildren();
    }));
    it("利用者が直接クリックできるJSONのダウンロード情報を生成する", (/**
     * 「利用者が直接クリックできるJSONのダウンロード情報を生成する」という仕様を操作結果から検証する。
     */
    function runTestCase3() {
        const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:worksheet-backup");
        const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
        const download = prepareJsonDownload({ format: "math-worksheet", version: 1 }, "worksheet.json");
        expect(createObjectUrl).toHaveBeenCalledOnce();
        expect(download).toMatchObject({
            fileName: "worksheet.json",
            url: "blob:worksheet-backup",
        });
        expect(revokeObjectUrl).not.toHaveBeenCalled();
        download.revoke();
        download.revoke();
        expect(revokeObjectUrl).toHaveBeenCalledWith("blob:worksheet-backup");
        expect(revokeObjectUrl).toHaveBeenCalledOnce();
    }));
}));
