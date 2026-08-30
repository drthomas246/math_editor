import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
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
  it("ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const view = render(<PdfDialog worksheet={createWorksheet()} initialMode="questions" assetUrls={new Map()} onClose={vi.fn()} onDone={vi.fn()} />);

    expect(view.getAllByRole("radio").map((radio) => radio.parentElement?.textContent)).toEqual([
      "問題のみ生徒配布用。問題色と空の解答欄を表示します。",
      "解答付き問題色と解答色、教師用の解説を表示します。",
      "問題＋解答問題編の後、新しいページから解答編を出力します。",
    ]);
    expect(view.getByText("ページを分割中…")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeDisabled();

    await waitFor(() => expect(frames).toHaveLength(1));
    act(() => { frames.shift()!(0); });
    await waitFor(() => expect(view.getByText("ページ数: 1ページ")).toBeInTheDocument());
    expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeEnabled();

    fireEvent.click(view.getByRole("radio", { name: /問題＋解答/u }));
    expect(view.getByText("ページを分割中…")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeDisabled();

    await waitFor(() => expect(frames).toHaveLength(1));
    act(() => { frames.shift()!(0); });
    await waitFor(() => expect(view.getByText("ページ数: 2ページ")).toBeInTheDocument());
    expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeEnabled();

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
  it("複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する", async () => {
    const firstDecode = createPromiseGate<ImageBitmap>();
    const secondDecode = createPromiseGate<ImageBitmap>();
    const firstFile = createPngFile("first.png");
    const secondFile = createPngFile("second.png");
    const decode = vi.fn((blob: Blob) => (
      (blob as File).name === firstFile.name ? firstDecode.promise : secondDecode.promise
    ));
    vi.stubGlobal("createImageBitmap", decode);
    const onApply = vi.fn();
    const view = render(<ImageDialog
      worksheetId={crypto.randomUUID()}
      onClose={vi.fn()}
      onApply={onApply}
    />);
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [firstFile] } });
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { files: [secondFile] } });
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));

    const secondBitmap = createImageBitmapResult(200, 100);
    secondDecode.resolve(secondBitmap);
    await waitFor(() => expect(view.getByRole("button", { name: "挿入" })).toBeEnabled());

    const firstClose = vi.fn();
    const firstBitmap = createImageBitmapResult(300, 150, firstClose);
    firstDecode.resolve(firstBitmap);
    await waitFor(() => expect(firstClose).toHaveBeenCalledOnce());
    fireEvent.click(view.getByRole("button", { name: "挿入" }));

    const appliedAsset = onApply.mock.lastCall?.[0];
    expect(appliedAsset?.blob).toBe(secondFile);
    expect(appliedAsset).toMatchObject({ width: 200, height: 100 });
  });

  it("古いファイルの検証失敗で最新画像の選択状態を上書きしない", async () => {
    const firstDecode = createPromiseGate<ImageBitmap>();
    const secondDecode = createPromiseGate<ImageBitmap>();
    const firstFile = createPngFile("first.png");
    const secondFile = createPngFile("second.png");
    const decode = vi.fn((blob: Blob) => (
      (blob as File).name === firstFile.name ? firstDecode.promise : secondDecode.promise
    ));
    vi.stubGlobal("createImageBitmap", decode);
    const onApply = vi.fn();
    const view = render(<ImageDialog
      worksheetId={crypto.randomUUID()}
      onClose={vi.fn()}
      onApply={onApply}
    />);
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [firstFile] } });
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { files: [secondFile] } });
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));

    secondDecode.resolve(createImageBitmapResult(200, 100));
    await waitFor(() => expect(view.getByRole("button", { name: "挿入" })).toBeEnabled());

    await act(async () => {
      firstDecode.reject(new Error("古い画像のdecode失敗"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(view.queryByText("画像を読み込めませんでした。")).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: "挿入" })).toBeEnabled();
    fireEvent.click(view.getByRole("button", { name: "挿入" }));
    expect(onApply.mock.lastCall?.[0].blob).toBe(secondFile);
  });

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

function createPngFile(name: string): File {
  return new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], name, { type: "image/png" });
}

function createImageBitmapResult(width: number, height: number, close = vi.fn()): ImageBitmap {
  return { width, height, close } as unknown as ImageBitmap;
}

function createPromiseGate<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
