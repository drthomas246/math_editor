import { beforeEach, describe, expect, it } from "vitest";

import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { setWorksheetTitle } from "../../domain/worksheet/worksheet.commands";
import { createSaveRequest, useEditorStore } from "./editor-store";

describe("editor store", () => {
  beforeEach(() => useEditorStore.getState().clear());

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
});
