import { act, fireEvent, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { MathWorksheetDatabase } from "../../infrastructure/indexeddb/database";
import { DexieWorksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { createSaveRequest, useEditorStore } from "./editor-store";
import { EditorScreen } from "./EditorScreen";

vi.mock("./ProblemList", () => ({
  ProblemList: () => <section data-testid="problem-card" />,
}));

vi.mock("../preview/WorksheetPreview", () => ({
  WorksheetPreview: () => <div data-testid="worksheet-preview" />,
}));

vi.mock("../dialogs/EditorDialogs", () => ({
  PdfDialog: () => <div role="dialog" aria-label="PDF出力" />,
  WorksheetSettingsDialog: () => <div role="dialog" aria-label="プリント設定" />,
}));

const TEST_TIMEOUT_MS = 4_000;

let database: MathWorksheetDatabase;
let repository: DexieWorksheetRepository;
let worksheet: Worksheet;
let activeViews: RenderResult[];

beforeEach(async () => {
  database = new MathWorksheetDatabase(`editor-integration-${crypto.randomUUID()}`);
  repository = new DexieWorksheetRepository(database);
  worksheet = createWorksheet();
  await repository.create({ worksheet, assets: [] });
  useEditorStore.getState().clear();
  activeViews = [];
});

afterEach(async () => {
  activeViews.forEach((view) => view.unmount());
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  useEditorStore.getState().clear();
  vi.restoreAllMocks();
  await database.delete();
});

describe("EditorScreen 離脱・保存統合", () => {
  it("dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する", async () => {
    renderEditor();
    const titleInput = await editorTitleInput();

    fireEvent.change(titleInput, { target: { value: "未保存の変更" } });
    expect(screen.getByText("未保存")).toBeInTheDocument();
    await waitFor(() => expect(dispatchBeforeUnload()).toBe(true));

    const request = createSaveRequest(useEditorStore.getState());
    expect(request).not.toBeNull();
    act(() => useEditorStore.getState().markSaving(request!));
    expect(screen.getByText("保存中…")).toBeInTheDocument();
    await waitFor(() => expect(dispatchBeforeUnload()).toBe(true));
  });

  it("savedではbeforeunloadを阻止しない", async () => {
    renderEditor();
    await editorTitleInput();

    expect(screen.getByText("保存済み")).toBeInTheDocument();
    expect(dispatchBeforeUnload()).toBe(false);
  });

  it("通常プレビューは問題のみと解答付きだけを選べる", async () => {
    renderEditor();
    await editorTitleInput();

    const mode = screen.getByRole("combobox", { name: "プレビューモード" }) as HTMLSelectElement;
    expect(Array.from(mode.options, (option) => option.textContent)).toEqual(["問題のみ", "解答付き"]);
  });

  it("編集後にdebounce保存を行いIndexedDBと表示をsavedへ更新する", async () => {
    const save = vi.spyOn(repository, "save");
    renderEditor();
    const titleInput = await editorTitleInput();

    fireEvent.change(titleInput, { target: { value: "自動保存されたプリント" } });
    expect(screen.getByText("未保存")).toBeInTheDocument();

    await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: "自動保存されたプリント" }),
      {
        pruneUnreferencedAssets: true,
        retainedAssetIds: new Set(),
      },
    );
    expect((await repository.get(worksheet.id))?.worksheet.title).toBe("自動保存されたプリント");
  });

  it("Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする", async () => {
    renderEditor();
    await editorTitleInput();

    const originalAsset = createAsset(worksheet, 1);
    const source = structuredClone(worksheet);
    source.problems[0]!.contents = [{
      id: crypto.randomUUID(),
      type: "image",
      assetId: originalAsset.id,
      alt: "差し替え前",
      placement: "block",
      widthPercent: 50,
    }];
    await repository.putAsset(originalAsset, source);
    act(() => useEditorStore.getState().commit("画像を挿入", source));

    const replacementAsset = createAsset(worksheet, 2);
    const replacement = structuredClone(source);
    const image = replacement.problems[0]!.contents[0]!;
    if (image.type !== "image") throw new Error("テスト用画像がありません");
    image.assetId = replacementAsset.id;
    await repository.putAsset(replacementAsset, replacement);
    const save = vi.spyOn(repository, "save");

    act(() => useEditorStore.getState().commit("画像を差し替え", replacement));

    expect(screen.getByText("未保存")).toBeInTheDocument();
    await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
    expect(save.mock.calls.at(-1)?.[1]).toEqual({
      pruneUnreferencedAssets: true,
      retainedAssetIds: new Set([replacementAsset.id, originalAsset.id]),
    });
    expect(new Set((await database.assets.toArray()).map((asset) => asset.id))).toEqual(new Set([
      originalAsset.id,
      replacementAsset.id,
    ]));

    act(() => {
      for (let index = 0; index < 100; index += 1) {
        useEditorStore.getState().mutate(`履歴を追加 ${index}`, (draft) => {
          draft.title = `履歴 ${index}`;
          draft.header.title = draft.title;
        });
      }
    });

    expect(screen.getByText("未保存")).toBeInTheDocument();
    await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
    await waitFor(async () => {
      expect((await database.assets.toArray()).map((asset) => asset.id)).toEqual([replacementAsset.id]);
    });
    expect(save.mock.calls.at(-1)?.[1]).toEqual({
      pruneUnreferencedAssets: true,
      retainedAssetIds: new Set([replacementAsset.id]),
    });
  });

  it("保存失敗をfailedで表示し、再試行でIndexedDBへ保存する", async () => {
    const actualSave = repository.save.bind(repository);
    const save = vi.spyOn(repository, "save").mockImplementation(actualSave);
    save.mockRejectedValueOnce(new Error("quota exceeded"));
    renderEditor();
    const titleInput = await editorTitleInput();

    fireEvent.change(titleInput, { target: { value: "再試行対象" } });
    await screen.findByText("保存できませんでした", {}, { timeout: TEST_TIMEOUT_MS });
    expect(dispatchBeforeUnload()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
    expect(save).toHaveBeenCalledTimes(2);
    expect((await repository.get(worksheet.id))?.worksheet.title).toBe("再試行対象");
  });

  it("一覧へ戻る前にGC付き保存の完了を待つ", async () => {
    const actualSave = repository.save.bind(repository);
    let releaseSave: (() => void) | undefined;
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
    let firstSave = true;
    const save = vi.spyOn(repository, "save").mockImplementation(async (value, options) => {
      if (firstSave) {
        firstSave = false;
        await saveGate;
      }
      await actualSave(value, options);
    });
    renderEditor();
    const titleInput = await editorTitleInput();

    fireEvent.change(titleInput, { target: { value: "離脱前保存" } });
    fireEvent.click(screen.getAllByRole("button", { name: "一覧" })[0]!);

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("一覧画面")).not.toBeInTheDocument();
    expect(save.mock.calls[0]?.[1]).toEqual({ pruneUnreferencedAssets: true });

    releaseSave!();

    await screen.findByText("一覧画面", {}, { timeout: TEST_TIMEOUT_MS });
    expect((await repository.get(worksheet.id))?.worksheet.title).toBe("離脱前保存");
  });

  it("ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する", async () => {
    const actualSave = repository.save.bind(repository);
    const save = vi.spyOn(repository, "save").mockImplementation(actualSave);
    save.mockRejectedValueOnce(new Error("quota exceeded"));
    const editorPath = `/worksheets/${worksheet.id}`;
    const view = renderEditor(["/", editorPath], 1);
    const titleInput = await editorTitleInput();
    fireEvent.change(titleInput, { target: { value: "戻る失敗でも保持" } });

    await act(async () => { await view.router.navigate(-1); });

    await screen.findByText("保存できませんでした", {}, { timeout: TEST_TIMEOUT_MS });
    expect(view.router.state.location.pathname).toBe(editorPath);
    expect(screen.getByRole("textbox", { name: "プリント題名" })).toHaveValue("戻る失敗でも保持");
    expect(useEditorStore.getState()).toMatchObject({
      worksheet: { title: "戻る失敗でも保持" },
      saveStatus: "failed",
    });
    expect((await repository.get(worksheet.id))?.worksheet.title).not.toBe("戻る失敗でも保持");

    await act(async () => { await view.router.navigate(-1); });

    await screen.findByText("一覧画面", {}, { timeout: TEST_TIMEOUT_MS });
    expect(view.router.state.location.pathname).toBe("/");
    expect(save).toHaveBeenCalledTimes(2);
    expect((await repository.get(worksheet.id))?.worksheet.title).toBe("戻る失敗でも保持");
  });
});

type EditorRenderResult = RenderResult & { router: ReturnType<typeof createMemoryRouter> };

function renderEditor(
  initialEntries: string[] = [`/worksheets/${worksheet.id}`],
  initialIndex?: number,
): EditorRenderResult {
  const router = createMemoryRouter([
    { path: "/worksheets/:worksheetId", element: <EditorScreen repository={repository} /> },
    { path: "/", element: <main>一覧画面</main> },
  ], {
    initialEntries,
    ...(initialIndex === undefined ? {} : { initialIndex }),
  });
  const view = Object.assign(render(<RouterProvider router={router} />), { router });
  activeViews.push(view);
  return view;
}

async function editorTitleInput(): Promise<HTMLInputElement> {
  return screen.findByRole("textbox", { name: "プリント題名" }, { timeout: TEST_TIMEOUT_MS }) as Promise<HTMLInputElement>;
}

function dispatchBeforeUnload(): boolean {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function createAsset(owner: Worksheet, byte: number): AssetRecord {
  return {
    id: crypto.randomUUID(),
    worksheetId: owner.id,
    mimeType: "image/png",
    blob: new Blob([new Uint8Array([byte])], { type: "image/png" }),
    width: 1,
    height: 1,
    createdAt: new Date().toISOString(),
  };
}
