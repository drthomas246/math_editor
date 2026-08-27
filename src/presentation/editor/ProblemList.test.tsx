import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProblem, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { useEditorStore } from "./editor-store";
import { ProblemList } from "./ProblemList";

const { renderCounts } = vi.hoisted(() => ({ renderCounts: new Map<string, number>() }));

vi.mock("./ProblemCard", () => ({
  ProblemCard: ({ problem }: { problem: { id: string } }) => {
    renderCounts.set(problem.id, (renderCounts.get(problem.id) ?? 0) + 1);
    return <article data-testid={`problem-${problem.id}`} />;
  },
}));

describe("ProblemList", () => {
  afterEach(() => {
    useEditorStore.getState().clear();
    renderCounts.clear();
  });

  it("本文更新では対象Problemだけを再描画する", () => {
    const worksheet = createWorksheet();
    worksheet.problems = Array.from({ length: 20 }, () => createProblem());
    useEditorStore.getState().initialize(worksheet);
    const targetProblem = worksheet.problems[10]!;

    const view = render(<ProblemList
      assetUrls={new Map()}
      onAddImage={vi.fn()}
      onUpdateImage={vi.fn()}
      onToast={vi.fn()}
    />);
    const initialCounts = new Map(renderCounts);

    act(() => useEditorStore.getState().mutate("本文を編集", (draft) => {
      const content = draft.problems[10]?.contents[0];
      if (content?.type === "richText") {
        content.document.content = [{
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [{ type: "text", text: "対象だけ更新" }],
        }];
      }
    }));

    for (const problem of worksheet.problems) {
      const expected = (initialCounts.get(problem.id) ?? 0) + (problem.id === targetProblem.id ? 1 : 0);
      expect(renderCounts.get(problem.id)).toBe(expected);
    }
    view.unmount();
  });
});
