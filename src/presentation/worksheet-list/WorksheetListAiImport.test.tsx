import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import { publishAiImportCompleted } from "../../application/ai-import/ai-import-events";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { database } from "../../infrastructure/indexeddb/database";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { WorksheetListScreen } from "./WorksheetListScreen";

/** 一覧同期テスト用のIndexedDBを空にする。 */
async function prepare(): Promise<void> {
  await database.worksheets.clear();
  await database.assets.clear();
}

/** 一覧同期テスト後のIndexedDBを空にする。 */
async function cleanup(): Promise<void> {
  await database.worksheets.clear();
  await database.assets.clear();
}
beforeEach(prepare);
afterEach(cleanup);

it("AI Import Eventを受信するとRepositoryを再読込して一覧とToastを更新する", /**
 * WebMCP層からReact状態を直接変更せず、保存済みデータへ表示を収束させる。
 * @returns 一覧とToastの同期確認完了
 */
async function reloadsAfterAiImport() {
  render(<MemoryRouter><WorksheetListScreen/></MemoryRouter>);
  await screen.findByText("まだプリントがありません");
  const worksheet = createWorksheet();
  worksheet.title = "AIから届いたプリント";
  worksheet.header.title = worksheet.title;
  await worksheetRepository.create({ worksheet, assets: [] });
  publishAiImportCompleted({
    type: "ai-import-completed",
    worksheetId: worksheet.id,
    title: worksheet.title,
    requestId: "request-list-sync",
  });
  expect(await screen.findByRole("button", { name: worksheet.title })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(`「${worksheet.title}」をAIから追加しました`);
});
