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
    fonts: "sujita.pdf.fonts",
    rasterization: "sujita.pdf.rasterization",
    assembly: "sujita.pdf.assembly",
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
     * 各生成物または計測項目を識別する名前についてclear・Measuresを実行し、対応関係または検証状態を更新する。
     *
     * @param name 生成物または計測項目を識別する名前
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
    const element = <Document title={worksheet.title} author="すうがく仕立て">
    {pageImages.map((/**
         * 各複製・変換・更新の起点となる値を画面表示用のReact要素へ変換する。
         *
         * @param source 複製・変換・更新の起点となる値
         * @param index 対象となる位置
         * @returns 画面表示用のReact要素
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
 * Performance APIの開始・終了markから処理時間を計算し、計測結果として記録する。
 *
 * @param name 生成物または計測項目を識別する名前
 * @param startedAt 処理時間を計算する開始時刻
 */
function recordPerformanceMeasure(name: string, startedAt: number): void {
    performance.measure(name, { start: startedAt, end: performance.now() });
}
/**
 * vas・To・PDF・画像が仕様上の条件を満たすか判定する。
 *
 * @param canvas PDF画像へ変換する描画済みcanvas要素
 * @returns Promiseの新しいインスタンスが真になる場合はtrue
 */
function canvasToPdfImage(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((/**
     * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
     *
     * @param resolve 非同期処理を正常完了させるPromise関数
     * @param reject 非同期処理を失敗として終了させるPromise関数
     */
    function settlePromise3(resolve, reject) {
        canvas.toBlob((/**
         * to・Blobを比較・保存・表示先が要求する形式へ変換する。
         *
         * @param blob 検証または保存するバイナリデータ
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
 * Node.jsのBufferを前提とするreact-pdfの判定をブラウザー向けに補い、終了時に元の状態へ戻せるようにする。
 *
 * @returns 呼び出し元が後で実行する関数
 */
function installReactPdfBrowserBufferGuard(): () => void {
    // @react-pdf/layoutはブラウザーでもBlob判定より先にBuffer.isBufferを参照する。
    // ViteはNodeのBufferをグローバル公開しないため、ブラウザー経路に必要な判定だけを補い、
    // 画像デコード自体はBlobのまま処理する。
    const runtimeGlobal = globalThis as unknown as {
        Buffer?: {
            /**
             * react-pdfが受け取った値をNode.jsのBufferとして扱う必要があるか判定する。
             *
             * @param value react-pdfが画像データとして検査する値
             * @returns ブラウザーではBufferを使用しないため常にfalse
             */
            isBuffer(value: unknown): boolean;
        };
    };
    if (runtimeGlobal.Buffer)
        return (/**
         * 非同期処理の完了後に、登録時の後始末または状態更新を実行する。
         */
        function applyDeferredOperation5() {
            return undefined;
        });
    runtimeGlobal.Buffer = { isBuffer: (/**
         * 条件不成立を示すfalseが真になるかを判定する。
         *
         * @returns ブラウザーではBufferとして扱わないため常にfalse
         */
        function isBufferCallback6() {
            return false;
        }) };
    return (/**
     * 登録したイベント購読・Object URL・一時状態を処理終了時に解放する。
     */
    function releaseResources7() { delete runtimeGlobal.Buffer; });
}
/**
 * PDF変換前にプレビュー内の画像とフォントの読み込みが完了するまで待機する。
 *
 * @param previewPages PDFへ変換するプレビューのページ要素一覧
 * @returns PDF変換前にプレビュー内の画像とフォントの読み込みが完了するまで待機する処理の完了時に解決するPromise
 */
async function waitForPreviewAssets(previewPages: readonly HTMLElement[]) {
    await document.fonts?.ready;
    const images = previewPages.flatMap((/**
     * 各ブラウザー操作と描画確認に使うPlaywrightページを0件以上の結果へ変換し、一つの配列へ展開する。
     *
     * @param page ブラウザー操作と描画確認に使うPlaywrightページ
     * @returns 変換元の結果
     */
    function expandItem8(page) {
        return Array.from(page.querySelectorAll("img"));
    }));
    await Promise.all(images.map((/**
     * 各表示または編集する画像を処理済みの要素へ変換する。
     *
     * @param image 表示または編集する画像
     * @returns 各表示または編集する画像を処理済みの要素へ変換する処理の完了時に解決するPromise
     */
    async function mapItem9(image) {
        if (image.complete) {
            if (image.naturalWidth > 0)
                return;
            throw new Error("PDFに使用する画像を読み込めませんでした");
        }
        await new Promise<void>((/**
         * PDF生成前に画像の読込結果を確定できるよう、load/errorイベントをPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         * @param reject 非同期処理を失敗として終了させるPromise関数
         */
        function settlePromise10(resolve, reject) {
            image.addEventListener("load", (/**
             * 画像の読み込み完了後にPDF生成を再開する。
             *
             */
            function handleDomEvent11() {
                return resolve();
            }), { once: true });
            image.addEventListener("error", (/**
             * 欠落画像を含むPDFを出力しないよう、読み込み失敗を例外として伝える。
             *
             */
            function handleDomEvent12() {
                return reject(new Error("PDFに使用する画像を読み込めませんでした"));
            }), { once: true });
        }));
    })));
    // Reactの反映と画像デコード後のレイアウトが確定するまで待つ。
    await new Promise<void>((/**
     * レイアウト確定後の描画フレームを、呼び出し側がawaitできるPromiseへ変換する。
     *
     * @param resolve 非同期処理を正常完了させるPromise関数
     */
    function settlePromise13(resolve) {
        return requestAnimationFrame((/**
         * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
         *
         */
        function handleAnimationFrame14() {
            return requestAnimationFrame((/**
             * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
             *
             */
            function handleAnimationFrame15() {
                return resolve();
            }));
        }));
    }));
}
