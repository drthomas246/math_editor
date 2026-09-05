import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { generateWorksheetPdf } from "./generate-pdf";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "./pdf-pagination-guard";
const htmlToImage = vi.hoisted((/**
 * hoistedへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function hoistedCallback1() {
    const canvasToBlob = vi.fn((/**
     * fnへ渡す処理を実行する。
     *
     * @param callback callbackとして使用する値
     * @param type typeとして使用する値
     * @param quality qualityとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fnCallback2(callback: BlobCallback, type?: string, quality?: number) {
        return callback(new Blob([`${type}:${quality}`], { type: type ?? "application/octet-stream" }));
    }));
    return {
        canvasToBlob,
        getFontEmbedCSS: vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param _node _nodeとして使用する値
         * @param _options _optionsとして使用する値
         * @returns 非同期処理の結果
         */
        async function fnCallback3(_node: HTMLElement, _options?: Record<string, unknown>) {
            return "@font-face{font-family:KaTeX_Main}";
        })),
        toCanvas: vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @param _node _nodeとして使用する値
         * @param _options _optionsとして使用する値
         * @returns 非同期処理の結果
         */
        async function fnCallback4(_node: HTMLElement, _options?: Record<string, unknown>) {
            return ({
                toBlob: canvasToBlob,
            } as unknown as HTMLCanvasElement);
        })),
    };
}));
const reactPdf = vi.hoisted((/**
 * hoistedへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function hoistedCallback5() {
    return ({
        pdf: vi.fn((/**
         * fnへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function fnCallback6() {
            return ({ toBlob: vi.fn((/**
                 * fnへ渡す処理を実行する。
                 *
                 * @returns 非同期処理の結果
                 */
                async function fnCallback7() {
                    return new Blob(["pdf"]);
                })) });
        })),
    });
}));
vi.mock("html-to-image", (/**
 * mockへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function mockCallback8() {
    return htmlToImage;
}));
vi.mock("@react-pdf/renderer", (/**
 * mockへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function mockCallback9() {
    return ({
        Document: "Document",
        Image: "Image",
        Page: "Page",
        StyleSheet: { create: (/**
             * createで必要な値を作成する。
             *
             * @param styles stylesとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function createCallback10<T>(styles: T) {
                return styles;
            }) },
        pdf: reactPdf.pdf,
    });
}));
describe("generateWorksheetPdf", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite11() {
    beforeEach((/**
     * 各テストケースに必要な前提条件を準備する。
     */
    function prepareTestCase12() {
        htmlToImage.getFontEmbedCSS.mockClear();
        htmlToImage.toCanvas.mockClear();
        htmlToImage.canvasToBlob.mockClear();
        reactPdf.pdf.mockClear();
        vi.stubGlobal("requestAnimationFrame", (/**
         * stubGlobalへ渡す処理を実行する。
         *
         * @param callback callbackとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function stubGlobalCallback13(callback: FrameRequestCallback) {
            callback(0);
            return 1;
        }));
    }));
    afterEach((/**
     * 各テストケースで使用した状態を後片付けする。
     */
    function cleanUpTestCase14() {
        vi.unstubAllGlobals();
    }));
    it("embeds the preview's web fonts in every PDF page image", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase15() {
        const previewRoot = document.createElement("div");
        previewRoot.className = "preview-pages";
        const pages = [document.createElement("div"), document.createElement("div")];
        pages.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param page pageとして使用する値
         * @returns 呼び出し元で使用する処理結果
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
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
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
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase18() {
        const page = document.createElement("div");
        document.body.append(page);
        htmlToImage.canvasToBlob.mockImplementationOnce((/**
         * mockImplementationOnceへ渡す処理を実行する。
         *
         * @param callback callbackとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mockImplementationOnceCallback19(callback) {
            return callback(null);
        }));
        await expect(generateWorksheetPdf(createWorksheet(), [page])).rejects.toThrow("PDFページの画像を生成できませんでした");
        expect(reactPdf.pdf).not.toHaveBeenCalled();
    }));
}));
