import { fireEvent, render, within } from "@testing-library/react";
import { produce } from "immer";
import { describe, expect, it, vi } from "vitest";

import { createAnswerAreaBlock, createBoxBlock, createRichTextBlock, createSubQuestionGroup, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import "../../styles.css";
import { ProblemCard } from "./ProblemCard";

describe("ProblemCard", () => {
  it("静的な内容と教師用の解説をキーボードで選択でき、装飾グリップを操作要素にしない", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const secondContent = createRichTextBlock();
    problem.contents.push(secondContent);
    const onSelect = vi.fn();
    const onSelectContent = vi.fn();
    const view = render(
      <ProblemCard
        worksheet={worksheet}
        problem={problem}
        index={0}
        displayNumber="1."
        selected
        selectedContentId={problem.contents[0]!.id}
        onSelect={onSelect}
        onSelectContent={onSelectContent}
        onCommit={vi.fn()}
        onMutate={vi.fn()}
        onAddImage={vi.fn()}
        onUpdateImage={vi.fn()}
        assetUrls={new Map()}
        onToast={vi.fn()}
      />,
    );

    const staticContent = view.getByRole("button", { name: "内容を編集" });
    fireEvent.keyDown(staticContent, { key: "Enter" });
    expect(onSelectContent).toHaveBeenLastCalledWith(secondContent.id);

    fireEvent.click(view.getByRole("button", { name: /教師用の解説/u }));
    onSelect.mockClear();
    onSelectContent.mockClear();
    const staticSolution = view.getByRole("button", { name: "教師用の解説を編集" });
    fireEvent.keyDown(staticSolution, { key: " " });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelectContent).toHaveBeenCalledWith(null);

    expect(view.queryByRole("button", { name: "問題を並べ替え" })).not.toBeInTheDocument();
    expect(view.container.querySelector(".drag-handle")).toHaveAttribute("aria-hidden", "true");
  });

  it("選択中の内容または教師用解説だけにTipTapエディターを生成する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const secondContent = createRichTextBlock();
    problem.contents.push(secondContent);
    const onSelect = vi.fn();
    const onSelectContent = vi.fn();
    const commonProps = {
      worksheet,
      problem,
      index: 0,
      displayNumber: "1.",
      onSelect,
      onSelectContent,
      onCommit: vi.fn(),
      onMutate: vi.fn(),
      onAddImage: vi.fn(),
      onUpdateImage: vi.fn(),
      assetUrls: new Map(),
      onToast: vi.fn(),
    };

    const view = render(
      <ProblemCard
        {...commonProps}
        selected
        selectedContentId={problem.contents[0]!.id}
      />,
    );

    expect(view.container.querySelectorAll(".ProseMirror")).toHaveLength(1);
    expect(view.container.querySelectorAll(".content-card-static")).toHaveLength(1);

    fireEvent.click(view.getByRole("button", { name: /教師用の解説/u }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelectContent).toHaveBeenLastCalledWith(null);
    expect(view.container.querySelectorAll(".ProseMirror")).toHaveLength(1);
    expect(view.container.querySelector(".solution-editor-static")).toBeInTheDocument();

    view.rerender(
      <ProblemCard
        {...commonProps}
        selected
        selectedContentId={null}
      />,
    );

    expect(view.container.querySelectorAll(".ProseMirror")).toHaveLength(1);
    expect(view.container.querySelectorAll(".content-card-static")).toHaveLength(2);
    expect(view.container.querySelector(".solution-editor-static")).not.toBeInTheDocument();

    view.rerender(
      <ProblemCard
        {...commonProps}
        selected={false}
        selectedContentId={null}
      />,
    );

    expect(view.container.querySelectorAll(".ProseMirror")).toHaveLength(0);
    expect(view.container.querySelectorAll(".content-card-static")).toHaveLength(2);
    expect(view.container.querySelector(".solution-editor-static")).toBeInTheDocument();
  });

  it("文字入力をWorksheet全体Commandではなく部分Immer更新へ渡す", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const box = createBoxBlock();
    problem.contents = [box];
    const onMutate = vi.fn();
    const view = render(
      <ProblemCard
        worksheet={worksheet}
        problem={problem}
        index={0}
        displayNumber="1."
        selected
        selectedContentId={box.id}
        onSelect={vi.fn()}
        onSelectContent={vi.fn()}
        onCommit={vi.fn()}
        onMutate={onMutate}
        onAddImage={vi.fn()}
        onUpdateImage={vi.fn()}
        assetUrls={new Map()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.change(view.getByPlaceholderText("題名（空欄可）"), { target: { value: "重要" } });

    expect(onMutate).toHaveBeenCalledWith(
      "囲み枠の題名",
      expect.any(Function),
      { historyGroup: `text:${problem.id}:content:${box.id}:title` },
    );
    const mutation = onMutate.mock.calls.find(([label]) => label === "囲み枠の題名")?.[1];
    const updated = produce(worksheet, mutation);
    expect(updated.problems[0]?.contents[0]).toMatchObject({ type: "box", title: "重要" });
    expect(updated.problems[0]).not.toBe(worksheet.problems[0]);
  });

  it("カード見出しで問題から例題へ変更する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const onCommit = vi.fn();
    const view = render(
      <ProblemCard
        worksheet={worksheet}
        problem={problem}
        index={0}
        displayNumber="1."
        selected
        selectedContentId={problem.contents[0]!.id}
        onSelect={vi.fn()}
        onSelectContent={vi.fn()}
        onCommit={onCommit}
        onMutate={vi.fn()}
        onAddImage={vi.fn()}
        onUpdateImage={vi.fn()}
        assetUrls={new Map()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.change(view.getByRole("combobox", { name: "問題の種類" }), { target: { value: "example" } });

    expect(onCommit).toHaveBeenCalledWith(
      "問題の種類を変更",
      expect.objectContaining({ problems: [expect.objectContaining({ kind: "example" })] }),
    );
  });

  it("内容の追加から画像と表を除き、選択中の内容のツールバーには残す", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const group = createSubQuestionGroup();
    group.items = [group.items[0]!];
    group.items[0]!.answerArea = null;
    problem.contents.push(group);

    const view = render(
      <ProblemCard
        worksheet={worksheet}
        problem={problem}
        index={0}
        displayNumber="1."
        selected
        selectedContentId={problem.contents[0]!.id}
        onSelect={vi.fn()}
        onSelectContent={vi.fn()}
        onCommit={vi.fn()}
        onMutate={vi.fn()}
        onAddImage={vi.fn()}
        onUpdateImage={vi.fn()}
        assetUrls={new Map()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "内容を追加" }));

    const addContentMenu = view.container.querySelector<HTMLElement>(".add-content-popover");
    expect(addContentMenu).not.toBeNull();
    expect(within(addContentMenu!).queryByRole("button", { name: "画像" })).not.toBeInTheDocument();
    expect(within(addContentMenu!).queryByRole("button", { name: "表" })).not.toBeInTheDocument();
    expect(within(addContentMenu!).getByRole("button", { name: "めあて" })).toBeInTheDocument();
    expect(view.getAllByRole("button", { name: "画像" })).toHaveLength(1);
    expect(view.getAllByRole("button", { name: "表" })).toHaveLength(1);
    expect(view.container.querySelectorAll(".content-card-static")).toHaveLength(1);
  });

  it("問題メニューと内容追加メニューを外側の操作で閉じる", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const view = render(
      <ProblemCard
        worksheet={worksheet}
        problem={problem}
        index={0}
        displayNumber="1."
        selected
        selectedContentId={problem.contents[0]!.id}
        onSelect={vi.fn()}
        onSelectContent={vi.fn()}
        onCommit={vi.fn()}
        onMutate={vi.fn()}
        onAddImage={vi.fn()}
        onUpdateImage={vi.fn()}
        assetUrls={new Map()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "問題設定" }));
    expect(view.getByRole("button", { name: "問題を複製" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(view.queryByRole("button", { name: "問題を複製" })).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "内容を追加" }));
    expect(view.container.querySelector(".add-content-popover")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(view.container.querySelector(".add-content-popover")).not.toBeInTheDocument();
  });

  it("生徒用解答欄の1つの文章欄で問題色・解答色を選んで数式と表を入力できる", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const answerArea = createAnswerAreaBlock();
    problem.contents = [answerArea];
    const onCommit = vi.fn();
    const view = render(
      <ProblemCard
        worksheet={worksheet}
        problem={problem}
        index={0}
        displayNumber="1."
        selected
        selectedContentId={answerArea.id}
        onSelect={vi.fn()}
        onSelectContent={vi.fn()}
        onCommit={onCommit}
        onMutate={vi.fn()}
        onAddImage={vi.fn()}
        onUpdateImage={vi.fn()}
        assetUrls={new Map()}
        onToast={vi.fn()}
      />,
    );

    const areaEditor = view.container.querySelector<HTMLElement>(".answer-area-editor");
    expect(areaEditor).not.toBeNull();
    const colorSelector = within(areaEditor!).getByRole("combobox", { name: "入力色" });
    expect(colorSelector).toHaveValue("problem");
    fireEvent.change(colorSelector, { target: { value: "answer" } });
    expect(colorSelector).toHaveValue("answer");

    fireEvent.click(within(areaEditor!).getByRole("button", { name: "数式" }));
    expect(view.getByRole("dialog", { name: "数式を入力" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "キャンセル" }));

    fireEvent.click(within(areaEditor!).getByRole("button", { name: "表" }));
    const tableDialog = view.getByRole("dialog", { name: "表を挿入" });
    fireEvent.click(within(tableDialog).getByRole("button", { name: "挿入" }));

    const insertedWorksheet = onCommit.mock.calls.find(([label]) => label === "表を挿入")?.[1];
    const insertedArea = insertedWorksheet?.problems[0]?.contents[0];
    expect(insertedArea?.type === "answerArea" ? insertedArea.answerArea.document.content.at(-1) : null).toMatchObject({
      type: "richTable",
      attrs: { answerColor: true },
    });
  });

  it("教師用の解説に数式、画像、表の挿入操作を表示する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const onCommit = vi.fn();

    const commonProps = {
      worksheet,
      problem,
      index: 0,
      displayNumber: "1.",
      selected: true,
      onSelect: vi.fn(),
      onSelectContent: vi.fn(),
      onCommit,
      onMutate: vi.fn(),
      onAddImage: vi.fn(),
      onUpdateImage: vi.fn(),
      assetUrls: new Map(),
      onToast: vi.fn(),
    };
    const view = render(
      <ProblemCard
        {...commonProps}
        selectedContentId={problem.contents[0]!.id}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /教師用の解説/u }));
    view.rerender(<ProblemCard {...commonProps} selectedContentId={null} />);

    const solutionEditor = view.container.querySelector<HTMLElement>(".solution-editor");
    expect(solutionEditor).not.toBeNull();
    expect(within(solutionEditor!).getByRole("button", { name: "数式" })).toBeInTheDocument();
    expect(within(solutionEditor!).getByRole("button", { name: "画像" })).toBeInTheDocument();
    expect(within(solutionEditor!).getByRole("button", { name: "表" })).toBeInTheDocument();

    fireEvent.click(within(solutionEditor!).getByRole("button", { name: "数式" }));
    expect(view.getByRole("dialog", { name: "数式を入力" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "キャンセル" }));

    fireEvent.click(within(solutionEditor!).getByRole("button", { name: "画像" }));
    expect(view.getByRole("dialog", { name: "画像を挿入" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "キャンセル" }));

    fireEvent.click(within(solutionEditor!).getByRole("button", { name: "表" }));
    const tableDialog = view.getByRole("dialog", { name: "表を挿入" });
    fireEvent.click(within(tableDialog).getByRole("button", { name: "挿入" }));

    const insertedWorksheet = onCommit.mock.calls.find(([label]) => label === "表を挿入")?.[1];
    expect(insertedWorksheet?.problems[0]?.solution?.content.at(-1)?.type).toBe("richTable");
  });
});
