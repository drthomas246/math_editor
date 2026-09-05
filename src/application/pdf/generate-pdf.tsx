import { Document, Image, Page, StyleSheet, pdf } from "@react-pdf/renderer";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { PAGE_SIZES_MM, mmToPt } from "../../domain/worksheet/page-tokens";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import { assertPreviewPaginationCanExport } from "./pdf-pagination-guard";
export type PreviewMode = "questions" | "withAnswers" | "questionsAndAnswers";
export type EditorPreviewMode = Exclude<PreviewMode, "questionsAndAnswers">;
const PDF_PIXEL_RATIO = 4;
// 高品質JPEGなら4倍解像度の鮮明さを保ちながらDCTデータを直接埋め込める。
// 全ページ画像の再圧縮が必要なPNGより高速で、ピークメモリも抑えられる。
const PDF_IMAGE_TYPE = "image/jpeg";
const PDF_IMAGE_QUALITY = 0.98;
const PDF_PERFORMANCE_MEASURES = {
    fonts: "math-editor.pdf.fonts",
    rasterization: "math-editor.pdf.rasterization",
    assembly: "math-editor.pdf.assembly",
} as const;
const styles = StyleSheet.create({
    page: { backgroundColor: "#fff" },
    pageImage: { width: "100%", height: "100%" },
});
/**
 * 画面プレビューをそのまま高解像度画像にしてPDFへ格納する。
 *
 * PDF専用に内容を再解釈すると、日本語フォント、数式、画像、リッチテキストの
 * 表現がプレビューとずれるため、両者で同じブラウザー描画結果を共有する。
 *
 * @param worksheet PDFへ出力するプリント
 * @param previewPages 描画済みのプレビューページ
 * @returns 生成したPDFのBlob
 */
export async function generateWorksheetPdf(worksheet: Worksheet, previewPages: readonly HTMLElement[]): Promise<Blob> {
    const firstPage = previewPages[0];
    if (!firstPage)
        throw new Error("PDFに出力するページを準備できませんでした");
    const previewRoot = firstPage.closest<HTMLElement>(".preview-pages") ?? firstPage;
    assertPreviewPaginationCanExport(previewRoot);
    await waitForPreviewAssets(previewPages);
    Object.values(PDF_PERFORMANCE_MEASURES).forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param name nameとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function processItem1(name) {
        return performance.clearMeasures(name);
    }));
    // 数式で使用するMathLiveのWebフォントを画像内へ埋め込み、OSフォントへの
    // 置き換わりを防ぐ。生成したCSSは全ページで再利用する。
    // MathLiveの配布CSSはWOFF2のみ。preferredFontFormatを指定するとhtml-to-imageの
    // フィルターが連続する@font-faceのsrcを取りこぼすため、形式指定は行わない。
    const fontsStartedAt = performance.now();
    const fontEmbedCSS = await getFontEmbedCSS(previewRoot);
    recordPerformanceMeasure(PDF_PERFORMANCE_MEASURES.fonts, fontsStartedAt);
    const rasterizationStartedAt = performance.now();
    const pageImages: Blob[] = [];
    for (const page of previewPages) {
        const canvas = await toCanvas(page, {
            backgroundColor: "#fff",
            fontEmbedCSS,
            pixelRatio: PDF_PIXEL_RATIO,
            skipAutoScale: true,
        });
        pageImages.push(await canvasToPdfImage(canvas));
    }
    recordPerformanceMeasure(PDF_PERFORMANCE_MEASURES.rasterization, rasterizationStartedAt);
    const pageSize = PAGE_SIZES_MM[worksheet.pageSettings.size];
    const pdfPageSize: [
        number,
        number
    ] = [mmToPt(pageSize.width), mmToPt(pageSize.height)];
    const element = <Document title={worksheet.title} author="数学プリント作成">
    {pageImages.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param source sourceとして使用する値
         * @param index 対象となる位置
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem2(source, index) {
            return <Page key={index} size={pdfPageSize} style={styles.page} wrap={false}>
      <Image src={source} style={styles.pageImage}/>
    </Page>;
        }))}
  </Document>;
    const removeBufferGuard = installReactPdfBrowserBufferGuard();
    try {
        const assemblyStartedAt = performance.now();
        const blob = await pdf(element).toBlob();
        recordPerformanceMeasure(PDF_PERFORMANCE_MEASURES.assembly, assemblyStartedAt);
        return blob;
    }
    finally {
        removeBufferGuard();
    }
}
/**
 * recordPerformanceMeasureに必要な処理を実行する。
 *
 * @param name nameとして使用する値
 * @param startedAt startedAtとして使用する値
 */
function recordPerformanceMeasure(name: string, startedAt: number): void {
    performance.measure(name, { start: startedAt, end: performance.now() });
}
/**
 * canvasToPdfImageで表される条件を判定する。
 *
 * @param canvas canvasとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function canvasToPdfImage(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param resolve resolveとして使用する値
     * @param reject rejectとして使用する値
     */
    function commentRuleCallback3(resolve, reject) {
        canvas.toBlob((/**
         * toBlobへ渡す処理を実行する。
         *
         * @param blob blobとして使用する値
         */
        function toBlobCallback4(blob) {
            if (blob)
                resolve(blob);
            else
                reject(new Error("PDFページの画像を生成できませんでした"));
        }), PDF_IMAGE_TYPE, PDF_IMAGE_QUALITY);
    }));
}
/**
 * installReactPdfBrowserBufferGuardに必要な処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function installReactPdfBrowserBufferGuard(): () => void {
    // @react-pdf/layoutはブラウザーでもBlob判定より先にBuffer.isBufferを参照する。
    // ViteはNodeのBufferをグローバル公開しないため、ブラウザー経路に必要な判定だけを補い、
    // 画像デコード自体はBlobのまま処理する。
    const runtimeGlobal = globalThis as unknown as {
        Buffer?: {
            /**
             * isBufferで表される条件を判定する。
             *
             * @param value 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            isBuffer(value: unknown): boolean;
        };
    };
    if (runtimeGlobal.Buffer)
        return (/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback5() {
            return undefined;
        });
    runtimeGlobal.Buffer = { isBuffer: (/**
         * isBufferで表される条件を判定する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function isBufferCallback6() {
            return false;
        }) };
    return (/**
     * 呼び出し元から要求された処理を実行する。
     */
    function commentRuleCallback7() { delete runtimeGlobal.Buffer; });
}
/**
 * waitForPreviewAssetsに必要な処理を実行する。
 *
 * @param previewPages previewPagesとして使用する値
 * @returns 非同期処理の結果
 */
async function waitForPreviewAssets(previewPages: readonly HTMLElement[]) {
    await document.fonts?.ready;
    const images = previewPages.flatMap((/**
     * 各要素を変換しながら一つの配列へ展開する。
     *
     * @param page pageとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function expandItem8(page) {
        return Array.from(page.querySelectorAll("img"));
    }));
    await Promise.all(images.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param image imageとして使用する値
     * @returns 非同期処理の結果
     */
    async function mapItem9(image) {
        if (image.complete) {
            if (image.naturalWidth > 0)
                return;
            throw new Error("PDFに使用する画像を読み込めませんでした");
        }
        await new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @param reject rejectとして使用する値
         */
        function commentRuleCallback10(resolve, reject) {
            image.addEventListener("load", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent11() {
                return resolve();
            }), { once: true });
            image.addEventListener("error", (/**
             * DOMから通知されたイベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleDomEvent12() {
                return reject(new Error("PDFに使用する画像を読み込めませんでした"));
            }), { once: true });
        }));
    })));
    // Reactの反映と画像デコード後のレイアウトが確定するまで待つ。
    await new Promise<void>((/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param resolve resolveとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function commentRuleCallback13(resolve) {
        return requestAnimationFrame((/**
         * 次の描画タイミングで画面状態を更新する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleAnimationFrame14() {
            return requestAnimationFrame((/**
             * 次の描画タイミングで画面状態を更新する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleAnimationFrame15() {
                return resolve();
            }));
        }));
    }));
}
