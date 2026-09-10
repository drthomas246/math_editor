import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERSIZED_PAGINATION_MESSAGE } from "../../application/pdf/pdf-pagination-guard";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { ImageDialog, MathDialog, PdfDialog, TableDialog, WorksheetSettingsDialog } from "./EditorDialogs";
afterEach((/**
 * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
 */
function cleanUpTestCase1() {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
}));
describe("WorksheetSettingsDialog", (/**
 * 「WorksheetSettingsDialog」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite2() {
    it("小問の番号形式だけを選択肢として表示する", (/**
     * 「小問の番号形式だけを選択肢として表示する」という仕様を操作結果から検証する。
     */
    function runTestCase3() {
        const onApply = vi.fn();
        const view = render(<WorksheetSettingsDialog worksheet={createWorksheet()} onClose={vi.fn()} onApply={onApply}/>);
        const formatSelect = view.getByRole("combobox", { name: "小問の番号形式" });
        expect(within(formatSelect).getAllByRole("option").map((/**
         * 各検証対象の選択肢要素を検証対象の選択肢要素のテキスト・内容へ変換する。
         *
         * @param option 検証対象の選択肢要素
         * @returns 検証対象の選択肢要素のテキスト・内容
         */
        function mapItem4(option) {
            return option.textContent;
        }))).toEqual(["(1)", "1.", "①", "ア"]);
        expect(view.queryByRole("option", { name: "問1" })).not.toBeInTheDocument();
        fireEvent.change(formatSelect, { target: { value: "circled" } });
        fireEvent.click(view.getByRole("button", { name: "適用" }));
        expect(onApply.mock.lastCall?.[0].subQuestionNumberFormat).toBe("circled");
    }));
}));
describe("PdfDialog", (/**
 * 「PdfDialog」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite5() {
    it("ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す", (/**
     * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase6() {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」で外部依存から返すframesのlengthを固定し、検証を決定的にする。
         *
         * @param callback 条件成立後に実行する処理
         * @returns framesのlength
         */
        function fnCallback7(callback: FrameRequestCallback) {
            frames.push(callback);
            return frames.length;
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const view = render(<PdfDialog worksheet={createWorksheet()} initialMode="questions" assetUrls={new Map()} onClose={vi.fn()} onDone={vi.fn()}/>);
        expect(view.getAllByRole("radio").map((/**
         * 各選択状態を確認するラジオボタンを選択状態を確認するラジオボタンのparent・要素のテキスト・内容へ変換する。
         *
         * @param radio 選択状態を確認するラジオボタン
         * @returns 選択状態を確認するラジオボタンのparent・要素のテキスト・内容
         */
        function mapItem8(radio) {
            return radio.parentElement?.textContent;
        }))).toEqual([
            "問題のみ生徒配布用。問題色と空の解答欄を表示します。",
            "解答付き問題色と解答色、教師用の解説を表示します。",
            "問題＋解答問題編の後、新しいページから解答編を出力します。",
        ]);
        expect(view.getByText("ページを分割中…")).toBeInTheDocument();
        expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeDisabled();
        await waitFor((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback9() {
            return expect(frames).toHaveLength(1);
        }));
        act((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」で発生するReactの状態更新と副作用をまとめて完了させる。
         */
        function actCallback10() { frames.shift()!(0); }));
        await waitFor((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback11() {
            return expect(view.getByText("ページ数: 1ページ")).toBeInTheDocument();
        }));
        expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeEnabled();
        fireEvent.click(view.getByRole("radio", { name: /問題＋解答/u }));
        expect(view.getByText("ページを分割中…")).toBeInTheDocument();
        expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeDisabled();
        await waitFor((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback12() {
            return expect(frames).toHaveLength(1);
        }));
        act((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」で発生するReactの状態更新と副作用をまとめて完了させる。
         */
        function actCallback13() { frames.shift()!(0); }));
        await waitFor((/**
         * 「ページ分割完了までダウンロードを無効化し、モード変更時もreadyを待ち直す」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback14() {
            return expect(view.getByText("ページ数: 2ページ")).toBeInTheDocument();
        }));
        expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeEnabled();
        view.unmount();
        vi.unstubAllGlobals();
    }));
    it("1ページに収まらないcontentがある場合はPDFダウンロードを無効化する", (/**
     * 「1ページに収まらないcontentがある場合はPDFダウンロードを無効化する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase15() {
        vi.stubGlobal("requestAnimationFrame", vi.fn((/**
         * 「1ページに収まらないcontentがある場合はPDFダウンロードを無効化する」で外部依存から返すset・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param callback 条件成立後に実行する処理
         */
        function fnCallback16(callback: FrameRequestCallback) {
            return window.setTimeout((/**
             * 連続操作が落ち着いてから、保留中の保存または表示更新を実行する。
             *
             */
            function handleScheduledTask17() {
                return callback(0);
            }), 0);
        })));
        vi.stubGlobal("cancelAnimationFrame", vi.fn((/**
         * 「1ページに収まらないcontentがある場合はPDFダウンロードを無効化する」で外部依存から返すclear・Timeoutの結果を固定し、検証を決定的にする。
         *
         * @param id 対象を識別するID
         */
        function fnCallback18(id: number) {
            return window.clearTimeout(id);
        })));
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation((/**
         * 「1ページに収まらないcontentがある場合はPDFダウンロードを無効化する」で外部依存から返すrectangleの結果を固定し、検証を決定的にする。
         *
         * @param this 関数を呼び出したオブジェクト
         * @returns rectangleの結果
         */
        function mockImplementationCallback19(this: HTMLElement) {
            if (this.classList.contains("paper-page"))
                return rectangle(1000);
            if (this.classList.contains("paper-header"))
                return rectangle(100);
            if (this.dataset.paginationAtom)
                return rectangle(1200);
            return rectangle(0);
        }));
        const view = render(<PdfDialog worksheet={createWorksheet()} initialMode="questions" assetUrls={new Map()} onClose={vi.fn()} onDone={vi.fn()}/>);
        expect(await view.findByRole("alert")).toHaveTextContent(OVERSIZED_PAGINATION_MESSAGE);
        expect(view.getByRole("button", { name: "PDFをダウンロード" })).toBeDisabled();
    }));
}));
describe("MathDialog", (/**
 * 「MathDialog」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite20() {
    it("記号パレットではTeXコマンドではなく数式記号を表示する", (/**
     * 「記号パレットではTeXコマンドではなく数式記号を表示する」という仕様を操作結果から検証する。
     */
    function runTestCase21() {
        const view = render(<MathDialog onClose={vi.fn()} onInsert={vi.fn()}/>);
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
    }));
    it("記号を挿入した後は数式欄のプレースホルダーへフォーカスする", (/**
     * 「記号を挿入した後は数式欄のプレースホルダーへフォーカスする」という仕様を操作結果から検証する。
     */
    function runTestCase22() {
        const view = render(<MathDialog onClose={vi.fn()} onInsert={vi.fn()}/>);
        const mathfield = view.container.querySelector("math-field") as HTMLElement & {
            value: string;
            insert: ReturnType<typeof vi.fn>;
        };
        const focus = vi.spyOn(mathfield, "focus");
        const insert = vi.fn((/**
         * 「記号を挿入した後は数式欄のプレースホルダーへフォーカスする」で外部依存から返す条件成立を示すtrueを固定し、検証を決定的にする。
         *
         * @returns 条件成立を示すtrue
         */
        function fnCallback23() {
            return true;
        }));
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
    }));
}));
describe("TableDialog", (/**
 * 「TableDialog」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite24() {
    it("関数テンプレートでも行数と列数を変更して挿入できる", (/**
     * 「関数テンプレートでも行数と列数を変更して挿入できる」という仕様を操作結果から検証する。
     */
    function runTestCase25() {
        const onInsert = vi.fn();
        const view = render(<TableDialog onClose={vi.fn()} onInsert={onInsert}/>);
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
    }));
}));
describe("ImageDialog", (/**
 * 「ImageDialog」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite26() {
    it("複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する", (/**
     * 「複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase27() {
        const firstDecode = createPromiseGate<ImageBitmap>();
        const secondDecode = createPromiseGate<ImageBitmap>();
        const firstFile = createPngFile("first.png");
        const secondFile = createPngFile("second.png");
        const decode = vi.fn((/**
         * 「複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する」で外部依存から返す条件に応じて選択した値を固定し、検証を決定的にする。
         *
         * @param blob 検証または保存するバイナリデータ
         * @returns 条件に応じて選択した値
         */
        function fnCallback28(blob: Blob) {
            return ((blob as File).name === firstFile.name ? firstDecode.promise : secondDecode.promise);
        }));
        vi.stubGlobal("createImageBitmap", decode);
        const onApply = vi.fn();
        const view = render(<ImageDialog worksheetId={crypto.randomUUID()} onClose={vi.fn()} onApply={onApply}/>);
        const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
        fireEvent.change(input, { target: { files: [firstFile] } });
        await waitFor((/**
         * 「複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback29() {
            return expect(decode).toHaveBeenCalledTimes(1);
        }));
        fireEvent.change(input, { target: { files: [secondFile] } });
        await waitFor((/**
         * 「複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback30() {
            return expect(decode).toHaveBeenCalledTimes(2);
        }));
        const secondBitmap = createImageBitmapResult(200, 100);
        secondDecode.resolve(secondBitmap);
        await waitFor((/**
         * 「複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback31() {
            return expect(view.getByRole("button", { name: "挿入" })).toBeEnabled();
        }));
        const firstClose = vi.fn();
        const firstBitmap = createImageBitmapResult(300, 150, firstClose);
        firstDecode.resolve(firstBitmap);
        await waitFor((/**
         * 「複数ファイルの検証が逆順に完了しても最後に選択した画像を使用する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback32() {
            return expect(firstClose).toHaveBeenCalledOnce();
        }));
        fireEvent.click(view.getByRole("button", { name: "挿入" }));
        const appliedAsset = onApply.mock.lastCall?.[0];
        expect(appliedAsset?.blob).toBe(secondFile);
        expect(appliedAsset).toMatchObject({ width: 200, height: 100 });
    }));
    it("古いファイルの検証失敗で最新画像の選択状態を上書きしない", (/**
     * 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase33() {
        const firstDecode = createPromiseGate<ImageBitmap>();
        const secondDecode = createPromiseGate<ImageBitmap>();
        const firstFile = createPngFile("first.png");
        const secondFile = createPngFile("second.png");
        const decode = vi.fn((/**
         * 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」で外部依存から返す条件に応じて選択した値を固定し、検証を決定的にする。
         *
         * @param blob 検証または保存するバイナリデータ
         * @returns 条件に応じて選択した値
         */
        function fnCallback34(blob: Blob) {
            return ((blob as File).name === firstFile.name ? firstDecode.promise : secondDecode.promise);
        }));
        vi.stubGlobal("createImageBitmap", decode);
        const onApply = vi.fn();
        const view = render(<ImageDialog worksheetId={crypto.randomUUID()} onClose={vi.fn()} onApply={onApply}/>);
        const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
        fireEvent.change(input, { target: { files: [firstFile] } });
        await waitFor((/**
         * 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback35() {
            return expect(decode).toHaveBeenCalledTimes(1);
        }));
        fireEvent.change(input, { target: { files: [secondFile] } });
        await waitFor((/**
         * 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback36() {
            return expect(decode).toHaveBeenCalledTimes(2);
        }));
        secondDecode.resolve(createImageBitmapResult(200, 100));
        await waitFor((/**
         * 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback37() {
            return expect(view.getByRole("button", { name: "挿入" })).toBeEnabled();
        }));
        await act((/**
         * 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「古いファイルの検証失敗で最新画像の選択状態を上書きしない」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
         */
        async function actCallback38() {
            firstDecode.reject(new Error("古い画像のdecode失敗"));
            await new Promise((/**
             * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
             *
             * @param resolve 非同期処理を正常完了させるPromise関数
             */
            function settlePromise39(resolve) {
                return window.setTimeout(resolve, 0);
            }));
        }));
        expect(view.queryByText("画像を読み込めませんでした。")).not.toBeInTheDocument();
        expect(view.getByRole("button", { name: "挿入" })).toBeEnabled();
        fireEvent.click(view.getByRole("button", { name: "挿入" }));
        expect(onApply.mock.lastCall?.[0].blob).toBe(secondFile);
    }));
    it("既存画像はファイルを選び直さず配置とサイズを変更できる", (/**
     * 「既存画像はファイルを選び直さず配置とサイズを変更できる」という仕様を操作結果から検証する。
     */
    function runTestCase40() {
        const onApply = vi.fn();
        const view = render(<ImageDialog worksheetId={crypto.randomUUID()} initial={{ placement: "block", widthPercent: 66, alt: "三角形", previewUrl: "blob:current-image" }} onClose={vi.fn()} onApply={onApply}/>);
        expect(view.getByRole("dialog", { name: "画像を編集" })).toBeInTheDocument();
        expect(view.getByRole("link", { name: "画像の詳しい使い方" })).toHaveAttribute("href", "/help/images-and-tables");
        expect(view.getByAltText("現在の画像のプレビュー")).toHaveAttribute("src", "blob:current-image");
        fireEvent.click(view.getByLabelText("右回り込み"));
        expect(view.getByRole("button", { name: "変更を保存" })).toBeDisabled();
        fireEvent.change(view.getByRole("combobox"), { target: { value: "50" } });
        fireEvent.change(view.getByRole("textbox"), { target: { value: "直角三角形" } });
        fireEvent.click(view.getByRole("button", { name: "変更を保存" }));
        expect(onApply).toHaveBeenCalledWith(null, "floatRight", 50, "直角三角形");
    }));
}));
/**
 * DOM寸法に依存する処理を検証するため、指定値を持つ矩形情報を作る。
 *
 * @param height 要素またはページの高さ
 * @returns 水平方向の座標・垂直方向の座標・要素または列へ適用する幅・要素またはページの高さ・要素上端の座標を持つオブジェクト
 */
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
        toJSON: (/**
         * を持つオブジェクトを一つの結果へまとめる。
         *
         * @returns を持つオブジェクト
         */
        function toJSONCallback41() {
            return ({});
        }),
    };
}
/**
 * Png・ファイルを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param name 生成物または計測項目を識別する名前
 * @returns ファイルの新しいインスタンス
 */
function createPngFile(name: string): File {
    return new File([
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], name, { type: "image/png" });
}
/**
 * 画像・Bitmap・結果を識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param width 要素または列へ適用する幅
 * @param height 要素またはページの高さ
 * @param close 対象を閉じる操作
 * @returns 要素または列へ適用する幅・要素またはページの高さ・対象を閉じる操作を持つオブジェクト
 */
function createImageBitmapResult(width: number, height: number, close = vi.fn()): ImageBitmap {
    return { width, height, close } as unknown as ImageBitmap;
}
/**
 * Promise・Gateを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns Promise・Gateを識別子・初期値・関連データが揃った新しい値として組み立てる処理の完了時に解決するPromise
 */
function createPromiseGate<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolve: (value: T) => void = (/**
     * 現在の状態を基に非同期処理を正常完了させるPromise関数を導出する。
     */
    function resolveImplementation42() {
        return undefined;
    });
    let reject: (reason?: unknown) => void = (/**
     * 現在の状態を基に非同期処理を失敗として終了させるPromise関数を導出する。
     */
    function rejectImplementation43() {
        return undefined;
    });
    const promise = new Promise<T>((/**
     * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
     *
     * @param resolvePromise テスト用Promiseを正常完了させる関数
     * @param rejectPromise テスト用Promiseを失敗として終了させる関数
     */
    function captureCompletion44(resolvePromise, rejectPromise) {
        resolve = resolvePromise;
        reject = rejectPromise;
    }));
    return { promise, resolve, reject };
}
