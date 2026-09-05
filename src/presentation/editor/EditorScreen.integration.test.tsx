import { act, fireEvent, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { MathWorksheetDatabase } from "../../infrastructure/indexeddb/database";
import { DexieWorksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { createSaveRequest, useEditorStore } from "./editor-store";
import { EditorScreen } from "./EditorScreen";
import type { ProblemListProps } from "./ProblemList";
const problemListHarness = vi.hoisted((/**
 * hoistedへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function hoistedCallback1() {
    return ({ props: null as ProblemListProps | null });
}));
vi.mock("./ProblemList", (/**
 * mockへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function mockCallback2() {
    return ({
        ProblemList: (/**
         * ProblemListコンポーネントを表示する。
         *
         * @param props 表示や操作に必要な設定
         * @returns 呼び出し元で使用する処理結果
         */
        function ProblemListCallback3(props: ProblemListProps) {
            problemListHarness.props = props;
            return <section data-testid="problem-card"/>;
        }),
    });
}));
vi.mock("../preview/WorksheetPreview", (/**
 * mockへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function mockCallback4() {
    return ({
        WorksheetPreview: (/**
         * WorksheetPreviewコンポーネントを表示する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function WorksheetPreviewCallback5() {
            return <div data-testid="worksheet-preview"/>;
        }),
    });
}));
vi.mock("../dialogs/EditorDialogs", (/**
 * mockへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function mockCallback6() {
    return ({
        PdfDialog: (/**
         * PdfDialogコンポーネントを表示する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function PdfDialogCallback7() {
            return <div role="dialog" aria-label="PDF出力"/>;
        }),
        WorksheetSettingsDialog: (/**
         * WorksheetSettingsDialogコンポーネントを表示する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function WorksheetSettingsDialogCallback8() {
            return <div role="dialog" aria-label="プリント設定"/>;
        }),
    });
}));
const TEST_TIMEOUT_MS = 4000;
let database: MathWorksheetDatabase;
let repository: DexieWorksheetRepository;
let worksheet: Worksheet;
let activeViews: RenderResult[];
beforeEach((/**
 * 各テストケースに必要な前提条件を準備する。
 *
 * @returns 非同期処理の結果
 */
async function prepareTestCase9() {
    database = new MathWorksheetDatabase(`editor-integration-${crypto.randomUUID()}`);
    repository = new DexieWorksheetRepository(database);
    worksheet = createWorksheet();
    await repository.create({ worksheet, assets: [] });
    useEditorStore.getState().clear();
    problemListHarness.props = null;
    activeViews = [];
}));
afterEach((/**
 * 各テストケースで使用した状態を後片付けする。
 *
 * @returns 非同期処理の結果
 */
async function cleanUpTestCase10() {
    activeViews.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param view viewとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function processItem11(view) {
        return view.unmount();
    }));
    await new Promise((/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param resolve resolveとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function commentRuleCallback12(resolve) {
        return window.setTimeout(resolve, 0);
    }));
    useEditorStore.getState().clear();
    vi.restoreAllMocks();
    await database.delete();
}));
describe("EditorScreen 離脱・保存統合", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite13() {
    it("dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase14() {
        renderEditor();
        const titleInput = await editorTitleInput();
        fireEvent.change(titleInput, { target: { value: "未保存の変更" } });
        expect(screen.getByText("未保存")).toBeInTheDocument();
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback15() {
            return expect(dispatchBeforeUnload()).toBe(true);
        }));
        const request = createSaveRequest(useEditorStore.getState());
        expect(request).not.toBeNull();
        act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function actCallback16() {
            return useEditorStore.getState().markSaving(request!);
        }));
        expect(screen.getByText("保存中…")).toBeInTheDocument();
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback17() {
            return expect(dispatchBeforeUnload()).toBe(true);
        }));
    }));
    it("savedではbeforeunloadを阻止しない", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase18() {
        renderEditor();
        await editorTitleInput();
        expect(screen.getByText("保存済み")).toBeInTheDocument();
        expect(dispatchBeforeUnload()).toBe(false);
    }));
    it("通常プレビューは問題のみと解答付きだけを選べる", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase19() {
        renderEditor();
        await editorTitleInput();
        const mode = screen.getByRole("combobox", { name: "プレビューモード" }) as HTMLSelectElement;
        expect(Array.from(mode.options, (/**
         * fromへ渡す処理を実行する。
         *
         * @param option optionとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback20(option) {
            return option.textContent;
        }))).toEqual(["問題のみ", "解答付き"]);
    }));
    it("編集後にdebounce保存を行いIndexedDBと表示をsavedへ更新する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase21() {
        const save = vi.spyOn(repository, "save");
        renderEditor();
        const titleInput = await editorTitleInput();
        fireEvent.change(titleInput, { target: { value: "自動保存されたプリント" } });
        expect(screen.getByText("未保存")).toBeInTheDocument();
        await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "自動保存されたプリント" }), {
            pruneUnreferencedAssets: true,
            retainedAssetIds: new Set(),
        });
        expect((await repository.get(worksheet.id))?.worksheet.title).toBe("自動保存されたプリント");
    }));
    it("Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase22() {
        renderEditor();
        await editorTitleInput();
        const originalAsset = createAsset(worksheet, 1);
        const source = structuredClone(worksheet);
        source.problems[0]!.contents = [{
                id: crypto.randomUUID(),
                type: "image",
                assetId: originalAsset.id,
                alt: "差し替え前",
                placement: "block",
                widthPercent: 50,
            }];
        await repository.putAsset(originalAsset, source);
        act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function actCallback23() {
            return useEditorStore.getState().commit("画像を挿入", source);
        }));
        const replacementAsset = createAsset(worksheet, 2);
        const replacement = structuredClone(source);
        const image = replacement.problems[0]!.contents[0]!;
        if (image.type !== "image")
            throw new Error("テスト用画像がありません");
        image.assetId = replacementAsset.id;
        await repository.putAsset(replacementAsset, replacement);
        const save = vi.spyOn(repository, "save");
        act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function actCallback24() {
            return useEditorStore.getState().commit("画像を差し替え", replacement);
        }));
        expect(screen.getByText("未保存")).toBeInTheDocument();
        await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
        expect(save.mock.calls.at(-1)?.[1]).toEqual({
            pruneUnreferencedAssets: true,
            retainedAssetIds: new Set([replacementAsset.id, originalAsset.id]),
        });
        expect(new Set((await database.assets.toArray()).map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param asset assetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem25(asset) {
            return asset.id;
        })))).toEqual(new Set([
            originalAsset.id,
            replacementAsset.id,
        ]));
        act((/**
         * actへ渡す処理を実行する。
         */
        function actCallback26() {
            for (let index = 0; index < 100; index += 1) {
                useEditorStore.getState().mutate(`履歴を追加 ${index}`, (/**
                 * mutateへ渡す処理を実行する。
                 *
                 * @param draft draftとして使用する値
                 */
                function mutateCallback27(draft) {
                    draft.title = `履歴 ${index}`;
                    draft.header.title = draft.title;
                }));
            }
        }));
        expect(screen.getByText("未保存")).toBeInTheDocument();
        await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function waitForCallback28() {
            expect((await database.assets.toArray()).map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param asset assetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem29(asset) {
                return asset.id;
            }))).toEqual([replacementAsset.id]);
        }));
        expect(save.mock.calls.at(-1)?.[1]).toEqual({
            pruneUnreferencedAssets: true,
            retainedAssetIds: new Set([replacementAsset.id]),
        });
    }));
    it("保存失敗をfailedで表示し、再試行でIndexedDBへ保存する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase30() {
        const actualSave = repository.save.bind(repository);
        const save = vi.spyOn(repository, "save").mockImplementation(actualSave);
        save.mockRejectedValueOnce(new Error("quota exceeded"));
        renderEditor();
        const titleInput = await editorTitleInput();
        fireEvent.change(titleInput, { target: { value: "再試行対象" } });
        await screen.findByText("保存できませんでした", {}, { timeout: TEST_TIMEOUT_MS });
        expect(dispatchBeforeUnload()).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "再試行" }));
        await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
        expect(save).toHaveBeenCalledTimes(2);
        expect((await repository.get(worksheet.id))?.worksheet.title).toBe("再試行対象");
    }));
    it("一覧へ戻る前にGC付き保存の完了を待つ", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase31() {
        const actualSave = repository.save.bind(repository);
        let releaseSave: (() => void) | undefined;
        const saveGate = new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         */
        function commentRuleCallback32(resolve) { releaseSave = resolve; }));
        let firstSave = true;
        const save = vi.spyOn(repository, "save").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param value 処理対象の値
         * @param options optionsとして使用する値
         * @returns 非同期処理の結果
         */
        async function mockImplementationCallback33(value, options) {
            if (firstSave) {
                firstSave = false;
                await saveGate;
            }
            await actualSave(value, options);
        }));
        renderEditor();
        const titleInput = await editorTitleInput();
        fireEvent.change(titleInput, { target: { value: "離脱前保存" } });
        fireEvent.click(screen.getAllByRole("button", { name: "一覧" })[0]!);
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback34() {
            return expect(save).toHaveBeenCalledTimes(1);
        }));
        expect(screen.queryByText("一覧画面")).not.toBeInTheDocument();
        expect(save.mock.calls[0]?.[1]).toEqual({ pruneUnreferencedAssets: true });
        releaseSave!();
        await screen.findByText("一覧画面", {}, { timeout: TEST_TIMEOUT_MS });
        expect((await repository.get(worksheet.id))?.worksheet.title).toBe("離脱前保存");
    }));
    it("ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase35() {
        const actualSave = repository.save.bind(repository);
        const save = vi.spyOn(repository, "save").mockImplementation(actualSave);
        save.mockRejectedValueOnce(new Error("quota exceeded"));
        const editorPath = `/worksheets/${worksheet.id}`;
        const view = renderEditor(["/", editorPath], 1);
        const titleInput = await editorTitleInput();
        fireEvent.change(titleInput, { target: { value: "戻る失敗でも保持" } });
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback36() { await view.router.navigate(-1); }));
        await screen.findByText("保存できませんでした", {}, { timeout: TEST_TIMEOUT_MS });
        expect(view.router.state.location.pathname).toBe(editorPath);
        expect(screen.getByRole("textbox", { name: "プリント題名" })).toHaveValue("戻る失敗でも保持");
        expect(useEditorStore.getState()).toMatchObject({
            worksheet: { title: "戻る失敗でも保持" },
            saveStatus: "failed",
        });
        expect((await repository.get(worksheet.id))?.worksheet.title).not.toBe("戻る失敗でも保持");
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback37() { await view.router.navigate(-1); }));
        await screen.findByText("一覧画面", {}, { timeout: TEST_TIMEOUT_MS });
        expect(view.router.state.location.pathname).toBe("/");
        expect(save).toHaveBeenCalledTimes(2);
        expect((await repository.get(worksheet.id))?.worksheet.title).toBe("戻る失敗でも保持");
    }));
}));
describe("EditorScreen 画像保存の競合制御", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite38() {
    it("画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase39() {
        const actualPutAsset = repository.putAsset.bind(repository);
        const putAssetFinished = createPromiseGate();
        const assetWritten = createPromiseGate();
        vi.spyOn(repository, "putAsset").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param asset assetとして使用する値
         * @param value 処理対象の値
         * @returns 非同期処理の結果
         */
        async function mockImplementationCallback40(asset, value) {
            await actualPutAsset(asset, value);
            assetWritten.release();
            await putAssetFinished.promise;
        }));
        const save = vi.spyOn(repository, "save");
        renderEditor();
        const titleInput = await editorTitleInput();
        const asset = createAsset(worksheet, 1);
        const addImage = currentProblemListProps().onAddImage(worksheet.problems[0]!.id, asset, "block", 50, "GCされない画像");
        await assetWritten.promise;
        fireEvent.change(titleInput, { target: { value: "画像保存中の編集" } });
        expect(dispatchBeforeUnload()).toBe(true);
        await new Promise((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback41(resolve) {
            return window.setTimeout(resolve, 900);
        }));
        expect(save).not.toHaveBeenCalled();
        expect(await database.assets.get(asset.id)).toBeDefined();
        putAssetFinished.release();
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback42() { await addImage; }));
        await screen.findByText("保存済み", {}, { timeout: TEST_TIMEOUT_MS });
        const savedWorksheet = await database.worksheets.get(worksheet.id);
        expect(savedWorksheet).toMatchObject({ title: "画像保存中の編集" });
        expect(savedWorksheet?.problems[0]?.contents).toContainEqual(expect.objectContaining({
            type: "image",
            assetId: asset.id,
        }));
        expect(await database.assets.get(asset.id)).toBeDefined();
    }));
    it("画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase43() {
        const actualPutAsset = repository.putAsset.bind(repository);
        const gate = createPromiseGate();
        const putAsset = vi.spyOn(repository, "putAsset").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param asset assetとして使用する値
         * @param value 処理対象の値
         * @returns 非同期処理の結果
         */
        async function mockImplementationCallback44(asset, value) {
            await gate.promise;
            await actualPutAsset(asset, value);
        }));
        renderEditor();
        const titleInput = await editorTitleInput();
        const asset = createAsset(worksheet, 1);
        const props = currentProblemListProps();
        const addImage = props.onAddImage(worksheet.problems[0]!.id, asset, "block", 50, "追加画像");
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback45() {
            return expect(putAsset).toHaveBeenCalledTimes(1);
        }));
        fireEvent.change(titleInput, { target: { value: "ABC" } });
        gate.release();
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback46() { await addImage; }));
        const latest = useEditorStore.getState().worksheet;
        expect(latest).toMatchObject({ id: worksheet.id, title: "ABC" });
        expect(latest?.problems[0]?.contents).toContainEqual(expect.objectContaining({
            type: "image",
            assetId: asset.id,
            alt: "追加画像",
        }));
    }));
    it("画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase47() {
        const originalAsset = createAsset(worksheet, 1);
        const imageId = crypto.randomUUID();
        const source = structuredClone(worksheet);
        source.problems[0]!.contents = [{
                id: imageId,
                type: "image",
                assetId: originalAsset.id,
                alt: "差し替え前",
                placement: "block",
                widthPercent: 50,
            }];
        renderEditor();
        const titleInput = await editorTitleInput();
        act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function actCallback48() {
            return useEditorStore.getState().commit("画像を挿入", source);
        }));
        const actualPutAsset = repository.putAsset.bind(repository);
        const gate = createPromiseGate();
        const putAsset = vi.spyOn(repository, "putAsset").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param asset assetとして使用する値
         * @param value 処理対象の値
         * @returns 非同期処理の結果
         */
        async function mockImplementationCallback49(asset, value) {
            await gate.promise;
            await actualPutAsset(asset, value);
        }));
        const replacementAsset = createAsset(worksheet, 2);
        const props = currentProblemListProps();
        const updateImage = props.onUpdateImage(worksheet.problems[0]!.id, imageId, replacementAsset, "floatRight", 33, "差し替え後");
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback50() {
            return expect(putAsset).toHaveBeenCalledTimes(1);
        }));
        fireEvent.change(titleInput, { target: { value: "差し替え中の編集" } });
        gate.release();
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback51() { await updateImage; }));
        const latest = useEditorStore.getState().worksheet;
        expect(latest).toMatchObject({ id: worksheet.id, title: "差し替え中の編集" });
        expect(latest?.problems[0]?.contents).toContainEqual(expect.objectContaining({
            id: imageId,
            type: "image",
            assetId: replacementAsset.id,
            alt: "差し替え後",
            placement: "floatRight",
            widthPercent: 33,
        }));
    }));
    it("画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase52() {
        const otherWorksheet = createWorksheet();
        otherWorksheet.title = "プリントB";
        otherWorksheet.header.title = otherWorksheet.title;
        await repository.create({ worksheet: otherWorksheet, assets: [] });
        const actualPutAsset = repository.putAsset.bind(repository);
        const gate = createPromiseGate();
        const putAsset = vi.spyOn(repository, "putAsset").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param asset assetとして使用する値
         * @param value 処理対象の値
         * @returns 非同期処理の結果
         */
        async function mockImplementationCallback53(asset, value) {
            await gate.promise;
            await actualPutAsset(asset, value);
        }));
        const view = renderEditor();
        await editorTitleInput();
        const asset = createAsset(worksheet, 3);
        const props = currentProblemListProps();
        const addImage = props.onAddImage(worksheet.problems[0]!.id, asset, "block", 50, "Aの画像");
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback54() {
            return expect(putAsset).toHaveBeenCalledTimes(1);
        }));
        let navigation: Promise<void> | undefined;
        act((/**
         * actへ渡す処理を実行する。
         */
        function actCallback55() { navigation = view.router.navigate(`/worksheets/${otherWorksheet.id}`); }));
        await waitFor((/**
         * waitForへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function waitForCallback56() {
            return expect(view.router.state.location.pathname).toBe(`/worksheets/${worksheet.id}`);
        }));
        expect(screen.getByRole("textbox", { name: "プリント題名" })).toHaveValue(worksheet.title);
        gate.release();
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback57() { await addImage; }));
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback58() { await navigation; }));
        expect(await editorTitleInput()).toHaveValue("プリントB");
        expect(useEditorStore.getState().worksheet).toMatchObject({
            id: otherWorksheet.id,
            title: "プリントB",
        });
        expect(useEditorStore.getState().worksheet?.problems[0]?.contents).not.toContainEqual(expect.objectContaining({ assetId: asset.id }));
    }));
}));
describe("EditorScreen 読み込み状態", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite59() {
    it("存在しないプリントはNot Foundとして表示する", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase60() {
        renderEditor([`/worksheets/${crypto.randomUUID()}`]);
        expect(await screen.findByRole("heading", { name: "プリントが見つかりません" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "プリントを読み込めませんでした" })).not.toBeInTheDocument();
    }));
    it("repositoryの読み込み失敗をNot Foundと区別し、再読み込みできる", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase61() {
        const actualGet = repository.get.bind(repository);
        const get = vi.spyOn(repository, "get").mockRejectedValueOnce(new Error("IndexedDB unavailable"));
        get.mockImplementation(actualGet);
        renderEditor();
        expect(await screen.findByRole("heading", { name: "プリントを読み込めませんでした" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "プリントが見つかりません" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
        expect(await editorTitleInput()).toHaveValue(worksheet.title);
        expect(get).toHaveBeenCalledTimes(2);
    }));
    it("worksheetId変更時に以前のNot Found状態をloadingへリセットする", (/**
     * 期待する振る舞いを検証する。
     *
     * @returns 非同期処理の結果
     */
    async function runTestCase62() {
        const missingId = crypto.randomUUID();
        const actualGet = repository.get.bind(repository);
        let releaseLoad: (() => void) | undefined;
        const loadGate = new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         */
        function commentRuleCallback63(resolve) { releaseLoad = resolve; }));
        vi.spyOn(repository, "get").mockImplementation((/**
         * mockImplementationへ渡す処理を実行する。
         *
         * @param id 対象を識別するID
         * @returns 非同期処理の結果
         */
        async function mockImplementationCallback64(id) {
            if (id === worksheet.id)
                await loadGate;
            return actualGet(id);
        }));
        const view = renderEditor([`/worksheets/${missingId}`]);
        await screen.findByRole("heading", { name: "プリントが見つかりません" });
        await act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function actCallback65() { await view.router.navigate(`/worksheets/${worksheet.id}`); }));
        expect(screen.getByText("プリントを読み込んでいます")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "プリントが見つかりません" })).not.toBeInTheDocument();
        releaseLoad!();
        expect(await editorTitleInput()).toHaveValue(worksheet.title);
    }));
}));
type EditorRenderResult = RenderResult & {
    router: ReturnType<typeof createMemoryRouter>;
};
/**
 * renderEditorに対応する画面表示を更新する。
 *
 * @param initialEntries initialEntriesとして使用する値
 * @param initialIndex initialIndexとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function renderEditor(initialEntries: string[] = [`/worksheets/${worksheet.id}`], initialIndex?: number): EditorRenderResult {
    const router = createMemoryRouter([
        { path: "/worksheets/:worksheetId", element: <EditorScreen repository={repository}/> },
        { path: "/", element: <main>一覧画面</main> },
    ], {
        initialEntries,
        ...(initialIndex === undefined ? {} : { initialIndex }),
    });
    const view = Object.assign(render(<RouterProvider router={router}/>), { router });
    activeViews.push(view);
    return view;
}
/**
 * editorTitleInputに必要な処理を実行する。
 *
 * @returns 非同期処理の結果
 */
async function editorTitleInput(): Promise<HTMLInputElement> {
    return screen.findByRole("textbox", { name: "プリント題名" }, { timeout: TEST_TIMEOUT_MS }) as Promise<HTMLInputElement>;
}
/**
 * dispatchBeforeUnloadに必要な処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function dispatchBeforeUnload(): boolean {
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    return event.defaultPrevented;
}
/**
 * createAssetで必要な値を作成する。
 *
 * @param owner ownerとして使用する値
 * @param byte byteとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createAsset(owner: Worksheet, byte: number): AssetRecord {
    return {
        id: crypto.randomUUID(),
        worksheetId: owner.id,
        mimeType: "image/png",
        blob: new Blob([new Uint8Array([byte])], { type: "image/png" }),
        width: 1,
        height: 1,
        createdAt: new Date().toISOString(),
    };
}
/**
 * currentProblemListPropsに必要な処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function currentProblemListProps(): ProblemListProps {
    if (!problemListHarness.props)
        throw new Error("ProblemListが表示されていません");
    return problemListHarness.props;
}
/**
 * createPromiseGateで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function createPromiseGate(): {
    promise: Promise<void>;
    release: () => void;
} {
    let release: () => void = (/**
     * releaseに必要な処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function releaseImplementation66() {
        return undefined;
    });
    const promise = new Promise<void>((/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param resolve resolveとして使用する値
     */
    function commentRuleCallback67(resolve) { release = resolve; }));
    return { promise, release };
}
