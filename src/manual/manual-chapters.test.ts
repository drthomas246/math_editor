import { describe, expect, it } from "vitest";

import { getAdjacentManualChapters, getManualChapter, MANUAL_CHAPTERS } from "./manual-chapters";

describe("manual chapters", () => {
  it("13章を定義順かつ空でない本文で提供する", () => {
    expect(MANUAL_CHAPTERS).toHaveLength(13);
    expect(new Set(MANUAL_CHAPTERS.map((chapter) => chapter.slug))).toHaveProperty("size", 13);
    expect(MANUAL_CHAPTERS.every((chapter, index) => chapter.order === index + 1 && chapter.markdown.trim().length > 0)).toBe(true);
  });

  it("章を解決して前後章を返す", () => {
    expect(getManualChapter("formulas")?.title).toBe("数式");
    expect(getManualChapter("unknown")).toBeUndefined();
    expect(getAdjacentManualChapters("overview")).toEqual({ next: MANUAL_CHAPTERS[1] });
    expect(getAdjacentManualChapters("formulas")).toMatchObject({ previous: { slug: "editor-basics" }, next: { slug: "images-and-tables" } });
    expect(getAdjacentManualChapters("ai-skills")).toEqual({ previous: MANUAL_CHAPTERS[9], next: MANUAL_CHAPTERS[11] });
    expect(getAdjacentManualChapters("troubleshooting")).toEqual({ previous: MANUAL_CHAPTERS[10], next: MANUAL_CHAPTERS[12] });
    expect(getAdjacentManualChapters("version-and-license")).toEqual({ previous: MANUAL_CHAPTERS[11] });
  });
});
