import type { MarginPreset, PageSize } from "./worksheet";

export const PAGE_SIZES_MM: Record<PageSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: "A4" },
  B5: { width: 182, height: 257, label: "JIS B5" },
};

export const MARGINS_MM: Record<MarginPreset, number> = {
  wide: 20,
  normal: 15,
  narrow: 10,
  veryNarrow: 5,
};

export const mmToPt = (millimeters: number): number => millimeters * 72 / 25.4;

export function getPrintableArea(size: PageSize, margin: MarginPreset) {
  const page = PAGE_SIZES_MM[size];
  const marginMm = MARGINS_MM[margin];
  return {
    widthMm: page.width - marginMm * 2,
    heightMm: page.height - marginMm * 2,
    marginMm,
  };
}
