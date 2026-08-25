import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ManualScreen } from "./ManualScreen";

function renderManual(path: string) {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/help/:chapterSlug" element={<ManualScreen />} />
        <Route path="/help/*" element={<ManualScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ManualScreen", () => {
  it("章、目次、前後移動を表示する", async () => {
    renderManual("/help/overview");
    expect(screen.getByRole("heading", { level: 1, name: "はじめに・動作環境" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /はじめに・動作環境/u })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: /次の章最初のプリントを作る/u }));
    expect(await screen.findByRole("heading", { level: 1, name: "最初のプリントを作る" })).toBeInTheDocument();
  });

  it("目次の11番目にAI Skillsの使い方を表示する", () => {
    renderManual("/help/ai-skills");
    expect(screen.getByRole("heading", { level: 1, name: "AI Skillsの使い方" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /11AI Skillsの使い方/u })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 2, name: "AIのSkillとは" })).toBeInTheDocument();
  });

  it("目次の13番目にバージョンとライセンスを表示する", () => {
    renderManual("/help/version-and-license");
    expect(screen.getByRole("heading", { level: 1, name: "バージョンとライセンス" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /13バージョンとライセンス/u })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("row", { name: "マニュアル 1.1" })).toBeInTheDocument();
    expect(screen.getByText("Copyright © 2026 Yamahara Yoshihiro")).toBeInTheDocument();
  });

  it("検索結果へ切り替え、選択後に章を表示する", async () => {
    renderManual("/help/overview");
    await userEvent.type(screen.getByRole("textbox", { name: "マニュアルを検索" }), "数式");
    expect(await screen.findByRole("heading", { level: 1, name: "「数式」の検索結果" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/件見つかりました/u);
    await userEvent.click((await screen.findAllByRole("link", { name: /数式/u }))[0]!);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "数式" })).toBeInTheDocument());
  });

  it("Escapeで検索を解除し、不明URLではNot Foundを表示する", async () => {
    renderManual("/help/unknown/path");
    expect(screen.getByRole("heading", { level: 1, name: "マニュアルのページが見つかりません" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "マニュアルを検索" });
    await userEvent.type(input, "存在しない語{Escape}");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });
});
