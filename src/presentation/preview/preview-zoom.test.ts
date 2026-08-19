import { describe, expect, it } from "vitest";

import { calculateFittedPreviewZoom, getNextPreviewZoom } from "./preview-zoom";

describe("preview zoom", () => {
  it("changes manual zoom in 5% increments", () => {
    expect(getNextPreviewZoom(1, 1)).toBe(1.05);
    expect(getNextPreviewZoom(1, -1)).toBe(0.95);
    expect(getNextPreviewZoom(0.25, -1)).toBe(0.25);
    expect(getNextPreviewZoom(2, 1)).toBe(2);
  });

  it("moves a fitted zoom to the next 5% step", () => {
    expect(getNextPreviewZoom(0.873, 1)).toBe(0.9);
    expect(getNextPreviewZoom(0.873, -1)).toBe(0.85);
  });

  it("fits the page width to the available viewport width", () => {
    expect(calculateFittedPreviewZoom({
      mode: "fitWidth",
      viewportWidth: 556,
      viewportHeight: 800,
      horizontalPadding: 36,
      verticalPadding: 88,
      pageAspectRatio: 1.4,
    })).toBe(1);
  });

  it("fits the whole page using the more restrictive dimension", () => {
    expect(calculateFittedPreviewZoom({
      mode: "fitPage",
      viewportWidth: 816,
      viewportHeight: 476,
      horizontalPadding: 36,
      verticalPadding: 88,
      pageAspectRatio: 1.4,
    })).toBe(0.5);
  });
});
