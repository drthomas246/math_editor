import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { generateWorksheetPdf } from "./generate-pdf";

const htmlToImage = vi.hoisted(() => ({
  getFontEmbedCSS: vi.fn(async (_node: HTMLElement, _options?: Record<string, unknown>) => "@font-face{font-family:KaTeX_Main}"),
  toPng: vi.fn(async (_node: HTMLElement, _options?: Record<string, unknown>) => "data:image/png;base64,cGFnZQ=="),
}));

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
    htmlToImage.toPng.mockClear();
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
    expect(htmlToImage.toPng).toHaveBeenCalledTimes(2);
    for (const [index, page] of pages.entries()) {
      expect(htmlToImage.toPng).toHaveBeenNthCalledWith(index + 1, page, expect.objectContaining({
        fontEmbedCSS: "@font-face{font-family:KaTeX_Main}",
      }));
      expect(htmlToImage.toPng.mock.calls[index]?.[1]).not.toHaveProperty("skipFonts");
    }
  });
});
