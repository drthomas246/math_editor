import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OVERSIZED_PAGINATION_MESSAGE } from "../../application/pdf/pdf-pagination-guard";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { ImageDialog, MathDialog, PdfDialog, TableDialog, WorksheetSettingsDialog } from "./EditorDialogs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WorksheetSettingsDialog", () => {
  it("小問の番号形式だけを選択肢として表示する", () => {
    const onApply = vi.fn();
    const view = render(<WorksheetSettingsDialog worksheet={createWorksheet()} onClose={vi.fn()} onApply={onApply} />);
    const formatSelect = view.getByRole("combobox", { name: "小問の番号形式" });

    expect(within(formatSelect).getAllByRole("option").map((option) => option.textContent)).toEqual(["(1)", "1.", "①", "ア"]);
    expect(view.queryByRole("option", { name: "問1" })).not.toBeInTheDocument();

    fireEvent.change(formatSelect, { target: { value: "circled" } });
    fireEvent.click(view.getByRole("button", { name: "適用" }));

    expect(onApply.mock.lastCall?.[0].subQuestionNumberFormat).toBe("circled");
  });
});

describe("PdfDialog", () => {
  it("PDF出力では問題＋解答を引き続き選べる", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const view = render(<PdfDialog worksheet={createWorksheet()} initialMode="questions" assetUrls={new Map()} onClose={vi.fn()} onDone={vi.fn()} />);

    expect(view.getAllByRole("radio").map((radio) => radio.parentElement?.textContent)).toEqual([
      "問題のみ生徒配布用。問題色と空の解答欄を表示します。",
      "解答付き問題色と解答色、教師用の解説を表示します。",
      "問題＋解答問題編の後、新しいページから解答編を出力します。",
    ]);

    view.unmount();
    vi.unstubAllGlobals();
  });

  it("1ページに収まらないcontentがある場合はPDFダウンロードを無効化する", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => window.clearTimeout(id)));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
      if (this.classList.contains("paper-page")) return rectangle(1_000);
      if (this.classList.contains("paper-header")) return rectangle(100);
      if (this.dataset.paginationAtom) return rectangle(1_200);
      return rectangle(0);
    });
    const view = render(<PdfDialog worksheet={createWorksheet()} initialMode="questions" assetUrls={new Map()} onClose={vi.fn()} onDone={vi.fn()} />);

    expect(await view.findByRole("alert")).toHaveTextContent(OVERSIZED_PAGINATION_MESSAGE);
    expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeDisabled();
  });
});

describe("MathDialog", () => {
  it("記号パレットではTeXコマンドではなく数式記号を表示する", () => {
    const view = render(<MathDialog onClose={vi.fn()} onInsert={vi.fn()} />);
    const palette = view.container.querySelector(".symbol-grid");

    expect(palette).not.toBeNull();
    const buttons = within(palette as HTMLElement);
    expect(buttons.getByRole("button", { name: "かけ算を挿入" })).toHaveTextContent("×");
    expect(buttons.getByRole("button", { name: "わり算を挿入" })).toHaveTextContent("÷");
    expect(buttons.getByRole("button", { name: "小なりイコールを挿入" })).toHaveTextContent("≦");
    expect(buttons.getByRole("button", { name: "大なりイコールを挿入" })).toHaveTextContent("≧");
    const reverseNotEqualSlash = buttons.getByRole("button", { name: "等しくないを挿入" }).querySelector(".ML__rlap .ML__cmr");
    expect(reverseNotEqualSlash).toHaveTextContent("\\");
    for (const name of ["等しくない", "プラスマイナス", "分数", "平方根", "小なりイコール", "大なりイコール"]) {
      expect(buttons.getByRole("button", { name: `${name}を挿入` }).querySelector(".ML__latex")).not.toBeNull();
    }
    expect(palette).not.toHaveTextContent(/\\(?:times|div|ne|pm|frac|sqrt|le|ge)/u);
  });

  it("記号を挿入した後は数式欄のプレースホルダーへフォーカスする", () => {
    const view = render(<MathDialog onClose={vi.fn()} onInsert={vi.fn()} />);
    const mathfield = view.container.querySelector("math-field") as HTMLElement & {
      value: string;
      insert: ReturnType<typeof vi.fn>;
    };
    const focus = vi.spyOn(mathfield, "focus");
    const insert = vi.fn(() => true);
    Object.defineProperties(mathfield, {
      value: { configurable: true, value: "2x + 3 = 9", writable: true },
      insert: { configurable: true, value: insert },
    });

    const fractionButton = view.container.querySelectorAll<HTMLButtonElement>(".symbol-grid button")[7]!;
    fireEvent.click(fractionButton);

    expect(focus).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith("\\frac{#0}{#?}", {
      selectionMode: "placeholder",
      focus: true,
      scrollIntoView: true,
    });

    const squareRootButton = view.container.querySelectorAll<HTMLButtonElement>(".symbol-grid button")[8]!;
    fireEvent.click(squareRootButton);

    expect(insert).toHaveBeenLastCalledWith("\\sqrt{#0}", {
      selectionMode: "placeholder",
      focus: true,
      scrollIntoView: true,
    });
  });
});

describe("TableDialog", () => {
  it("関数テンプレートでも行数と列数を変更して挿入できる", () => {
    const onInsert = vi.fn();
    const view = render(<TableDialog onClose={vi.fn()} onInsert={onInsert} />);

    fireEvent.click(view.getByLabelText("関数"));
    const rows = view.getByRole("spinbutton", { name: /行数/u });
    const columns = view.getByRole("spinbutton", { name: /列数/u });
    expect(rows).toHaveValue(2);
    expect(columns).toHaveValue(4);

    fireEvent.change(rows, { target: { value: "5" } });
    fireEvent.change(columns, { target: { value: "6" } });
    fireEvent.click(view.getByRole("button", { name: "挿入" }));

    const table = onInsert.mock.lastCall?.[0];
    expect(table.rows).toHaveLength(5);
    expect(table.columnWidthsPercent).toHaveLength(6);
    expect(table.rows[0].cells[0].document.content[0].content[0].text).toBe("x");
    expect(table.rows[1].cells[0].document.content[0].content[0].text).toBe("y");
    expect(table.rows[2].cells[0].document.content[0].content).toEqual([]);
  });
});

describe("ImageDialog", () => {
  it("既存画像はファイルを選び直さず配置とサイズを変更できる", () => {
    const onApply = vi.fn();
    const view = render(<ImageDialog
      worksheetId={crypto.randomUUID()}
      initial={{ placement: "block", widthPercent: 66, alt: "三角形", previewUrl: "blob:current-image" }}
      onClose={vi.fn()}
      onApply={onApply}
    />);

    expect(view.getByRole("dialog", { name: "画像を編集" })).toBeInTheDocument();
    expect(view.getByRole("link", { name: "画像の詳しい使い方" })).toHaveAttribute("href", "/help/images-and-tables");
    expect(view.getByAltText("現在の画像のプレビュー")).toHaveAttribute("src", "blob:current-image");
    fireEvent.click(view.getByLabelText("右回り込み"));
    expect(view.getByRole("button", { name: "変更を保存" })).toBeDisabled();
    fireEvent.change(view.getByRole("combobox"), { target: { value: "50" } });
    fireEvent.change(view.getByRole("textbox"), { target: { value: "直角三角形" } });
    fireEvent.click(view.getByRole("button", { name: "変更を保存" }));

    expect(onApply).toHaveBeenCalledWith(null, "floatRight", 50, "直角三角形");
  });
});

function rectangle(height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 0,
    height,
    top: 0,
    right: 0,
    bottom: height,
    left: 0,
    toJSON: () => ({}),
  };
}
