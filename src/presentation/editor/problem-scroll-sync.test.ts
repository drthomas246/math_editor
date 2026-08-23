import { describe, expect, it } from "vitest";

import { interpolateScrollPosition, syncProblemScroll } from "./problem-scroll-sync";

describe("problem scroll sync", () => {
  it("問題アンカーの間を補間する", () => {
    expect(interpolateScrollPosition(250, [
      { source: 0, target: 0 },
      { source: 100, target: 200 },
      { source: 400, target: 800 },
    ])).toBe(500);
  });

  it("編集側の問題位置を同じプレビュー問題位置へ合わせる", () => {
    const editor = createScrollContainer(1_000, 200);
    const preview = createScrollContainer(1_600, 300);
    addProblemAnchor(editor, "first", "editor", 100);
    addProblemAnchor(editor, "second", "editor", 400);
    addProblemAnchor(editor, "third", "editor", 700);
    addProblemAnchor(preview, "first", "preview", 200, "questions");
    addProblemAnchor(preview, "second", "preview", 800, "questions");
    addProblemAnchor(preview, "third", "preview", 1_200, "questions");

    editor.scrollTop = 400;

    expect(syncProblemScroll(editor, preview, "questions")).toBe(800);
    expect(preview.scrollTop).toBe(800);
  });

  it("解答付きでは解答用プレビューのアンカーを使う", () => {
    const editor = createScrollContainer(800, 200);
    const preview = createScrollContainer(2_000, 300);
    addProblemAnchor(editor, "second", "editor", 300);
    addProblemAnchor(preview, "second", "preview", 500, "questions");
    addProblemAnchor(preview, "second", "preview", 1_400, "withAnswers");

    editor.scrollTop = 300;

    expect(syncProblemScroll(editor, preview, "withAnswers")).toBe(1_400);
  });
});

function createScrollContainer(scrollHeight: number, clientHeight: number): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  });
  element.getBoundingClientRect = () => ({
    top: 10,
    bottom: 10 + clientHeight,
    left: 0,
    right: 100,
    width: 100,
    height: clientHeight,
    x: 0,
    y: 10,
    toJSON: () => undefined,
  });
  document.body.append(element);
  return element;
}

function addProblemAnchor(
  container: HTMLElement,
  problemId: string,
  side: "editor" | "preview",
  offset: number,
  section?: "questions" | "withAnswers",
) {
  const element = document.createElement("div");
  if (side === "editor") element.dataset.editorProblemId = problemId;
  else {
    element.dataset.previewProblemId = problemId;
    if (section) element.dataset.previewSection = section;
  }
  element.getBoundingClientRect = () => ({
    top: 10 + offset - container.scrollTop,
    bottom: 20 + offset - container.scrollTop,
    left: 0,
    right: 100,
    width: 100,
    height: 10,
    x: 0,
    y: 10 + offset - container.scrollTop,
    toJSON: () => undefined,
  });
  container.append(element);
}
