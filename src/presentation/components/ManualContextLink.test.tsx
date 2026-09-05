import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualContextLink } from "./ManualContextLink";
describe("ManualContextLink", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("Topicの章を別タブで安全に開く", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
        render(<ManualContextLink topic="formula">数式の使い方</ManualContextLink>);
        expect(screen.getByRole("link", { name: /数式の使い方/u })).toHaveAttribute("href", "/help/formulas");
        expect(screen.getByRole("link", { name: /数式の使い方/u })).toHaveAttribute("target", "_blank");
        expect(screen.getByRole("link", { name: /数式の使い方/u })).toHaveAttribute("rel", "noopener noreferrer");
    }));
    it("アイコン表示へ具体的な名前を付ける", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        render(<ManualContextLink topic="editorBasics" variant="icon"/>);
        expect(screen.getByRole("link", { name: "編集の詳しい使い方を新しいタブで開く" })).toHaveAttribute("href", "/help/editor-basics");
    }));
}));
