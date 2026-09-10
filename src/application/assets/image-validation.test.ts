import { afterEach, describe, expect, it, vi } from "vitest";
import { assertImageByteSize, IMAGE_VALIDATION_LIMITS, validateImageBlob } from "./image-validation";
afterEach((/**
 * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
 *
 */
function cleanUpTestCase1() {
    return vi.unstubAllGlobals();
}));
describe("validateImageBlob", (/**
 * 「validateImageBlob」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite2() {
    it("MIME、シグネチャ、デコード結果、記録寸法が一致する画像を受け入れる", (/**
     * 「MIME、シグネチャ、デコード結果、記録寸法が一致する画像を受け入れる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase3() {
        const close = vi.fn();
        vi.stubGlobal("createImageBitmap", vi.fn((/**
         * 「MIME、シグネチャ、デコード結果、記録寸法が一致する画像を受け入れる」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする。
         *
         * @returns 「MIME、シグネチャ、デコード結果、記録寸法が一致する画像を受け入れる」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function fnCallback4() {
            return ({ width: 320, height: 240, close });
        })));
        const blob = new Blob([
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ], { type: "image/png" });
        await expect(validateImageBlob(blob, { width: 320, height: 240 })).resolves.toEqual({ width: 320, height: 240 });
        expect(close).toHaveBeenCalledOnce();
    }));
    it("宣言MIMEとファイルシグネチャが違う画像をデコード前に拒否する", (/**
     * 「宣言MIMEとファイルシグネチャが違う画像をデコード前に拒否する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase5() {
        const decode = vi.fn();
        vi.stubGlobal("createImageBitmap", decode);
        const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
        await expect(validateImageBlob(new Blob([jpegBytes], { type: "image/png" })))
            .rejects.toThrow("画像のMIME型とファイル内容が一致しません。");
        expect(decode).not.toHaveBeenCalled();
    }));
    it("バックアップの記録寸法と実寸が違う画像を拒否してbitmapを解放する", (/**
     * 「バックアップの記録寸法と実寸が違う画像を拒否してbitmapを解放する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase6() {
        const close = vi.fn();
        vi.stubGlobal("createImageBitmap", vi.fn((/**
         * 「バックアップの記録寸法と実寸が違う画像を拒否してbitmapを解放する」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする。
         *
         * @returns 「バックアップの記録寸法と実寸が違う画像を拒否してbitmapを解放する」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function fnCallback7() {
            return ({ width: 320, height: 240, close });
        })));
        const blob = new Blob([
            new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
        ], { type: "image/webp" });
        await expect(validateImageBlob(blob, { width: 1, height: 1 }))
            .rejects.toThrow("画像に記録された寸法と実際の寸法が一致しません。");
        expect(close).toHaveBeenCalledOnce();
    }));
    it("画像1点の容量と画素数の上限を適用する", (/**
     * 「画像1点の容量と画素数の上限を適用する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase8() {
        expect((/**
         * expectをassert・画像・Byte・寸法で処理し、その結果を呼び出し元へ反映する。
         *
         * @returns assert・画像・Byte・寸法の結果
         */
        function expectCallback9() {
            return assertImageByteSize(IMAGE_VALIDATION_LIMITS.bytesPerImage + 1);
        }))
            .toThrow("画像は1点10MiB以下にしてください。");
        const close = vi.fn();
        vi.stubGlobal("createImageBitmap", vi.fn((/**
         * 「画像1点の容量と画素数の上限を適用する」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする。
         *
         * @returns 「画像1点の容量と画素数の上限を適用する」で外部依存から返す要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクトを固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function fnCallback10() {
            return ({ width: 10000, height: 4001, close });
        })));
        const blob = new Blob([
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ], { type: "image/png" });
        await expect(validateImageBlob(blob)).rejects.toThrow("画像寸法の上限を超えています。");
        expect(close).toHaveBeenCalledOnce();
    }));
}));
