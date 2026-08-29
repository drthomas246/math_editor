import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProblem, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { setWorksheetTitle } from "../../domain/worksheet/worksheet.commands";
import { createSaveRequest, useEditorStore } from "./editor-store";

describe("editor store", () => {
  beforeEach(() => useEditorStore.getState().clear());
  afterEach(() => vi.useRealTimers());

  it("CommandをUndo/Redoしrevisionを更新する", () => {
    const source = createWorksheet();
    useEditorStore.getState().initialize(source);
    useEditorStore.getState().commit("題名を変更", setWorksheetTitle(source, "一次方程式"));
    expect(useEditorStore.getState().worksheet?.title).toBe("一次方程式");
    expect(useEditorStore.getState().saveStatus).toBe("dirty");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().worksheet?.title).toBe("無題のプリント");
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().worksheet?.title).toBe("一次方程式");
    expect(useEditorStore.getState().revision).toBe(3);
  });

  it("別プリントの古い保存完了・失敗を現在の保存状態へ反映しない", () => {
    const worksheetA = createWorksheet();
    useEditorStore.getState().initialize(worksheetA);
    useEditorStore.getState().commit("Aを編集", setWorksheetTitle(worksheetA, "プリントA"));
    const requestA = createSaveRequest(useEditorStore.getState());
    expect(requestA).not.toBeNull();

    const worksheetB = createWorksheet();
    useEditorStore.getState().initialize(worksheetB);
    useEditorStore.getState().commit("Bを編集", setWorksheetTitle(worksheetB, "プリントB"));

    useEditorStore.getState().markSaved(requestA!);
    expect(useEditorStore.getState()).toMatchObject({
      worksheet: { id: worksheetB.id },
      saveStatus: "dirty",
      savedRevision: 0,
    });

    useEditorStore.getState().markFailed(requestA!);
    expect(useEditorStore.getState().saveStatus).toBe("dirty");
  });

  it("同じプリントを開き直した後は前セッションの保存通知を無視する", () => {
    const worksheet = createWorksheet();
    useEditorStore.getState().initialize(worksheet);
    useEditorStore.getState().commit("編集", setWorksheetTitle(worksheet, "変更前セッション"));
    const staleRequest = createSaveRequest(useEditorStore.getState());
    expect(staleRequest).not.toBeNull();

    useEditorStore.getState().initialize(worksheet);
    useEditorStore.getState().commit("再編集", setWorksheetTitle(worksheet, "現在のセッション"));
    useEditorStore.getState().markSaving(staleRequest!);
    useEditorStore.getState().markSaved(staleRequest!);
    useEditorStore.getState().markFailed(staleRequest!);

    expect(useEditorStore.getState().saveStatus).toBe("dirty");
  });

  it("現在の保存要求だけを保存済みへ反映する", () => {
    const worksheet = createWorksheet();
    useEditorStore.getState().initialize(worksheet);
    useEditorStore.getState().commit("編集", setWorksheetTitle(worksheet, "保存対象"));
    const request = createSaveRequest(useEditorStore.getState());
    expect(request).not.toBeNull();

    useEditorStore.getState().markSaving(request!);
    expect(useEditorStore.getState().saveStatus).toBe("saving");
    useEditorStore.getState().markSaved(request!);
    expect(useEditorStore.getState()).toMatchObject({ saveStatus: "saved", savedRevision: 1 });
  });

  it("部分更新では対象Problemだけをコピーして他のProblemを共有する", () => {
    const worksheet = createWorksheet();
    worksheet.problems = Array.from({ length: 100 }, createProblem);
    const targetId = worksheet.problems[50]!.id;
    useEditorStore.getState().initialize(worksheet);

    useEditorStore.getState().mutate("本文を編集", (draft) => {
      const problem = draft.problems.find((item) => item.id === targetId);
      const content = problem?.contents[0];
      if (content?.type !== "richText") return;
      content.document.content = [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text: "更新" }] }];
    }, { historyGroup: `richText:${targetId}` });

    const updated = useEditorStore.getState().worksheet!;
    expect(updated).not.toBe(worksheet);
    expect(updated.problems[0]).toBe(worksheet.problems[0]);
    expect(updated.problems[50]).not.toBe(worksheet.problems[50]);
    expect(updated.problems[99]).toBe(worksheet.problems[99]);
    expect(useEditorStore.getState().undoStack[0]?.patches.some((patch) => patch.path[0] === "problems" && patch.path[1] === 50)).toBe(true);
  });

  it("同じRichTextへの連続入力を1件のUndo履歴へまとめる", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T00:00:00.000Z"));
    const worksheet = createWorksheet();
    const problemId = worksheet.problems[0]!.id;
    const contentId = worksheet.problems[0]!.contents[0]!.id;
    useEditorStore.getState().initialize(worksheet);
    const typeText = (text: string) => useEditorStore.getState().mutate("本文を編集", (draft) => {
      const problem = draft.problems.find((item) => item.id === problemId);
      const content = problem?.contents.find((item) => item.id === contentId);
      if (content?.type !== "richText") return;
      content.document.content = [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text }] }];
    }, { historyGroup: `richText:${problemId}:${contentId}` });

    typeText("a");
    vi.advanceTimersByTime(400);
    typeText("ab");
    vi.advanceTimersByTime(400);
    typeText("abc");

    expect(useEditorStore.getState()).toMatchObject({ revision: 3, undoStack: [{ label: "本文を編集" }] });
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().worksheet!.problems[0]!.contents[0];
    const undoneBlock = undone?.type === "richText" ? undone.document.content[0] : null;
    expect(undoneBlock?.type === "paragraph" ? undoneBlock.content : null).toEqual([]);
    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().worksheet!.problems[0]!.contents[0];
    const redoneBlock = redone?.type === "richText" ? redone.document.content[0] : null;
    expect(redoneBlock?.type === "paragraph" ? redoneBlock.content[0] : null).toMatchObject({ text: "abc" });
  });

  it("入力間隔または編集対象が変わると別のUndo履歴にする", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T00:00:00.000Z"));
    const worksheet = createWorksheet();
    useEditorStore.getState().initialize(worksheet);
    const mutateTitle = (value: string, historyGroup: string) => useEditorStore.getState().mutate("題名を変更", (draft) => {
      draft.title = value;
      draft.header.title = value;
    }, { historyGroup });

    mutateTitle("A", "title:a");
    mutateTitle("B", "title:b");
    vi.advanceTimersByTime(1_001);
    mutateTitle("C", "title:b");

    expect(useEditorStore.getState().undoStack).toHaveLength(3);
  });

  it("実データが変わらない部分更新では履歴とrevisionを増やさない", () => {
    const worksheet = createWorksheet();
    const sourceContent = worksheet.problems[0]?.contents[0];
    const sameDocument = sourceContent?.type === "richText" ? structuredClone(sourceContent.document) : null;
    useEditorStore.getState().initialize(worksheet);
    useEditorStore.getState().mutate("同じ文書を設定", (draft) => {
      const content = draft.problems[0]?.contents[0];
      if (content?.type === "richText" && sameDocument) content.document = sameDocument;
    }, { historyGroup: "noop" });
    expect(useEditorStore.getState()).toMatchObject({ worksheet, revision: 0, undoStack: [] });
  });
});
