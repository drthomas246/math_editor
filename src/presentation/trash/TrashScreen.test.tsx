import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { MathWorksheetDatabase } from "../../infrastructure/indexeddb/database";
import { DexieWorksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { TrashScreen } from "./TrashScreen";
let database: MathWorksheetDatabase;
let repository: DexieWorksheetRepository;
beforeEach((/**
 * 各テストケースに必要な前提条件を準備する。
 */
function prepareTestCase1() {
    database = new MathWorksheetDatabase(`trash-screen-${crypto.randomUUID()}`);
    repository = new DexieWorksheetRepository(database);
}));
afterEach((/**
 * 各テストケースで使用した状態を後片付けする。
 *
 * @returns 非同期処理の結果
 */
async function cleanUpTestCase2() {
    vi.restoreAllMocks();
    await database.delete();
}));
describe("TrashScreen", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite3() {
    it("読み込み失敗を表示し、loadingを解除して再読み込みできる", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase4() {
        const actualList = repository.list.bind(repository);
        const list = vi.spyOn(repository, "list").mockRejectedValueOnce(new Error("IndexedDB unavailable"));
        list.mockImplementation(actualList);
        renderScreen();
        const alert = await screen.findByRole("alert");
        expect(within(alert).getByText("ゴミ箱を読み込めませんでした")).toBeInTheDocument();
        expect(within(alert).getByText("IndexedDB unavailable")).toBeInTheDocument();
        await userEvent.click(within(alert).getByRole("button", { name: "再読み込み" }));
        expect(await screen.findByRole("heading", { name: "ゴミ箱は空です" })).toBeInTheDocument();
        expect(list).toHaveBeenCalledTimes(2);
    }));
    it("復元失敗を表示し、操作中状態を解除する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase5() {
        const worksheet = await createTrashedWorksheet("復元失敗テスト");
        vi.spyOn(repository, "restore").mockRejectedValueOnce(new Error("restore failed"));
        renderScreen();
        await userEvent.click(await screen.findByRole("button", { name: "復元" }));
        const alert = await screen.findByRole("alert");
        expect(within(alert).getByText("プリントを復元できませんでした")).toBeInTheDocument();
        expect(within(alert).getByText("restore failed")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "復元" })).toBeEnabled();
        expect((await repository.get(worksheet.id))?.worksheet.deletedAt).not.toBeNull();
    }));
    it("完全削除失敗をモーダルに表示し、再操作できる状態へ戻す", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase6() {
        const worksheet = await createTrashedWorksheet("削除失敗テスト");
        vi.spyOn(repository, "deletePermanently").mockRejectedValueOnce(new Error("delete failed"));
        renderScreen();
        await screen.findByText(worksheet.title);
        await userEvent.click(screen.getByRole("button", { name: "完全に削除" }));
        const dialog = screen.getByRole("dialog");
        await userEvent.click(within(dialog).getByRole("button", { name: "完全に削除" }));
        const alert = await within(dialog).findByRole("alert");
        expect(within(alert).getByText("プリントを完全に削除できませんでした")).toBeInTheDocument();
        expect(within(alert).getByText("delete failed")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "完全に削除" })).toBeEnabled();
        expect(await repository.get(worksheet.id)).not.toBeNull();
    }));
    it("空にする処理の失敗をモーダルに表示し、再操作できる状態へ戻す", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase7() {
        const worksheet = await createTrashedWorksheet("空にする失敗テスト");
        vi.spyOn(repository, "emptyTrash").mockRejectedValueOnce(new Error("empty failed"));
        renderScreen();
        await screen.findByText(worksheet.title);
        await userEvent.click(screen.getByRole("button", { name: "ゴミ箱を空にする" }));
        const dialog = screen.getByRole("dialog");
        await userEvent.click(within(dialog).getByRole("button", { name: "1件を完全に削除" }));
        const alert = await within(dialog).findByRole("alert");
        expect(within(alert).getByText("ゴミ箱を空にできませんでした")).toBeInTheDocument();
        expect(within(alert).getByText("empty failed")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "1件を完全に削除" })).toBeEnabled();
        expect(await repository.get(worksheet.id)).not.toBeNull();
    }));
}));
/**
 * renderScreenに対応する画面表示を更新する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function renderScreen() {
    return render(<MemoryRouter><TrashScreen repository={repository}/></MemoryRouter>);
}
/**
 * createTrashedWorksheetで必要な値を作成する。
 *
 * @param title titleとして使用する値
 * @returns 非同期処理の結果
 */
async function createTrashedWorksheet(title: string): Promise<Worksheet> {
    const worksheet = createWorksheet();
    worksheet.title = title;
    worksheet.header.title = title;
    await repository.create({ worksheet, assets: [] });
    return repository.trash(worksheet.id);
}
