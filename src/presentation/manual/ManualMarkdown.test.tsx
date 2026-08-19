import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ManualMarkdown } from "./ManualMarkdown";

const renderMarkdown = (markdown: string) => render(<MemoryRouter><ManualMarkdown markdown={markdown} /></MemoryRouter>);

describe("ManualMarkdown", () => {
  it("GFM表、タスクリスト、脚注を表示する", () => {
    const view = renderMarkdown("| 項目 | 値 |\n| --- | --- |\n| 用紙 | A4 |\n\n- [x] 確認済み\n\n脚注[^1]\n\n[^1]: 補足です");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(view.container).toHaveTextContent("補足です");
  });

  it("HTMLと危険URLを無効化し、外部リンクを安全な別タブにする", () => {
    const view = renderMarkdown("<script>alert(1)</script>\n\n[危険](javascript:alert(1)) [外部](https://example.com)");
    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.queryByRole("link", { name: "危険" })).toBeNull();
    expect(screen.getByRole("link", { name: "外部" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "外部" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("内部リンク、callout、欠落画像を表示する", () => {
    renderMarkdown("> **重要**\n>\n> 保存してください。\n\n[次へ](/help/formulas)\n\n![説明](manual-assets/missing.png)");
    expect(screen.getByRole("link", { name: "次へ" })).toHaveAttribute("href", "/help/formulas");
    expect(screen.getByText("保存してください。").closest("blockquote")).toHaveClass("manual-callout-important");
    expect(screen.getAllByText("説明").length).toBeGreaterThan(0);
  });
});
