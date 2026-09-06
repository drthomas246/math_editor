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
 * 「対象機能」で外部依存から返すコンポーネントへ渡す表示情報と操作を持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns コンポーネントへ渡す表示情報と操作を持つオブジェクト
 */
function hoistedCallback1() {
    return ({ props: null as ProblemListProps | null });
}));
vi.mock("./ProblemList", (/**
 * 「対象機能」で外部依存から返す問題・一覧を持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns 問題・一覧を持つオブジェクト
 */
function mockCallback2() {
    return ({
        ProblemList: (/**
         * プリント内の問題を採番順に並べ、選択中の問題だけを編集可能なカードとして表示する。
         *
         * @param props 問題・一覧へ渡す表示情報と操作
         * @returns 問題・一覧を表示するReact要素
         */
        function ProblemListCallback3(props: ProblemListProps) {
            problemListHarness.props = props;
            return <section data-testid="problem-card"/>;
        }),
    });
}));
vi.mock("../preview/WorksheetPreview", (/**
 * 「対象機能」で外部依存から返すプリント・プレビューを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns プリント・プレビューを持つオブジェクト
 */
function mockCallback4() {
    return ({
        WorksheetPreview: (/**
         * プリントを用紙寸法へ改ページし、問題と解答の表示モードに応じたページ群を表示する。
         *
         * @returns プリント・プレビューを表示するReact要素
         */
        function WorksheetPreviewCallback5() {
            return <div data-testid="worksheet-preview"/>;
        }),
    });
}));
vi.mock("../dialogs/EditorDialogs", (/**
 * 「対象機能」で外部依存から返すPDF・ダイアログ・プリント・設定・ダイアログを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns PDF・ダイアログ・プリント・設定・ダイアログを持つオブジェクト
 */
function mockCallback6() {
    return ({
        PdfDialog: (/**
         * 問題・解答の出力範囲を選び、改ページ検証後にPDFを生成するダイアログを表示する。
         *
         * @returns PDF・ダイアログを表示するReact要素
         */
        function PdfDialogCallback7() {
            return <div role="dialog" aria-label="PDF出力"/>;
        }),
        WorksheetSettingsDialog: (/**
         * 用紙・余白・フォント・採番・ヘッダーを編集し、まとめてプリントへ適用するダイアログを表示する。
         *
         * @returns プリント・設定・ダイアログを表示するReact要素
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
 * 各テストが互いに影響しない初期状態とモックを準備する。
 *
 * @returns 各テストが互いに影響しない初期状態とモックを準備する処理の完了時に解決するPromise
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
 * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
 *
 * @returns 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する処理の完了時に解決するPromise
 */
async function cleanUpTestCase10() {
    activeViews.forEach((/**
     * 各テストで操作するレンダリング結果についてunmountを実行し、対応関係または検証状態を更新する。
     *
     * @param view テストで操作するレンダリング結果
     */
    function processItem11(view) {
        return view.unmount();
    }));
    await new Promise((/**
     * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
     *
     * @param resolve 非同期処理を正常完了させるPromise関数
     */
    function settlePromise12(resolve) {
        return window.setTimeout(resolve, 0);
    }));
    useEditorStore.getState().clear();
    vi.restoreAllMocks();
    await database.delete();
}));
describe("EditorScreen 離脱・保存統合", (/**
 * 「EditorScreen 離脱・保存統合」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite13() {
    it("dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する", (/**
     * 「dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase14() {
        renderEditor();
        const titleInput = await editorTitleInput();
        fireEvent.change(titleInput, { target: { value: "未保存の変更" } });
        expect(screen.getByText("未保存")).toBeInTheDocument();
        await waitFor((/**
         * 「dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback15() {
            return expect(dispatchBeforeUnload()).toBe(true);
        }));
        const request = createSaveRequest(useEditorStore.getState());
        expect(request).not.toBeNull();
        act((/**
         * 「dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 文字装飾・Savingの結果
         */
        function actCallback16() {
            return useEditorStore.getState().markSaving(request!);
        }));
        expect(screen.getByText("保存中…")).toBeInTheDocument();
        await waitFor((/**
         * 「dirtyとsavingではbeforeunloadを阻止してタブ終了・リロード警告を要求する」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback17() {
            return expect(dispatchBeforeUnload()).toBe(true);
        }));
    }));
    it("savedではbeforeunloadを阻止しない", (/**
     * 「savedではbeforeunloadを阻止しない」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase18() {
        renderEditor();
        await editorTitleInput();
        expect(screen.getByText("保存済み")).toBeInTheDocument();
        expect(dispatchBeforeUnload()).toBe(false);
    }));
    it("通常プレビューは問題のみと解答付きだけを選べる", (/**
     * 「通常プレビューは問題のみと解答付きだけを選べる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase19() {
        renderEditor();
        await editorTitleInput();
        const mode = screen.getByRole("combobox", { name: "プレビューモード" }) as HTMLSelectElement;
        expect(Array.from(mode.options, (/**
         * 配列位置ごとに検証対象の選択肢要素のテキスト・内容を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @param option 検証対象の選択肢要素
         * @returns 検証対象の選択肢要素のテキスト・内容
         */
        function fromCallback20(option) {
            return option.textContent;
        }))).toEqual(["問題のみ", "解答付き"]);
    }));
    it("編集後にdebounce保存を行いIndexedDBと表示をsavedへ更新する", (/**
     * 「編集後にdebounce保存を行いIndexedDBと表示をsavedへ更新する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
     * 「Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
         * 「Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
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
         * 「Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
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
         * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
         *
         * @param asset 処理対象の画像アセット
         * @returns 処理対象の画像アセットの対象を一意に特定する識別子
         */
        function mapItem25(asset) {
            return asset.id;
        })))).toEqual(new Set([
            originalAsset.id,
            replacementAsset.id,
        ]));
        act((/**
         * 「Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする」で発生するReactの状態更新と副作用をまとめて完了させる。
         */
        function actCallback26() {
            for (let index = 0; index < 100; index += 1) {
                useEditorStore.getState().mutate(`履歴を追加 ${index}`, (/**
                 * Immerが提供する更新中の状態の題名を値を埋め込んだ表示文字列へ更新する。
                 *
                 * @param draft Immerが提供する更新中の状態
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
         * 「Undo履歴から外れた差し替え前Assetを通常の自動保存でGCする」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         * @returns 非同期の画面更新が検証可能な状態へ到達したことを確認する処理の完了時に解決するPromise
         */
        async function waitForCallback28() {
            expect((await database.assets.toArray()).map((/**
             * 各処理対象の画像アセットを処理対象の画像アセットの対象を一意に特定する識別子へ変換する。
             *
             * @param asset 処理対象の画像アセット
             * @returns 処理対象の画像アセットの対象を一意に特定する識別子
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
     * 「保存失敗をfailedで表示し、再試行でIndexedDBへ保存する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
     * 「一覧へ戻る前にGC付き保存の完了を待つ」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase31() {
        const actualSave = repository.save.bind(repository);
        let releaseSave: (() => void) | undefined;
        const saveGate = new Promise<void>((/**
         * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         */
        function settlePromise32(resolve) { releaseSave = resolve; }));
        let firstSave = true;
        const save = vi.spyOn(repository, "save").mockImplementation((/**
         * 「一覧へ戻る前にGC付き保存の完了を待つ」で外部依存から返す処理済みの要素を固定し、検証を決定的にする。
         *
         * @param value mock・Implementationで判定または変換する入力値
         * @param options 処理方法を指定するオプション
         * @returns 「一覧へ戻る前にGC付き保存の完了を待つ」で外部依存から返す処理済みの要素を固定し、検証を決定的にする処理の完了時に解決するPromise
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
         * 「一覧へ戻る前にGC付き保存の完了を待つ」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
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
     * 「ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
         * 「ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
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
         * 「ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「ブラウザの戻るで保存に失敗したら編集画面と未保存データを保持する」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
         */
        async function actCallback37() { await view.router.navigate(-1); }));
        await screen.findByText("一覧画面", {}, { timeout: TEST_TIMEOUT_MS });
        expect(view.router.state.location.pathname).toBe("/");
        expect(save).toHaveBeenCalledTimes(2);
        expect((await repository.get(worksheet.id))?.worksheet.title).toBe("戻る失敗でも保持");
    }));
}));
describe("EditorScreen 画像保存の競合制御", (/**
 * 「EditorScreen 画像保存の競合制御」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite38() {
    it("画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する", (/**
     * 「画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase39() {
        const actualPutAsset = repository.putAsset.bind(repository);
        const putAssetFinished = createPromiseGate();
        const assetWritten = createPromiseGate();
        vi.spyOn(repository, "putAsset").mockImplementation((/**
         * 「画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する」で外部依存から返す処理済みの要素を固定し、検証を決定的にする。
         *
         * @param asset 処理対象の画像アセット
         * @param value mock・Implementationで判定または変換する入力値
         * @returns 「画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する」で外部依存から返す処理済みの要素を固定し、検証を決定的にする処理の完了時に解決するPromise
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
         * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         */
        function settlePromise41(resolve) {
            return window.setTimeout(resolve, 900);
        }));
        expect(save).not.toHaveBeenCalled();
        expect(await database.assets.get(asset.id)).toBeDefined();
        putAssetFinished.release();
        await act((/**
         * 「画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「画像Asset操作中はautosaveとGCを保留し、完了後に最新Worksheetを保存する」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
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
     * 「画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase43() {
        const actualPutAsset = repository.putAsset.bind(repository);
        const gate = createPromiseGate();
        const putAsset = vi.spyOn(repository, "putAsset").mockImplementation((/**
         * 「画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする」で外部依存から返す処理済みの要素を固定し、検証を決定的にする。
         *
         * @param asset 処理対象の画像アセット
         * @param value mock・Implementationで判定または変換する入力値
         * @returns 「画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする」で外部依存から返す処理済みの要素を固定し、検証を決定的にする処理の完了時に解決するPromise
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
         * 「画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback45() {
            return expect(putAsset).toHaveBeenCalledTimes(1);
        }));
        fireEvent.change(titleInput, { target: { value: "ABC" } });
        gate.release();
        await act((/**
         * 「画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「画像保存中の同一プリント編集を保持し、最新Worksheetへ画像挿入をrebaseする」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
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
     * 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
         * 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         */
        function actCallback48() {
            return useEditorStore.getState().commit("画像を挿入", source);
        }));
        const actualPutAsset = repository.putAsset.bind(repository);
        const gate = createPromiseGate();
        const putAsset = vi.spyOn(repository, "putAsset").mockImplementation((/**
         * 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」で外部依存から返す処理済みの要素を固定し、検証を決定的にする。
         *
         * @param asset 処理対象の画像アセット
         * @param value mock・Implementationで判定または変換する入力値
         * @returns 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」で外部依存から返す処理済みの要素を固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function mockImplementationCallback49(asset, value) {
            await gate.promise;
            await actualPutAsset(asset, value);
        }));
        const replacementAsset = createAsset(worksheet, 2);
        const props = currentProblemListProps();
        const updateImage = props.onUpdateImage(worksheet.problems[0]!.id, imageId, replacementAsset, "floatRight", 33, "差し替え後");
        await waitFor((/**
         * 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback50() {
            return expect(putAsset).toHaveBeenCalledTimes(1);
        }));
        fireEvent.change(titleInput, { target: { value: "差し替え中の編集" } });
        gate.release();
        await act((/**
         * 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「画像差し替え保存中の同一プリント編集を保持し、最新Worksheetへ差し替えをrebaseする」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
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
     * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase52() {
        const otherWorksheet = createWorksheet();
        otherWorksheet.title = "プリントB";
        otherWorksheet.header.title = otherWorksheet.title;
        await repository.create({ worksheet: otherWorksheet, assets: [] });
        const actualPutAsset = repository.putAsset.bind(repository);
        const gate = createPromiseGate();
        const putAsset = vi.spyOn(repository, "putAsset").mockImplementation((/**
         * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で外部依存から返す処理済みの要素を固定し、検証を決定的にする。
         *
         * @param asset 処理対象の画像アセット
         * @param value mock・Implementationで判定または変換する入力値
         * @returns 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で外部依存から返す処理済みの要素を固定し、検証を決定的にする処理の完了時に解決するPromise
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
         * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback54() {
            return expect(putAsset).toHaveBeenCalledTimes(1);
        }));
        let navigation: Promise<void> | undefined;
        act((/**
         * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で発生するReactの状態更新と副作用をまとめて完了させる。
         */
        function actCallback55() { navigation = view.router.navigate(`/worksheets/${otherWorksheet.id}`); }));
        await waitFor((/**
         * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」の検証対象が更新を終え、アサーション可能になるまで待機する。
         *
         */
        function waitForCallback56() {
            return expect(view.router.state.location.pathname).toBe(`/worksheets/${worksheet.id}`);
        }));
        expect(screen.getByRole("textbox", { name: "プリント題名" })).toHaveValue(worksheet.title);
        gate.release();
        await act((/**
         * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
         */
        async function actCallback57() { await addImage; }));
        await act((/**
         * 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「画像保存完了まで別プリントへの移動を保留し、移動先のstoreを保つ」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
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
 * 「EditorScreen 読み込み状態」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite59() {
    it("存在しないプリントはNot Foundとして表示する", (/**
     * 「存在しないプリントはNot Foundとして表示する」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase60() {
        renderEditor([`/worksheets/${crypto.randomUUID()}`]);
        expect(await screen.findByRole("heading", { name: "プリントが見つかりません" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "プリントを読み込めませんでした" })).not.toBeInTheDocument();
    }));
    it("repositoryの読み込み失敗をNot Foundと区別し、再読み込みできる", (/**
     * 「repositoryの読み込み失敗をNot Foundと区別し、再読み込みできる」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
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
     * 「worksheetId変更時に以前のNot Found状態をloadingへリセットする」という仕様を操作結果から検証する。
     *
     * @returns テスト内の操作と検証が完了したときに解決するPromise
     */
    async function runTestCase62() {
        const missingId = crypto.randomUUID();
        const actualGet = repository.get.bind(repository);
        let releaseLoad: (() => void) | undefined;
        const loadGate = new Promise<void>((/**
         * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         */
        function settlePromise63(resolve) { releaseLoad = resolve; }));
        vi.spyOn(repository, "get").mockImplementation((/**
         * 「worksheetId変更時に以前のNot Found状態をloadingへリセットする」で外部依存から返すactual・Getの結果を固定し、検証を決定的にする。
         *
         * @param id 対象を識別するID
         * @returns 「worksheetId変更時に以前のNot Found状態をloadingへリセットする」で外部依存から返すactual・Getの結果を固定し、検証を決定的にする処理の完了時に解決するPromise
         */
        async function mockImplementationCallback64(id) {
            if (id === worksheet.id)
                await loadGate;
            return actualGet(id);
        }));
        const view = renderEditor([`/worksheets/${missingId}`]);
        await screen.findByRole("heading", { name: "プリントが見つかりません" });
        await act((/**
         * 「worksheetId変更時に以前のNot Found状態をloadingへリセットする」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         * @returns 「worksheetId変更時に以前のNot Found状態をloadingへリセットする」で発生するReactの状態更新と副作用をまとめて完了させる処理の完了時に解決するPromise
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
 * エディタの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param initialEntries テスト用ルーターの初期URL一覧
 * @param initialIndex テスト用ルーターで最初に表示するURL位置
 * @returns テストで操作するレンダリング結果
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
 * エディタ・題名・Inputをfind・By・Roleで処理し、その結果を呼び出し元へ反映する。
 *
 * @returns エディタ・題名・Inputをfind・By・Roleで処理し、その結果を呼び出し元へ反映する処理の完了時に解決するPromise
 */
async function editorTitleInput(): Promise<HTMLInputElement> {
    return screen.findByRole("textbox", { name: "プリント題名" }, { timeout: TEST_TIMEOUT_MS }) as Promise<HTMLInputElement>;
}
/**
 * dispatch・Before・Unloadをdispatch・イベントで処理し、その結果を呼び出し元へ反映する。
 *
 * @returns イベントの既定・Preventedが真になる場合はtrue
 */
function dispatchBeforeUnload(): boolean {
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    return event.defaultPrevented;
}
/**
 * アセットを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param owner イベントの登録主体となるオブジェクト
 * @param byte 検証対象の1バイト
 * @returns 対象を一意に特定する識別子・プリント・Id・画像ファイルのMIME形式・検証または保存するバイナリデータ・要素または列へ適用する幅を持つオブジェクト
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
 * 現在の状態を基に現在・問題・一覧・Propsを導出する。
 *
 * @returns 問題・一覧・Harnessのコンポーネントへ渡す表示情報と操作
 */
function currentProblemListProps(): ProblemListProps {
    if (!problemListHarness.props)
        throw new Error("ProblemListが表示されていません");
    return problemListHarness.props;
}
/**
 * Promise・Gateを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns Promise・Gateを識別子・初期値・関連データが揃った新しい値として組み立てる処理の完了時に解決するPromise
 */
function createPromiseGate(): {
    promise: Promise<void>;
    release: () => void;
} {
    let release: () => void = (/**
     * 現在の状態を基にreleaseを導出する。
     */
    function releaseImplementation66() {
        return undefined;
    });
    const promise = new Promise<void>((/**
     * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
     *
     * @param resolve 非同期処理を正常完了させるPromise関数
     */
    function settlePromise67(resolve) { release = resolve; }));
    return { promise, release };
}
