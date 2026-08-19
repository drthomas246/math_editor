import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { database } from "../../infrastructure/indexeddb/database";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { WorksheetListScreen } from "./WorksheetListScreen";

beforeEach(async () => {
  await database.worksheets.clear();
  await database.assets.clear();
});

describe("WorksheetListScreen", () => {
  it("個別JSONを利用者が直接保存できるリンクとして準備する", async () => {
    const worksheet = createWorksheet();
    worksheet.title = "JSON出力テスト";
    worksheet.header.title = worksheet.title;
    await worksheetRepository.create({ worksheet, assets: [] });

    render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "JSON出力テストのメニュー" }));
    await userEvent.click(screen.getByRole("button", { name: "JSONエクスポート" }));

    const download = await screen.findByRole("link", { name: "JSONをダウンロード" });
    expect(download).toHaveAttribute("href", "blob:test");
    expect(download).toHaveAttribute("download", expect.stringMatching(/^JSON出力テスト_\d{8}-\d{4}\.json$/u));
  });

  it("全体バックアップを利用者が直接保存できるリンクとして準備する", async () => {
    await worksheetRepository.create({ worksheet: createWorksheet(), assets: [] });

    render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "設定・バックアップ" }));
    await userEvent.click(screen.getByRole("button", { name: "全体をエクスポート" }));

    const download = await screen.findByRole("link", { name: "JSONをダウンロード" });
    expect(download).toHaveAttribute("href", "blob:test");
    expect(download).toHaveAttribute("download", expect.stringMatching(/^math-worksheet-backup-\d{8}-\d{4}\.json$/u));
  });

  it("プリントの操作メニューを外側の操作で閉じる", async () => {
    const worksheet = createWorksheet();
    worksheet.title = "外側クリックテスト";
    worksheet.header.title = worksheet.title;
    await worksheetRepository.create({ worksheet, assets: [] });

    render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "外側クリックテストのメニュー" }));
    expect(screen.getByRole("button", { name: "JSONエクスポート" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("heading", { name: "プリント" }));
    expect(screen.queryByRole("button", { name: "JSONエクスポート" })).not.toBeInTheDocument();
  });

  it("空状態と主要操作を表示する", async () => {
    render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
    expect(await screen.findByText("まだプリントがありません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /使い方/u })).toHaveAttribute("href", "/help/overview");
    expect(screen.getByRole("link", { name: /使い方/u })).toHaveAttribute("target", "_blank");
    expect(screen.getAllByRole("button", { name: /新しいプリント/u }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /インポート/u }).length).toBeGreaterThan(0);
  });

  it("正規化した題名検索で一覧を絞り込む", async () => {
    const worksheet = createWorksheet();
    worksheet.title = "１年Ａ組"; worksheet.header.title = worksheet.title;
    await worksheetRepository.create({ worksheet, assets: [] });
    render(<MemoryRouter><WorksheetListScreen /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "１年Ａ組" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "題名で検索" }), "1年a組");
    await waitFor(() => expect(screen.getByRole("button", { name: "１年Ａ組" })).toBeInTheDocument());
    await userEvent.clear(screen.getByRole("textbox", { name: "題名で検索" }));
    await userEvent.type(screen.getByRole("textbox", { name: "題名で検索" }), "ぷりんと");
    expect(await screen.findByText(/一致するプリントはありません/u)).toBeInTheDocument();
  });
});
