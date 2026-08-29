import { Document, Image, Page, StyleSheet, pdf } from "@react-pdf/renderer";
import { getFontEmbedCSS, toCanvas } from "html-to-image";

import { PAGE_SIZES_MM, mmToPt } from "../../domain/worksheet/page-tokens";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import { assertPreviewPaginationCanExport } from "./pdf-pagination-guard";

export type PreviewMode = "questions" | "withAnswers" | "questionsAndAnswers";
export type EditorPreviewMode = Exclude<PreviewMode, "questionsAndAnswers">;

const PDF_PIXEL_RATIO = 4;
// PNG pages force React PDF to decode and recompress every full-page bitmap.
// A high-quality JPEG keeps the 4x raster sharp while allowing direct DCT
// embedding, which is substantially faster and uses less peak memory.
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
 */
export async function generateWorksheetPdf(worksheet: Worksheet, previewPages: readonly HTMLElement[]): Promise<Blob> {
  const firstPage = previewPages[0];
  if (!firstPage) throw new Error("PDFに出力するページを準備できませんでした");
  const previewRoot = firstPage.closest<HTMLElement>(".preview-pages") ?? firstPage;
  assertPreviewPaginationCanExport(previewRoot);

  await waitForPreviewAssets(previewPages);
  Object.values(PDF_PERFORMANCE_MEASURES).forEach((name) => performance.clearMeasures(name));

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
  const pdfPageSize: [number, number] = [mmToPt(pageSize.width), mmToPt(pageSize.height)];
  const element = <Document title={worksheet.title} author="数学プリント作成">
    {pageImages.map((source, index) => <Page key={index} size={pdfPageSize} style={styles.page} wrap={false}>
      <Image src={source} style={styles.pageImage} />
    </Page>)}
  </Document>;

  const removeBufferGuard = installReactPdfBrowserBufferGuard();
  try {
    const assemblyStartedAt = performance.now();
    const blob = await pdf(element).toBlob();
    recordPerformanceMeasure(PDF_PERFORMANCE_MEASURES.assembly, assemblyStartedAt);
    return blob;
  } finally {
    removeBufferGuard();
  }
}

function recordPerformanceMeasure(name: string, startedAt: number): void {
  performance.measure(name, { start: startedAt, end: performance.now() });
}

function canvasToPdfImage(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PDFページの画像を生成できませんでした"));
    }, PDF_IMAGE_TYPE, PDF_IMAGE_QUALITY);
  });
}

function installReactPdfBrowserBufferGuard(): () => void {
  // @react-pdf/layout checks Buffer.isBuffer before its Blob branch even in
  // browsers. Vite does not expose Node's Buffer globally, so provide only the
  // guard the browser path needs; image decoding itself remains Blob-based.
  const runtimeGlobal = globalThis as unknown as {
    Buffer?: { isBuffer(value: unknown): boolean };
  };
  if (runtimeGlobal.Buffer) return () => undefined;
  runtimeGlobal.Buffer = { isBuffer: () => false };
  return () => { delete runtimeGlobal.Buffer; };
}

async function waitForPreviewAssets(previewPages: readonly HTMLElement[]) {
  await document.fonts?.ready;
  const images = previewPages.flatMap((page) => Array.from(page.querySelectorAll("img")));
  await Promise.all(images.map(async (image) => {
    if (image.complete) {
      if (image.naturalWidth > 0) return;
      throw new Error("PDFに使用する画像を読み込めませんでした");
    }
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("PDFに使用する画像を読み込めませんでした")), { once: true });
    });
  }));

  // Reactの反映と画像デコード後のレイアウトが確定するまで待つ。
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
