import { beforeEach, describe, expect, it } from "vitest";

import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { setWorksheetTitle } from "../../domain/worksheet/worksheet.commands";
import { useEditorStore } from "./editor-store";

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
});
