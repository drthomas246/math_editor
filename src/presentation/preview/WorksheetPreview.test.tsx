import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { plainTextToDocument } from "../../domain/worksheet/rich-text";
import { createAnswerAreaBlock, createGoalBlock, createProblem, createSubQuestionGroup, createTableBlock, createWorksheet, emptyDocument } from "../../domain/worksheet/worksheet.defaults";
import { WorksheetPreview } from "./WorksheetPreview";

describe("WorksheetPreview header", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("places the year, class, and number lines before their labels", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { container } = render(
      <WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()} />,
    );
    const fields = Array.from(container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-fields span"));

    expect(fields.map((field) => field.textContent)).toEqual(["年", "組", "番", "名前"]);
    expect(fields.slice(0, 3).map((field) => field.firstElementChild?.tagName)).toEqual(["I", "I", "I"]);
    expect(fields[3]?.lastElementChild?.tagName).toBe("I");
  });

  it("問題と例題の種類および独立した番号を表示する", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const worksheet = createWorksheet();
    worksheet.problems = [createProblem(), createProblem(), createProblem(), createProblem()];
    worksheet.problems[1]!.kind = "example";
    worksheet.problems[3]!.kind = "example";

    const { container } = render(
      <WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()} />,
    );
    const headings = Array.from(
      container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-problem-number"),
      (element) => element.textContent,
    );

    expect(headings).toEqual(["問1.", "例1.", "問2.", "例2."]);
  });

  it("プリント設定で選んだ小問番号形式を表示する", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const worksheet = createWorksheet();
    worksheet.pageSettings.subQuestionNumberFormat = "circled";
    worksheet.problems[0]!.contents = [createSubQuestionGroup()];

    const { container } = render(
      <WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()} />,
    );
    const numbers = Array.from(
      container.querySelectorAll<HTMLElement>(".preview-page-wrap .paper-subquestion b"),
      (element) => element.textContent,
    );

    expect(numbers).toEqual(["①", "②"]);
  });

  it("問題のみは黒だけ、解答付きは黒と赤およびめあてを表示する", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const worksheet = createWorksheet();
    const richText = worksheet.problems[0]!.contents[0]!;
    if (richText.type !== "richText") throw new Error("richTextを生成できませんでした");
    const answerTable = createTableBlock(1, 1);
    richText.document = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            { type: "text", text: "黒の本文" },
            { type: "text", text: "赤の解答", marks: [{ type: "answerColor" }] },
          ],
        },
        { type: "blockMath", attrs: { latex: "x=1", textSize: "normal", answerColor: true } },
        { type: "richTable", attrs: { id: answerTable.id, rows: answerTable.rows, columnWidthsPercent: answerTable.columnWidthsPercent, headerRow: answerTable.headerRow, answerColor: true } },
      ],
    };
    richText.answerDocument = emptyDocument();
    const answerArea = createAnswerAreaBlock();
    answerArea.answerArea.document = {
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: "黒の解答欄指示" },
          { type: "text", text: "赤の解答欄内容", marks: [{ type: "answerColor" }] },
        ],
      }],
    };
    answerArea.answerArea.answerDocument = emptyDocument();
    const goal = createGoalBlock();
    goal.document = plainTextToDocument("赤のめあて");
    worksheet.problems[0]!.contents.push(answerArea, goal);

    const questions = render(
      <WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()} />,
    );
    const questionPage = questions.container.querySelector<HTMLElement>(".preview-page-wrap");
    expect(questionPage).toHaveTextContent("黒の本文");
    expect(questionPage).toHaveTextContent("黒の解答欄指示");
    expect(questionPage).not.toHaveTextContent("赤の解答");
    expect(questionPage).not.toHaveTextContent("赤の解答欄内容");
    expect(questionPage).not.toHaveTextContent("赤のめあて");
    expect(questionPage?.querySelector(".math-formula")).not.toBeInTheDocument();
    expect(questionPage?.querySelector(".paper-table")).not.toBeInTheDocument();
    questions.unmount();

    const withAnswers = render(
      <WorksheetPreview worksheet={worksheet} mode="withAnswers" zoom={1} assetUrls={new Map()} />,
    );
    const answerPage = withAnswers.container.querySelector<HTMLElement>(".preview-page-wrap");
    expect(answerPage).toHaveTextContent("黒の本文");
    expect(answerPage).toHaveTextContent("赤の解答");
    expect(answerPage).toHaveTextContent("黒の解答欄指示");
    expect(answerPage).toHaveTextContent("赤の解答欄内容");
    expect(answerPage).toHaveTextContent("赤のめあて");
    expect(answerPage?.querySelector(".answer-color")).toHaveTextContent("赤の解答");
    expect(answerPage?.querySelector(".math-formula")).toBeInTheDocument();
    expect(answerPage?.querySelector(".paper-table")).toBeInTheDocument();
  });

  it("問題のみでも下線付き解答色テキストの幅と下線を残す", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const worksheet = createWorksheet();
    const richText = worksheet.problems[0]!.contents[0]!;
    if (richText.type !== "richText") throw new Error("richTextを生成できませんでした");
    richText.document = {
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: "問題文" },
          { type: "text", text: "下線上の解答", marks: [{ type: "underline" }, { type: "answerColor" }] },
        ],
      }],
    };
    richText.answerDocument = emptyDocument();

    const questions = render(
      <WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()} />,
    );
    const placeholder = questions.container.querySelector<HTMLElement>(".preview-page-wrap .paper-answer-placeholder");
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveTextContent("下線上の解答");
    expect(placeholder?.querySelector("u")).toHaveTextContent("下線上の解答");
    expect(placeholder?.querySelector(".answer-color")).not.toBeInTheDocument();
    questions.unmount();

    const withAnswers = render(
      <WorksheetPreview worksheet={worksheet} mode="withAnswers" zoom={1} assetUrls={new Map()} />,
    );
    expect(withAnswers.container.querySelector(".paper-answer-placeholder")).not.toBeInTheDocument();
    expect(withAnswers.container.querySelector(".preview-page-wrap .answer-color")).toHaveTextContent("下線上の解答");
  });

  it("同じWorksheetのまま問題＋解答へ切り替えても再度ページ分割する", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => window.clearTimeout(id)));
    const worksheet = createWorksheet();
    const view = render(
      <WorksheetPreview worksheet={worksheet} mode="questions" zoom={1} assetUrls={new Map()} />,
    );

    await waitFor(() => expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true"));
    view.rerender(
      <WorksheetPreview worksheet={worksheet} mode="questionsAndAnswers" zoom={1} assetUrls={new Map()} />,
    );

    await waitFor(() => expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true"));
    expect(view.container.querySelectorAll(".preview-page-wrap")).toHaveLength(2);
  });

  it("計測DOMを外す前にResizeObserverを停止する", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => window.clearTimeout(id)));
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() { disconnect(); }
    });

    const view = render(
      <WorksheetPreview worksheet={createWorksheet()} mode="questions" zoom={1} assetUrls={new Map()} />,
    );

    await waitFor(() => expect(view.container.querySelector(".preview-pages")).toHaveAttribute("data-pagination-ready", "true"));
    expect(disconnect).toHaveBeenCalled();
    expect(view.container.querySelector(".preview-measurement")).not.toBeInTheDocument();
  });
});
