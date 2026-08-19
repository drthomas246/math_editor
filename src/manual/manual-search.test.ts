import { describe, expect, it } from "vitest";

import { markdownToPlainTextBlocks, normalizeManualSearchText, searchManual } from "./manual-search";

describe("manual search", () => {
  it("全角ASCII、空白、英字、大文字小文字を正規化する", () => {
    expect(normalizeManualSearchText("  ＰＤＦ　ＡＢＣ  ")).toBe("pdf abc");
    expect(normalizeManualSearchText("ガイド")).toBe("ガイド");
  });

  it("Markdownの表示文字を残してURLと記号を除く", () => {
    const blocks = markdownToPlainTextBlocks("## 表\n\n![図](manual-assets/a.png) [説明](/help/overview)\n\n| 項目 | 値 |\n| --- | --- |\n| 用紙 | A4 |");
    expect(blocks.join(" ")).toContain("図 説明");
    expect(blocks.join(" ")).toContain("用紙 A4");
    expect(blocks.join(" ")).not.toContain("manual-assets");
    expect(blocks.join(" ")).not.toContain("/help/overview");
  });

  it("題名、キーワード、本文をAND部分一致で検索する", () => {
    expect(searchManual("数式")[0]?.slug).toBe("formulas");
    expect(searchManual("JSON 完全削除").map((result) => result.slug)).toContain("backup-and-trash");
    expect(searchManual("MathLive ゴミ箱")).toEqual([]);
    expect(searchManual("   ")).toEqual([]);
  });

  it("同じ検索語を重複加点せず、抜粋を120文字以内にする", () => {
    expect(searchManual("MathLive MathLive")).toEqual(searchManual("MathLive"));
    expect(searchManual("バックアップ").every((result) => result.excerpt.length <= 120)).toBe(true);
  });
});
