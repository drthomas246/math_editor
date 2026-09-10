import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ManualScreen } from "./ManualScreen";
/**
 * マニュアルの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param path 検証エラーが指すデータ位置
 * @returns renderの結果
 */
function renderManual(path: string) {
    vi.spyOn(window, "scrollTo").mockImplementation((/**
     * 「対象機能」で外部依存から返すundefinedを固定し、検証を決定的にする。
     */
    function mockImplementationCallback1() {
        return undefined;
    }));
    return render(<MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/help/:chapterSlug" element={<ManualScreen />}/>
        <Route path="/help/*" element={<ManualScreen />}/>
      </Routes>
    </MemoryRouter>);
}
describe("ManualScreen", (/**
 * 「ManualScreen」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite2() {
    it("章、目次、前後移動を表示する", (/**
     * 「章、目次、前後移動を表示する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase3() {
        renderManual("/help/overview");
        expect(screen.getByRole("heading", { level: 1, name: "はじめに・動作環境" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /はじめに・動作環境/u })).toHaveAttribute("aria-current", "page");
        await userEvent.click(screen.getByRole("link", { name: /次の章最初のプリントを作る/u }));
        expect(await screen.findByRole("heading", { level: 1, name: "最初のプリントを作る" })).toBeInTheDocument();
    }));
    it("目次の11番目にAI Skillsの使い方を表示する", (/**
     * 「目次の11番目にAI Skillsの使い方を表示する」という仕様を操作結果から検証する。
     */
    function runTestCase4() {
        renderManual("/help/ai-skills");
        expect(screen.getByRole("heading", { level: 1, name: "AI Skillsの使い方" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /11AI Skillsの使い方/u })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("heading", { level: 2, name: "AIのSkillとは" })).toBeInTheDocument();
    }));
    it("目次の13番目にバージョンとライセンスを表示する", (/**
     * 「目次の13番目にバージョンとライセンスを表示する」という仕様を操作結果から検証する。
     */
    function runTestCase5() {
        renderManual("/help/version-and-license");
        expect(screen.getByRole("heading", { level: 1, name: "バージョンとライセンス" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /13バージョンとライセンス/u })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("row", { name: "マニュアル 1.1" })).toBeInTheDocument();
        expect(screen.getByText("Copyright © 2026 Yamahara Yoshihiro")).toBeInTheDocument();
    }));
    it("検索結果へ切り替え、選択後に章を表示する", (/**
     * 「検索結果へ切り替え、選択後に章を表示する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase6() {
        renderManual("/help/overview");
        await userEvent.type(screen.getByRole("textbox", { name: "マニュアルを検索" }), "数式");
        expect(await screen.findByRole("heading", { level: 1, name: "「数式」の検索結果" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(/件見つかりました/u);
        await userEvent.click((await screen.findAllByRole("link", { name: /数式/u }))[0]!);
        await waitFor((/**
         * 「検索結果へ切り替え、選択後に章を表示する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback7() {
            return expect(screen.getByRole("heading", { level: 1, name: "数式" })).toBeInTheDocument();
        }));
    }));
    it("Escapeで検索を解除し、不明URLではNot Foundを表示する", (/**
     * 「Escapeで検索を解除し、不明URLではNot Foundを表示する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase8() {
        renderManual("/help/unknown/path");
        expect(screen.getByRole("heading", { level: 1, name: "マニュアルのページが見つかりません" })).toBeInTheDocument();
        const input = screen.getByRole("textbox", { name: "マニュアルを検索" });
        await userEvent.type(input, "存在しない語{Escape}");
        expect(input).toHaveValue("");
        expect(input).toHaveFocus();
    }));
}));
