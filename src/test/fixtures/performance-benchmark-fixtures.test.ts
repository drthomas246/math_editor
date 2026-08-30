import { describe, expect, it } from "vitest";

import { WorksheetSchema } from "../../domain/worksheet/worksheet";
import {
  createComplexPdfBenchmarkFixture,
  createWorksheetListFixtures,
  summarizeWorksheetComplexity,
} from "./performance-benchmark-fixtures";

describe("performance benchmark fixtures", () => {
  it("一覧用のminimal・typical・heavyを段階的に複雑化する", () => {
    const minimal = createWorksheetListFixtures("minimal", 2)[0]!;
    const typical = createWorksheetListFixtures("typical", 2)[0]!;
    const heavy = createWorksheetListFixtures("heavy", 2)[0]!;
    const minimalComplexity = summarizeWorksheetComplexity(minimal);
    const typicalComplexity = summarizeWorksheetComplexity(typical);
    const heavyComplexity = summarizeWorksheetComplexity(heavy);

    expect(WorksheetSchema.safeParse(minimal).success).toBe(true);
    expect(WorksheetSchema.safeParse(typical).success).toBe(true);
    expect(WorksheetSchema.safeParse(heavy).success).toBe(true);
    expect(typicalComplexity.problems).toBeGreaterThan(minimalComplexity.problems);
    expect(typicalComplexity.contentBlocks).toBeGreaterThan(minimalComplexity.contentBlocks);
    expect(heavyComplexity.problems).toBeGreaterThan(typicalComplexity.problems);
    expect(heavyComplexity.contentBlocks).toBeGreaterThan(typicalComplexity.contentBlocks);
    expect(heavyComplexity.tableCells).toBeGreaterThan(typicalComplexity.tableCells);
    expect(heavyComplexity.subQuestions).toBeGreaterThan(0);
  });

  it("complex PDF fixtureへ数式・表・画像と実Assetを含める", () => {
    const fixture = createComplexPdfBenchmarkFixture(3);
    const serialized = JSON.stringify(fixture.worksheet);

    expect(WorksheetSchema.safeParse(fixture.worksheet).success).toBe(true);
    expect(fixture.worksheet.problems).toHaveLength(3);
    expect(fixture.worksheet.problems.slice(1).every((problem) => problem.pageBreakBefore)).toBe(true);
    expect(serialized).toContain("inlineMath");
    expect(serialized).toContain("blockMath");
    expect(serialized).toContain("imageRef");
    expect(fixture.worksheet.problems.every((problem) => problem.contents.some((content) => content.type === "table"))).toBe(true);
    expect(fixture.assets).toHaveLength(1);
    expect(fixture.assets[0]).toMatchObject({ mimeType: "image/png", width: 1, height: 1 });
  });
});
