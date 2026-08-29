import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { generateWorksheetPdf } from "./generate-pdf";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "./pdf-pagination-guard";

const htmlToImage = vi.hoisted(() => {
  const canvasToBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => callback(new Blob(
    [`${type}:${quality}`],
    { type: type ?? "application/octet-stream" },
  )));
  return {
    canvasToBlob,
    getFontEmbedCSS: vi.fn(async (_node: HTMLElement, _options?: Record<string, unknown>) => "@font-face{font-family:KaTeX_Main}"),
    toCanvas: vi.fn(async (_node: HTMLElement, _options?: Record<string, unknown>) => ({
      toBlob: canvasToBlob,
    } as unknown as HTMLCanvasElement)),
  };
});

const reactPdf = vi.hoisted(() => ({
  pdf: vi.fn(() => ({ toBlob: vi.fn(async () => new Blob(["pdf"])) })),
}));

vi.mock("html-to-image", () => htmlToImage);
vi.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Image: "Image",
  Page: "Page",
  StyleSheet: { create: <T,>(styles: T) => styles },
  pdf: reactPdf.pdf,
}));

describe("generateWorksheetPdf", () => {
  beforeEach(() => {
    htmlToImage.getFontEmbedCSS.mockClear();
    htmlToImage.toCanvas.mockClear();
    htmlToImage.canvasToBlob.mockClear();
    reactPdf.pdf.mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("embeds the preview's web fonts in every PDF page image", async () => {
    const previewRoot = document.createElement("div");
    previewRoot.className = "preview-pages";
    const pages = [document.createElement("div"), document.createElement("div")];
    pages.forEach((page) => previewRoot.append(page));
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
  });

  it("rejects oversized preview content before rasterizing a PDF page", async () => {
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
  });

  it("rejects when a browser cannot encode the page canvas", async () => {
    const page = document.createElement("div");
    document.body.append(page);
    htmlToImage.canvasToBlob.mockImplementationOnce((callback) => callback(null));

    await expect(generateWorksheetPdf(createWorksheet(), [page])).rejects.toThrow(
      "PDFページの画像を生成できませんでした",
    );

    expect(reactPdf.pdf).not.toHaveBeenCalled();
  });
});
