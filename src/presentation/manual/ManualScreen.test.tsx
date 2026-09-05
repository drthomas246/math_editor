import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ManualScreen } from "./ManualScreen";
/**
 * renderManualに対応する画面表示を更新する。
 *
 * @param path pathとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function renderManual(path: string) {
    vi.spyOn(window, "scrollTo").mockImplementation((/**
     * mockImplementationへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
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
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite2() {
    it("章、目次、前後移動を表示する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase3() {
        renderManual("/help/overview");
        expect(screen.getByRole("heading", { level: 1, name: "はじめに・動作環境" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /はじめに・動作環境/u })).toHaveAttribute("aria-current", "page");
        await userEvent.click(screen.getByRole("link", { name: /次の章最初のプリントを作る/u }));
        expect(await screen.findByRole("heading", { level: 1, name: "最初のプリントを作る" })).toBeInTheDocument();
    }));
    it("目次の11番目にAI Skillsの使い方を表示する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase4() {
        renderManual("/help/ai-skills");
        expect(screen.getByRole("heading", { level: 1, name: "AI Skillsの使い方" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /11AI Skillsの使い方/u })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("heading", { level: 2, name: "AIのSkillとは" })).toBeInTheDocument();
    }));
    it("目次の13番目にバージョンとライセンスを表示する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase5() {
        renderManual("/help/version-and-license");
        expect(screen.getByRole("heading", { level: 1, name: "バージョンとライセンス" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /13バージョンとライセンス/u })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("row", { name: "マニュアル 1.1" })).toBeInTheDocument();
        expect(screen.getByText("Copyright © 2026 Yamahara Yoshihiro")).toBeInTheDocument();
    }));
    it("検索結果へ切り替え、選択後に章を表示する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase6() {
        renderManual("/help/overview");
        await userEvent.type(screen.getByRole("textbox", { name: "マニュアルを検索" }), "数式");
        expect(await screen.findByRole("heading", { level: 1, name: "「数式」の検索結果" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(/件見つかりました/u);
        await userEvent.click((await screen.findAllByRole("link", { name: /数式/u }))[0]!);
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback7() {
            return expect(screen.getByRole("heading", { level: 1, name: "数式" })).toBeInTheDocument();
        }));
    }));
    it("Escapeで検索を解除し、不明URLではNot Foundを表示する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
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
