import type { JSONContent } from "@tiptap/core";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BasicRichTextDocument } from "../../domain/worksheet/worksheet";
import "../../styles.css";
import { RichTextEditor } from "./RichTextEditor";
import { normalizeEditorDocument } from "./rich-text-editor-extensions";

describe("RichTextEditor", () => {
  it("1つの文章欄で入力色を切り替え、解答色を文字のmarkとして保存する", async () => {
    const user = userEvent.setup();
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
    };
    const onChange = vi.fn();
    const onTable = vi.fn();
    const view = render(<RichTextEditor document={document} onChange={onChange} onTable={onTable} />);

    const colorSelector = view.getByRole("combobox", { name: "入力色" });
    await user.selectOptions(colorSelector, "answer");
    view.getByLabelText("ここに問題文を入力…").focus();
    await user.keyboard("赤い答え");
    fireEvent.click(view.getByRole("button", { name: "表" }));

    const textNode = onChange.mock.lastCall?.[0]?.content[0]?.type === "paragraph"
      ? onChange.mock.lastCall[0].content[0].content[0]
      : null;
    expect(textNode).toMatchObject({ type: "text", text: "赤い答え", marks: [{ type: "answerColor" }] });
    expect(onTable).toHaveBeenCalledWith("answer");
  });

  it("斜体字形を持たない日本語フォントでも斜体を表示する", () => {
    const italicDocument: BasicRichTextDocument = {
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [{ type: "text", text: "斜体", marks: [{ type: "italic" }] }],
      }],
    };

    const { container } = render(<RichTextEditor document={italicDocument} onChange={vi.fn()} />);
    const italic = container.querySelector("em");
    const editorContent = container.querySelector(".rich-editor-content");

    expect(italic).toHaveTextContent("斜体");
    expect(getComputedStyle(editorContent!).fontSynthesis).toBe("style");
  });

  it.each([
    ["箇条書き", "ul"],
    ["番号付きリスト", "ol"],
  ])("%sへ切り替えても末尾に削除不能な空の入力行を追加しない", (buttonName, listSelector) => {
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
    };
    const view = render(<RichTextEditor document={document} onChange={vi.fn()} />);
    const editorContent = view.container.querySelector<HTMLElement>(".rich-editor-content")!;

    fireEvent.click(view.getByRole("button", { name: buttonName }));

    expect(editorContent.querySelector(`:scope > ${listSelector}`)).not.toBeNull();
    expect(editorContent.querySelectorAll(":scope > p")).toHaveLength(0);
  });

  it("LaTeXを文字列へ潰さず行内・独立数式として描画する", () => {
    const mathDocument: BasicRichTextDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            { type: "text", text: "式: " },
            { type: "inlineMath", attrs: { latex: "x^2", textSize: "normal" } },
          ],
        },
        { type: "blockMath", attrs: { latex: "\\frac{1}{2}x+3=9", textSize: "large" } },
      ],
    };

    const { container } = render(<RichTextEditor document={mathDocument} onChange={vi.fn()} />);
    const inlineMath = container.querySelector('[data-math-node="inline"]');
    const blockMath = container.querySelector('[data-math-node="block"]');

    expect(inlineMath).toHaveAttribute("data-latex", "x^2");
    expect(inlineMath?.querySelector(".ML__latex")).not.toBeNull();
    const inlineStyle = getComputedStyle(inlineMath!);
    expect(inlineStyle.verticalAlign).toBe("middle");
    expect(parseFloat(inlineStyle.fontSize)).toBeGreaterThan(14);
    expect(blockMath).toHaveAttribute("data-latex", "\\frac{1}{2}x+3=9");
    expect(blockMath).toHaveClass("math-size-large");
    expect(blockMath?.querySelector(".ML__latex")).not.toBeNull();
  });

  it("挿入済みの数式を開き直して内容と文字サイズを変更する", () => {
    const mathDocument: BasicRichTextDocument = {
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: "式: " },
          { type: "inlineMath", attrs: { latex: "x^2", textSize: "normal" } },
        ],
      }],
    };
    const onChange = vi.fn();
    const view = render(<RichTextEditor document={mathDocument} onChange={onChange} />);

    fireEvent.click(view.getByRole("button", { name: "数式を編集" }));
    expect(view.getByRole("dialog", { name: "数式を編集" })).toBeInTheDocument();
    expect(view.getByRole("dialog", { name: "数式を編集" }).querySelector(".math-preview [role='math'] .ML__latex")).not.toBeNull();

    const mathfield = view.getByLabelText("数式を視覚的に入力") as HTMLElement & { value: string };
    Object.defineProperty(mathfield, "value", { configurable: true, value: "x^3+1", writable: true });
    fireEvent.input(mathfield);
    fireEvent.change(view.getByLabelText("数式の文字サイズ"), { target: { value: "large" } });
    fireEvent.click(view.getByRole("button", { name: "変更を保存" }));

    expect(onChange.mock.lastCall?.[0]).toEqual({
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: "式: " },
          { type: "inlineMath", attrs: { latex: "x^3+1", textSize: "large" } },
        ],
      }],
    });
    expect(view.queryByRole("dialog", { name: "数式を編集" })).not.toBeInTheDocument();
  });

  it("TipTapのJSONを保存スキーマへ正規化して数式を保持する", () => {
    expect(normalizeEditorDocument({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "a+b", textSize: "normal" } }] },
        { type: "blockMath", attrs: { latex: "x=1", textSize: "xLarge" } },
      ],
    })).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "inlineMath", attrs: { latex: "a+b", textSize: "normal" } }] },
        { type: "blockMath", attrs: { latex: "x=1", textSize: "xLarge" } },
      ],
    });
  });

  it("行内数式をカーソル位置の段落内へ前後の半角スペース付きで挿入する", () => {
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text: "本文" }] }],
    };
    const onChange = vi.fn();
    const view = render(<RichTextEditor document={document} onChange={onChange} enableMath />);

    fireEvent.click(view.getByRole("button", { name: "数式" }));
    fireEvent.click(view.getByRole("button", { name: "挿入" }));

    expect(onChange.mock.lastCall?.[0]).toEqual({
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "2x + 3 = 9", textSize: "normal" } },
          { type: "text", text: " 本文" },
        ],
      }],
    });
  });

  it("本文内の表は選択中のセルだけをWYSIWYG化し、ほかのセルは完成形で表示する", () => {
    const imageId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const tableId = crypto.randomUUID();
    const rowId = crypto.randomUUID();
    const cellId = crypto.randomUUID();
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [
        {
          type: "imageRef",
          attrs: { id: imageId, assetId, alt: "座標平面", placement: "block", widthPercent: 50 },
        },
        {
          type: "richTable",
          attrs: {
            id: tableId,
            rows: [{
              id: rowId,
              cells: [{
                id: cellId,
                document: { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text: "x" }] }] },
                rowSpan: 1,
                columnSpan: 1,
              }],
            }],
            columnWidthsPercent: [100],
            headerRow: true,
          },
        },
      ],
    };

    const onChange = vi.fn();
    const view = render(<RichTextEditor document={document} assetUrls={new Map([[assetId, "blob:test-image"]])} onChange={onChange} enableMath />);
    const { container } = view;

    expect(container.querySelector('[data-image-ref] img')).toHaveAttribute("src", "blob:test-image");
    expect(container.querySelector('[data-image-ref] img')).toHaveAttribute("alt", "座標平面");
    expect(container.querySelectorAll("[contenteditable='true']")).toHaveLength(1);
    const previewButton = view.getByRole("button", { name: "1行1列を編集" });
    expect(previewButton).toHaveTextContent("x");
    fireEvent.click(previewButton);

    expect(container.querySelectorAll("[contenteditable='true']")).toHaveLength(2);
    expect(view.getByRole("textbox", { name: "1行1列" })).toHaveTextContent("x");
    expect(view.queryByRole("button", { name: "1行1列に数式を挿入" })).not.toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "数式" }));
    expect(view.getByRole("dialog", { name: "表セルに数式を挿入" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "独立数式" })).not.toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "挿入" }));

    const mathDocument = onChange.mock.lastCall?.[0] as BasicRichTextDocument;
    const updatedTable = mathDocument.content.find((node) => node.type === "richTable");
    expect(updatedTable?.type === "richTable" ? updatedTable.attrs.rows[0]?.cells[0]?.document.content[0] : null).toEqual({
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        { type: "text", text: "x " },
        { type: "inlineMath", attrs: { latex: "2x + 3 = 9", textSize: "normal" } },
        { type: "text", text: " " },
      ],
    });
    const tableMathEditButton = container.querySelector<HTMLElement>(".table-cell-wysiwyg-content .math-node-edit-button");
    expect(tableMathEditButton).not.toBeNull();
    expect(getComputedStyle(tableMathEditButton!).top).toBe("calc(100% + 0.2rem)");

    const outerContent = container.querySelectorAll<HTMLElement>(".rich-editor-content")[0]!;
    fireEvent.pointerDown(outerContent.querySelector(":scope > p:last-child")!);
    expect(container.querySelectorAll("[contenteditable='true']")).toHaveLength(1);
    const completedCell = view.getByRole("button", { name: "1行1列を編集" });
    expect(completedCell).toHaveTextContent("x");
    expect(completedCell.querySelector('[role="math"]')).not.toBeNull();

    fireEvent.click(view.getByRole("button", { name: "数式" }));
    expect(view.getByRole("dialog", { name: "数式を入力" })).toBeInTheDocument();
    expect(normalizeEditorDocument(document as JSONContent)).toEqual(document);
  });

  it("小問本文内の表でセルを選び、横結合してから分割できる", () => {
    const firstCellId = crypto.randomUUID();
    const secondCellId = crypto.randomUUID();
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{
        type: "richTable",
        attrs: {
          id: crypto.randomUUID(),
          rows: [{
            id: crypto.randomUUID(),
            cells: [firstCellId, secondCellId].map((id, index) => ({
              id,
              document: { type: "doc" as const, content: [{ type: "paragraph" as const, attrs: { textAlign: "left" as const }, content: [{ type: "text" as const, text: index === 0 ? "左" : "右" }] }] },
              rowSpan: 1,
              columnSpan: 1,
            })),
          }],
          columnWidthsPercent: [50, 50],
          headerRow: false,
        },
      }],
    };
    const onChange = vi.fn();
    const view = render(<RichTextEditor document={document} onChange={onChange} />);

    fireEvent.click(view.getByRole("button", { name: "1行1列を編集" }));
    expect(view.getByRole("toolbar", { name: "表の行・列・セル操作" })).toBeInTheDocument();
    const rowHeight = view.getByRole("spinbutton", { name: "選択行の高さ（mm）" });
    fireEvent.change(rowHeight, { target: { value: "20" } });
    fireEvent.blur(rowHeight);
    const heightDocument = onChange.mock.lastCall?.[0] as BasicRichTextDocument;
    const heightTable = heightDocument.content.find((node) => node.type === "richTable");
    expect(heightTable?.type === "richTable" ? heightTable.attrs.rows[0]?.heightMm : null).toBe(20);

    fireEvent.click(view.getByRole("button", { name: "1行1列を編集" }));
    const columnWidth = view.getByRole("spinbutton", { name: "選択列の幅（%）" });
    fireEvent.change(columnWidth, { target: { value: "60" } });
    fireEvent.blur(columnWidth);
    const widthDocument = onChange.mock.lastCall?.[0] as BasicRichTextDocument;
    const widthTable = widthDocument.content.find((node) => node.type === "richTable");
    expect(widthTable?.type === "richTable" ? widthTable.attrs.columnWidthsPercent : null).toEqual([60, 40]);

    fireEvent.click(view.getByRole("button", { name: "1行1列を編集" }));
    fireEvent.click(view.getByRole("button", { name: "右のセルと横結合" }));

    const mergedDocument = onChange.mock.lastCall?.[0] as BasicRichTextDocument;
    const mergedTable = mergedDocument.content.find((node) => node.type === "richTable");
    expect(mergedTable?.type === "richTable" ? mergedTable.attrs.rows[0]?.cells : null).toHaveLength(1);
    expect(mergedTable?.type === "richTable" ? mergedTable.attrs.rows[0]?.cells[0] : null).toMatchObject({
      id: firstCellId,
      columnSpan: 2,
    });

    fireEvent.click(view.getByRole("button", { name: "1行1列を編集" }));
    fireEvent.click(view.getByRole("button", { name: "結合セルを分割" }));
    const splitDocument = onChange.mock.lastCall?.[0] as BasicRichTextDocument;
    const splitTable = splitDocument.content.find((node) => node.type === "richTable");
    expect(splitTable?.type === "richTable" ? splitTable.attrs.rows[0]?.cells : null).toHaveLength(2);
  });

  it("表セル用エディターはカーソル位置へ行内数式だけを挿入する", () => {
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text: "答えは" }] }],
    };
    const onChange = vi.fn();
    const view = render(<RichTextEditor tableCell document={document} onChange={onChange} />);

    fireEvent.click(view.getByRole("button", { name: "数式" }));
    expect(view.getByRole("dialog", { name: "表セルに数式を挿入" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "独立数式" })).not.toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "挿入" }));

    expect(onChange.mock.lastCall?.[0]).toEqual({
      type: "doc",
      content: [{
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "2x + 3 = 9", textSize: "normal" } },
          { type: "text", text: " 答えは" },
        ],
      }],
    });
  });

  it("画像URLの追加時に破棄済みエディターへアクセスしない", () => {
    const imageId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{
        type: "imageRef",
        attrs: { id: imageId, assetId, alt: "追加画像", placement: "block", widthPercent: 50 },
      }],
    };

    const view = render(<RichTextEditor document={document} assetUrls={new Map()} onChange={vi.fn()} />);
    expect(view.container.querySelector(".editor-missing-asset")).not.toBeNull();

    expect(() => view.rerender(
      <RichTextEditor document={document} assetUrls={new Map([[assetId, "blob:added-image"]])} onChange={vi.fn()} />,
    )).not.toThrow();
    expect(view.container.querySelector('[data-image-ref] img')).toHaveAttribute("src", "blob:added-image");
  });

  it("本文内の画像から現在の配置・サイズを指定して編集を開始する", () => {
    const imageId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{
        type: "imageRef",
        attrs: { id: imageId, assetId, alt: "グラフ", placement: "floatRight", widthPercent: 33 },
      }],
    };
    const onEditImage = vi.fn();
    const view = render(<RichTextEditor document={document} assetUrls={new Map([[assetId, "blob:graph"]])} onChange={vi.fn()} onEditImage={onEditImage} />);

    fireEvent.click(view.getByRole("button", { name: "画像を編集" }));

    expect(onEditImage).toHaveBeenCalledWith({
      id: imageId,
      assetId,
      alt: "グラフ",
      placement: "floatRight",
      widthPercent: 33,
    });
  });

  it("コンパクト表示でも指定された挿入ボタンを表示する", () => {
    const document: BasicRichTextDocument = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
    };
    const onImage = vi.fn();
    const onTable = vi.fn();
    const view = render(<RichTextEditor compact document={document} onChange={vi.fn()} enableMath onImage={onImage} onTable={onTable} />);

    fireEvent.click(view.getByRole("button", { name: "数式" }));
    expect(view.getByRole("dialog", { name: "数式を入力" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "キャンセル" }));
    fireEvent.click(view.getByRole("button", { name: "画像" }));
    fireEvent.click(view.getByRole("button", { name: "表" }));

    expect(onImage).toHaveBeenCalledOnce();
    expect(onTable).toHaveBeenCalledOnce();
  });
});
