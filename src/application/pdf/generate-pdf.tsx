import { Document, Image, Page, StyleSheet, pdf } from "@react-pdf/renderer";
import { getFontEmbedCSS, toPng } from "html-to-image";

import { PAGE_SIZES_MM, mmToPt } from "../../domain/worksheet/page-tokens";
import type { Worksheet } from "../../domain/worksheet/worksheet";

export type PreviewMode = "questions" | "withAnswers" | "questionsAndAnswers";
export type EditorPreviewMode = Exclude<PreviewMode, "questionsAndAnswers">;

const PDF_PIXEL_RATIO = 4;

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

  await waitForPreviewAssets(previewPages);

  // 数式で使用するMathLiveのWebフォントを画像内へ埋め込み、OSフォントへの
  // 置き換わりを防ぐ。生成したCSSは全ページで再利用する。
  const previewRoot = firstPage.closest<HTMLElement>(".preview-pages") ?? firstPage;
  // MathLiveの配布CSSはWOFF2のみ。preferredFontFormatを指定するとhtml-to-imageの
  // フィルターが連続する@font-faceのsrcを取りこぼすため、形式指定は行わない。
  const fontEmbedCSS = await getFontEmbedCSS(previewRoot);

  const pageImages: string[] = [];
  for (const page of previewPages) {
    pageImages.push(await toPng(page, {
      backgroundColor: "#fff",
      fontEmbedCSS,
      pixelRatio: PDF_PIXEL_RATIO,
      skipAutoScale: true,
    }));
  }

  const pageSize = PAGE_SIZES_MM[worksheet.pageSettings.size];
  const pdfPageSize: [number, number] = [mmToPt(pageSize.width), mmToPt(pageSize.height)];
  const element = <Document title={worksheet.title} author="数学プリント作成">
    {pageImages.map((source, index) => <Page key={index} size={pdfPageSize} style={styles.page} wrap={false}>
      <Image src={source} style={styles.pageImage} />
    </Page>)}
  </Document>;

  return pdf(element).toBlob();
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
