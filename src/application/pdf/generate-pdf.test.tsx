import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { generateWorksheetPdf } from "./generate-pdf";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "./pdf-pagination-guard";
const htmlToImage = vi.hoisted((/**
 * 「対象機能」で外部依存から返すcanvas・To・Blob・get・Font・Embed・CSS・to・Canvasを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns canvas・To・Blob・get・Font・Embed・CSS・to・Canvasを持つオブジェクト
 */
function hoistedCallback1() {
    const canvasToBlob = vi.fn((/**
     * 「対象機能」で外部依存から返す条件成立後に実行する処理の結果を固定し、検証を決定的にする。
     *
     * @param callback 条件成立後に実行する処理
     * @param type 作成または検証する要素種別
     * @param quality PDF画像へ適用する圧縮品質
     * @returns 条件成立後に実行する処理の結果
     */
    function fnCallback2(callback: BlobCallback, type?: string, quality?: number) {
        return callback(new Blob([`${type}:${quality}`], { type: type ?? "application/octet-stream" }));
    }));
    return {
        canvasToBlob,
        getFontEmbedCSS: vi.fn((/**
         * 「対象機能」で外部依存から返す「@font-face{font-family:KaTeX_Main}」を固定し、検証を決定的にする。
         *
         * @param _node コールバックの契約上受け取るが、この処理では参照しないノード
         * @param _options コールバックの契約上受け取るが、この処理では参照しないoptions
         * @returns 「対象機能」で外部依存から返す「@font-face{font-family:KaTeX_Main}」を固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function fnCallback3(_node: HTMLElement, _options?: Record<string, unknown>) {
            return "@font-face{font-family:KaTeX_Main}";
        })),
        toCanvas: vi.fn((/**
         * 「対象機能」で外部依存から返すto・Blobを持つオブジェクトを固定し、検証を決定的にする。
         *
         * @param _node コールバックの契約上受け取るが、この処理では参照しないノード
         * @param _options コールバックの契約上受け取るが、この処理では参照しないoptions
         * @returns 「対象機能」で外部依存から返すto・Blobを持つオブジェクトを固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function fnCallback4(_node: HTMLElement, _options?: Record<string, unknown>) {
            return ({
                toBlob: canvasToBlob,
            } as unknown as HTMLCanvasElement);
        })),
    };
}));
const reactPdf = vi.hoisted((/**
 * 「対象機能」で外部依存から返すPDFを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns PDFを持つオブジェクト
 */
function hoistedCallback5() {
    return ({
        pdf: vi.fn((/**
         * 「対象機能」で外部依存から返すto・Blobを持つオブジェクトを固定し、検証を決定的にする。
         *
         * @returns to・Blobを持つオブジェクト
         */
        function fnCallback6() {
            return ({ toBlob: vi.fn((/**
                 * 「対象機能」で外部依存から返すBlobの新しいインスタンスを固定し、検証を決定的にする。
                 *
                 * @returns 「対象機能」で外部依存から返すBlobの新しいインスタンスを固定し、検証を決定的にする処理の完了時に解決するPromise
                 */
                async function fnCallback7() {
                    return new Blob(["pdf"]);
                })) });
        })),
    });
}));
vi.mock("html-to-image", (/**
 * 「対象機能」で外部依存から返すhtml・To・画像を固定し、検証を決定的にする。
 *
 * @returns html・To・画像
 */
function mockCallback8() {
    return htmlToImage;
}));
vi.mock("@react-pdf/renderer", (/**
 * 「対象機能」で外部依存から返す文書・画像・ページ・Style・Sheet・PDFを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns 文書・画像・ページ・Style・Sheet・PDFを持つオブジェクト
 */
function mockCallback9() {
    return ({
        Document: "Document",
        Image: "Image",
        Page: "Page",
        StyleSheet: { create: (/**
             * 新しいプリントと画像アセットを同じトランザクションで保存する。
             *
             * @param styles PDFレンダラーへ渡すスタイル定義
             * @returns PDFレンダラーへ渡すスタイル定義
             */
            function createCallback10<T>(styles: T) {
                return styles;
            }) },
        pdf: reactPdf.pdf,
    });
}));
describe("generateWorksheetPdf", (/**
 * 「generateWorksheetPdf」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite11() {
    beforeEach((/**
     * 各テストが互いに影響しない初期状態とモックを準備する。
     */
    function prepareTestCase12() {
        htmlToImage.getFontEmbedCSS.mockClear();
        htmlToImage.toCanvas.mockClear();
        htmlToImage.canvasToBlob.mockClear();
        reactPdf.pdf.mockClear();
        vi.stubGlobal("requestAnimationFrame", (/**
         * stub・Globalを条件成立後に実行する処理で処理し、その結果を呼び出し元へ反映する。
         *
         * @param callback 条件成立後に実行する処理
         * @returns 1
         */
        function stubGlobalCallback13(callback: FrameRequestCallback) {
            callback(0);
            return 1;
        }));
    }));
    afterEach((/**
     * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
     */
    function cleanUpTestCase14() {
        vi.unstubAllGlobals();
    }));
    it("embeds the preview's web fonts in every PDF page image", (/**
     * 「embeds the preview's web fonts in every PDF page image」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase15() {
        const previewRoot = document.createElement("div");
        previewRoot.className = "preview-pages";
        const pages = [document.createElement("div"), document.createElement("div")];
        pages.forEach((/**
         * 各ブラウザー操作と描画確認に使うPlaywrightページについてappendを実行し、対応関係または検証状態を更新する。
         *
         * @param page ブラウザー操作と描画確認に使うPlaywrightページ
         */
        function processItem16(page) {
            return previewRoot.append(page);
        }));
        document.body.append(previewRoot);
        await generateWorksheetPdf(createWorksheet(), pages);
        expect(htmlToImage.getFontEmbedCSS).toHaveBeenCalledOnce();
        expect(htmlToImage.getFontEmbedCSS).toHaveBeenCalledWith(previewRoot);
        expect(htmlToImage.toCanvas).toHaveBeenCalledTimes(2);
        for (const [index, page] of pages.entries()) {
            expect(htmlToImage.toCanvas).toHaveBeenNthCalledWith(index + 1, page, expect.objectContaining({
                fontEmbedCSS: "@font-face{font-family:KaTeX_Main}",
            }));
            expect(htmlToImage.toCanvas.mock.calls[index]?.[1]).not.toHaveProperty("skipFonts");
        }
        expect(htmlToImage.canvasToBlob).toHaveBeenCalledTimes(2);
        for (const [, type, quality] of htmlToImage.canvasToBlob.mock.calls) {
            expect(type).toBe("image/jpeg");
            expect(quality).toBe(0.98);
        }
    }));
    it("rejects oversized preview content before rasterizing a PDF page", (/**
     * 「rejects oversized preview content before rasterizing a PDF page」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase17() {
        const previewRoot = document.createElement("div");
        previewRoot.className = "preview-pages";
        previewRoot.dataset.paginationError = OVERSIZED_PAGINATION_ERROR;
        const page = document.createElement("div");
        previewRoot.append(page);
        document.body.append(previewRoot);
        await expect(generateWorksheetPdf(createWorksheet(), [page])).rejects.toThrow(OVERSIZED_PAGINATION_MESSAGE);
        expect(htmlToImage.getFontEmbedCSS).not.toHaveBeenCalled();
        expect(htmlToImage.toCanvas).not.toHaveBeenCalled();
        expect(reactPdf.pdf).not.toHaveBeenCalled();
    }));
    it("rejects when a browser cannot encode the page canvas", (/**
     * 「rejects when a browser cannot encode the page canvas」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase18() {
        const page = document.createElement("div");
        document.body.append(page);
        htmlToImage.canvasToBlob.mockImplementationOnce((/**
         * 「rejects when a browser cannot encode the page canvas」で外部依存から返す条件成立後に実行する処理の結果を固定し、検証を決定的にする。
         *
         * @param callback 条件成立後に実行する処理
         * @returns 条件成立後に実行する処理の結果
         */
        function mockImplementationOnceCallback19(callback) {
            return callback(null);
        }));
        await expect(generateWorksheetPdf(createWorksheet(), [page])).rejects.toThrow("PDFページの画像を生成できませんでした");
        expect(reactPdf.pdf).not.toHaveBeenCalled();
    }));
}));
