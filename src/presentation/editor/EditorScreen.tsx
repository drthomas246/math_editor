import { ArrowLeft, FileDown, Minus, Plus, Redo2, Settings2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import type { EditorPreviewMode } from "../../application/pdf/generate-pdf";
import type { WorksheetRepository } from "../../application/repositories/worksheet-repository";
import { PAGE_SIZES_MM } from "../../domain/worksheet/page-tokens";
import type { AssetRecord, ImageBlock, ImagePlacement, ImageWidthPercent, RichTextNode, Worksheet } from "../../domain/worksheet/worksheet";
import { addContent, addProblem, applyWorksheetSettings, updateImageReference, updateRichTextDocument, type RichTextDocumentTarget } from "../../domain/worksheet/worksheet.commands";
import { createId } from "../../domain/worksheet/worksheet.defaults";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { Toast } from "../components/Toast";
import { ManualContextLink } from "../components/ManualContextLink";
import { PdfDialog, WorksheetSettingsDialog } from "../dialogs/EditorDialogs";
import { calculateFittedPreviewZoom, getNextPreviewZoom, MAX_PREVIEW_ZOOM, MIN_PREVIEW_ZOOM } from "../preview/preview-zoom";
import { WorksheetPreview } from "../preview/WorksheetPreview";
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from "../app/ui-preferences";
import { collectRetainedAssetIds, pruneAssetUrls } from "./editor-assets";
import { createSaveRequest, useEditorStore } from "./editor-store";
import { syncProblemScroll } from "./problem-scroll-sync";
import { ProblemList } from "./ProblemList";

// --------------------
// 定数と型定義
// --------------------

const SAVE_DEBOUNCE_MS = 750;
const PREVIEW_DEBOUNCE_MS = 750;
type EditorLoadState = "loading" | "ready" | "notFound" | "error";
type EditorSessionIdentity = {
    worksheetId: string;
    sessionId: number;
};
type EditorScreenProps = {
    repository?: WorksheetRepository;
};
type SaveIndicatorProps = {
    status: "saved" | "dirty" | "saving" | "failed";
    onRetry: () => void;
};
/**
 * 非同期処理の結果を現在開いているプリントへ安全に反映できるか、プリントIDとセッションIDで判定する。
 *
 * @param state 判定時点のエディタストア
 * @param expected 非同期処理を開始した時点のプリントIDとセッションID
 * @returns 同じプリントを同じ編集セッションで開いている場合はtrue
 */
function isCurrentEditorSession(state: ReturnType<typeof useEditorStore.getState>, expected: EditorSessionIdentity): state is ReturnType<typeof useEditorStore.getState> & {
    worksheet: Worksheet;
} {
    return state.worksheet?.id === expected.worksheetId && state.sessionId === expected.sessionId;
}
/**
 * プリントの読み込み・編集・自動保存・画像管理・プレビュー・PDF出力を統括する編集画面を表示する。
 *
 * @param props データの読み込みと保存に使用するリポジトリ
 * @returns プリント編集画面
 */
export function EditorScreen(props: EditorScreenProps) {
    let { repository = worksheetRepository } = props;
    const { worksheetId } = useParams();
    const navigate = useNavigate();

    // --------------------
    // 状態と参照
    // --------------------

    const shellRef = useRef<HTMLDivElement>(null);
    const editingScrollRef = useRef<HTMLElement>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const scrollSyncFrameRef = useRef<number | null>(null);
    const assetUrlsRef = useRef<Map<string, string>>(new Map());
    const pendingAssetOperationsRef = useRef<Set<Promise<void>>>(new Set());
    const [loadState, setLoadState] = useState<EditorLoadState>("loading");
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [pdfOpen, setPdfOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [assetUrls, setAssetUrls] = useState<Map<string, string>>(new Map());
    const [preferences, setPreferences] = useState(loadUiPreferences);
    const preferencesRef = useRef(preferences);
    const applyPreferenceChange = useCallback((/**
     * 画面設定を最新値へ統合し、StateとRefを同時に更新する。
     *
     * @param change 適用する編集内容
     * @returns 適用候補となる次の値
     */
    function createMemoizedCallback1(change: Partial<UiPreferences>) {
        const next = { ...preferencesRef.current, ...change };
        preferencesRef.current = next;
        setPreferences(next);
        return next;
    }), []);
    const [fittedZoom, setFittedZoom] = useState(1);
    const [previewUpdating, setPreviewUpdating] = useState(false);
    const [previewWorksheet, setPreviewWorksheet] = useState<Worksheet | null>(null);
    const [pendingAssetOperationCount, setPendingAssetOperationCount] = useState(0);

    // --------------------
    // ストア
    // --------------------

    const worksheet = useEditorStore((/**
     * エディタストアから編集中のプリントを購読する。
     *
     * @param state 更新前または現在の状態
     * @returns 編集中のプリント。未読込の場合はnull
     */
    function useEditorStoreCallback2(state) {
        return state.worksheet;
    }));
    const sessionId = useEditorStore((/**
     * 非同期結果が現在の編集画面向けか判定するため、セッションIDを購読する。
     *
     * @param state 更新前または現在の状態
     * @returns 現在の編集セッションID
     */
    function useEditorStoreCallback3(state) {
        return state.sessionId;
    }));
    const revision = useEditorStore((/**
     * 自動保存の対象を識別するため、編集内容の版番号を購読する。
     *
     * @param state 更新前または現在の状態
     * @returns 現在の編集内容の版番号
     */
    function useEditorStoreCallback4(state) {
        return state.revision;
    }));
    const saveStatus = useEditorStore((/**
     * 自動保存の実行と画面表示に使用する保存状態を購読する。
     *
     * @param state 更新前または現在の状態
     * @returns 現在の保存状態
     */
    function useEditorStoreCallback5(state) {
        return state.saveStatus;
    }));
    const selectedProblemId = useEditorStore((/**
     * 問題追加位置とスクロール同期に使用する選択中の問題IDを購読する。
     *
     * @param state 更新前または現在の状態
     * @returns 選択中の問題ID
     */
    function useEditorStoreCallback6(state) {
        return state.selectedProblemId;
    }));
    const undoStack = useEditorStore((/**
     * Undo操作と画像URL保持判定に使用する履歴を購読する。
     *
     * @param state 更新前または現在の状態
     * @returns Undo可能な編集履歴
     */
    function useEditorStoreCallback7(state) {
        return state.undoStack;
    }));
    const redoStack = useEditorStore((/**
     * Redo操作と画像URL保持判定に使用する履歴を購読する。
     *
     * @param state 更新前または現在の状態
     * @returns Redo可能な編集履歴
     */
    function useEditorStoreCallback8(state) {
        return state.redoStack;
    }));
    const initialize = useEditorStore((/**
     * 読み込んだプリントで編集セッションを初期化する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 編集セッションを初期化する関数
     */
    function useEditorStoreCallback9(state) {
        return state.initialize;
    }));
    const commit = useEditorStore((/**
     * Undo履歴を記録しながらプリントを確定更新する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 編集結果を確定する関数
     */
    function useEditorStoreCallback10(state) {
        return state.commit;
    }));
    const mutate = useEditorStore((/**
     * Immerを使ってプリントを更新する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns プリントへ変更を適用する関数
     */
    function useEditorStoreCallback11(state) {
        return state.mutate;
    }));
    const selectProblem = useEditorStore((/**
     * 編集対象の問題を切り替える操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 問題を選択する関数
     */
    function useEditorStoreCallback12(state) {
        return state.selectProblem;
    }));
    const undo = useEditorStore((/**
     * 直前の編集を取り消す操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns Undoを実行する関数
     */
    function useEditorStoreCallback13(state) {
        return state.undo;
    }));
    const redo = useEditorStore((/**
     * 取り消した編集をやり直す操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns Redoを実行する関数
     */
    function useEditorStoreCallback14(state) {
        return state.redo;
    }));
    const markSaving = useEditorStore((/**
     * 対象版の保存開始を記録する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 保存中状態へ移行する関数
     */
    function useEditorStoreCallback15(state) {
        return state.markSaving;
    }));
    const markSaved = useEditorStore((/**
     * 対象版の保存成功を記録する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 保存済み状態へ移行する関数
     */
    function useEditorStoreCallback16(state) {
        return state.markSaved;
    }));
    const markFailed = useEditorStore((/**
     * 対象版の保存失敗を記録する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 保存失敗状態へ移行する関数
     */
    function useEditorStoreCallback17(state) {
        return state.markFailed;
    }));
    const clear = useEditorStore((/**
     * 画面離脱時に編集セッションを破棄する操作を取得する。
     *
     * @param state 更新前または現在の状態
     * @returns 編集セッションを破棄する関数
     */
    function useEditorStoreCallback18(state) {
        return state.clear;
    }));

    // --------------------
    // 読み込み処理
    // --------------------

    useEffect((/**
     * URLで指定されたプリントと参照画像を読み込み、現在の編集セッションを初期化する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect19() {
        // 画面遷移時にコンポーネントの状態を外部リポジトリと同期する。
        // oxlint-disable-next-line react/set-state-in-effect
        setLoadState("loading");
        setPreviewWorksheet(null);
        if (!worksheetId) {
            setLoadState("notFound");
            return;
        }
        let active = true;
        void repository.get(worksheetId).then((/**
         * 読み込んだプリントと参照画像を、現在有効な編集画面へ反映する。
         *
         * @param data リポジトリから取得したプリントと画像。対象がなければnull
         */
        function handleResolvedValue20(data) {
            if (!active)
                return;
            if (!data || data.worksheet.deletedAt !== null) {
                setLoadState("notFound");
                return;
            }
            initialize(data.worksheet);
            setPreviewWorksheet(data.worksheet);
            const referencedAssetIds = collectRetainedAssetIds(data.worksheet, []);
            const urls = new Map(data.assets
                .filter((/**
             * 現在のプリントまたは編集履歴から参照される画像だけを残す。
             *
             * @param asset 処理対象の画像アセット
             * @returns 画像IDが保持対象に含まれる場合はtrue
             */
            function filterItem21(asset) {
                return referencedAssetIds.has(asset.id);
            }))
                .map((/**
             * 画像アセットを、表示時に参照するIDとObject URLの組へ変換する。
             *
             * @param asset 処理対象の画像アセット
             * @returns 画像IDと生成したObject URLの組
             */
            function mapItem22(asset) {
                return [asset.id, URL.createObjectURL(asset.blob)];
            })));
            setAssetUrls(urls);
            setLoadState("ready");
        })).catch((/**
         * 読み込みに失敗したことを画面へ表示する。
         */
        function handleRejectedValue23() { if (active)
            setLoadState("error"); }));
        return (/**
         * 古い読み込み結果の反映を止め、編集ストアを破棄する。
         */
        function releaseResources24() {
            active = false;
            clear();
        });
    }), [worksheetId, initialize, clear, repository, loadAttempt]);
    useEffect((/**
     * 非同期画像処理が常に最新のObject URL対応表を参照できるようRefを同期する。
     */
    function synchronizeEffect25() { assetUrlsRef.current = assetUrls; }), [assetUrls]);
    useEffect((/**
     * コンポーネント破棄時に作成済みの画像Object URLをすべて解放する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect26() {
        return (/**
         * コンポーネントが生成したすべてのObject URLを解放する。
         */
        function releaseResources27() { assetUrlsRef.current.forEach((/**
         * ブラウザー内に保持された画像Blobを解放するためObject URLを破棄する。
         *
         * @param url 安全性の検証または解放を行うURL
         */
        function processItem28(url) {
            return URL.revokeObjectURL(url);
        })); });
    }), []);
    // --------------------
    // アセット管理
    // --------------------

    const retainedAssetIds = useMemo((/**
     * 現在のプリントとUndo・Redo履歴から、保持が必要な画像IDを集める。
     *
     * @returns 現在または履歴から参照される画像IDの集合
     */
    function calculateMemoizedValue29() {
        return worksheet ? collectRetainedAssetIds(worksheet, [...undoStack, ...redoStack]) : new Set<string>();
    }), [worksheet, undoStack, redoStack]);
    useEffect((/**
     * 編集履歴から参照されなくなった画像のObject URLを破棄する。
     */
    function synchronizeEffect30() {
        // Object URLの保持対象は、編集履歴から参照されるアセットに合わせる。
        // oxlint-disable-next-line react/set-state-in-effect
        setAssetUrls((/**
         * 保持対象だけを残した画像URLの対応表を作る。
         *
         * @param current 更新前または現在の状態
         * @returns 不要なObject URLを除外した新しい対応表
         */
        function setAssetUrlsCallback31(current) {
            return pruneAssetUrls(current, retainedAssetIds);
        }));
    }), [retainedAssetIds]);
    useEffect((/**
     * 編集が落ち着き画像操作も完了した時点で、最新プリントと参照画像を自動保存する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect32() {
        if (!worksheet || saveStatus !== "dirty" || pendingAssetOperationCount > 0)
            return;
        const request = { worksheetId: worksheet.id, sessionId, revision };
        const timer = window.setTimeout((/**
         * 連続操作が落ち着いてから、保留中の保存または表示更新を実行する。
         *
         * @returns 連続操作が落ち着くまで待ってから、保留中の保存または表示更新を実行する処理の完了時に解決するPromise
         */
        async function handleScheduledTask33() {
            if (pendingAssetOperationsRef.current.size > 0)
                return;
            markSaving(request);
            try {
                await repository.save(worksheet, {
                    pruneUnreferencedAssets: true,
                    retainedAssetIds,
                });
                markSaved(request);
            }
            catch {
                markFailed(request);
            }
        }), SAVE_DEBOUNCE_MS);
        return (/**
         * 再実行時に古い予約処理が残らないよう、保留中のタイマーを解除する。
         *
         */
        function applyDeferredOperation34() {
            return window.clearTimeout(timer);
        });
    }), [worksheet, sessionId, revision, saveStatus, retainedAssetIds, pendingAssetOperationCount, markSaving, markSaved, markFailed, repository]);
    useEffect((/**
     * 未保存の編集または画像操作が残る間だけ、タブを閉じる操作へ確認を要求する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect35() {
        const warnAboutUnsavedChanges = (/**
         * 未保存の編集または画像保存が残っている場合、タブを閉じる前に確認を要求する。
         *
         * @param event 発生したイベント
         */
        function warnAboutUnsavedChangesImplementation36(event: BeforeUnloadEvent) {
            if (useEditorStore.getState().saveStatus === "saved"
                && pendingAssetOperationsRef.current.size === 0)
                return;
            event.preventDefault();
            event.returnValue = "";
        });
        window.addEventListener("beforeunload", warnAboutUnsavedChanges);
        return (/**
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources37() {
            return window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
        });
    }), []);
    useEffect((/**
     * 連続編集が落ち着いてから最新プリントをプレビューへ渡し、再描画負荷を抑える。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect38() {
        if (!worksheet || previewWorksheet === worksheet)
            return;
        // 入力のたびに再改ページしないよう、プレビュー反映を意図的に遅延させる。
        // oxlint-disable-next-line react/set-state-in-effect
        setPreviewUpdating(true);
        const timer = window.setTimeout((/**
         * 遅延中の最新プリントをプレビューへ反映し、更新中表示を終了する。
         */
        function handleScheduledTask39() {
            setPreviewWorksheet(worksheet);
            setPreviewUpdating(false);
        }), PREVIEW_DEBOUNCE_MS);
        return (/**
         * 再実行時に古い予約処理が残らないよう、保留中のタイマーを解除する。
         *
         */
        function applyDeferredOperation40() {
            return window.clearTimeout(timer);
        });
    }), [previewWorksheet, worksheet]);
    const worksheetForPreview = previewWorksheet ?? worksheet;
    const previewPageSize = worksheetForPreview?.pageSettings.size;
    useLayoutEffect((/**
     * プレビュー領域の幅変更を監視し、指定方法に応じた表示倍率を再計算する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeLayoutEffect41() {
        if (typeof preferences.zoom === "number" || !previewPageSize)
            return;
        const previewScroll = previewScrollRef.current;
        if (!previewScroll)
            return;
        const updateFittedZoom = (/**
         * プレビュー領域と用紙比率から、収まりのよい表示倍率を再計算する。
         */
        function updateFittedZoomImplementation42() {
            const style = getComputedStyle(previewScroll);
            const pageSize = PAGE_SIZES_MM[previewPageSize];
            const nextZoom = calculateFittedPreviewZoom({
                mode: preferences.zoom as "fitWidth" | "fitPage",
                viewportWidth: previewScroll.clientWidth,
                viewportHeight: previewScroll.clientHeight,
                horizontalPadding: toPixels(style.paddingLeft) + toPixels(style.paddingRight),
                verticalPadding: toPixels(style.paddingTop) + toPixels(style.paddingBottom),
                pageAspectRatio: pageSize.height / pageSize.width,
            });
            setFittedZoom((/**
             * 微小な差では再描画せず、実質的に変化した表示倍率だけを反映する。
             *
             * @param current 更新前または現在の状態
             * @returns 差が十分に大きい場合は新しい倍率、それ以外は現在の倍率
             */
            function setFittedZoomCallback43(current) {
                return Math.abs(current - nextZoom) < 0.001 ? current : nextZoom;
            }));
        });
        updateFittedZoom();
        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateFittedZoom);
        resizeObserver?.observe(previewScroll);
        window.addEventListener("resize", updateFittedZoom);
        return (/**
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources44() {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateFittedZoom);
        });
    }), [preferences.zoom, previewPageSize]);
    useEffect((/**
     * 入力欄以外でのCtrl+ZとCtrl+Yを、エディタ全体のUndo・Redoへ割り当てる。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect45() {
        const onKey = (/**
         * テキスト入力を妨げない範囲で、キーボードショートカットによるUndo・Redoを処理する。
         *
         * @param event 発生したイベント
         */
        function onKeyImplementation46(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            if (target.closest("input,textarea,[contenteditable='true']"))
                return;
            if (event.ctrlKey && event.key.toLowerCase() === "z") {
                event.preventDefault();
                if (event.shiftKey)
                    redo();
                else
                    undo();
            }
            if (event.ctrlKey && event.key.toLowerCase() === "y") {
                event.preventDefault();
                redo();
            }
        });
        window.addEventListener("keydown", onKey);
        return (/**
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources47() {
            return window.removeEventListener("keydown", onKey);
        });
    }), [undo, redo]);
    useEffect((/**
     * ペイン境界のドラッグ中だけポインターを追跡し、終了時に表示設定を保存する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect48() {
        if (!dragging)
            return;
        const onMove = (/**
         * ポインター位置から編集ペインの幅比率を求め、許容範囲内で更新する。
         *
         * @param event 発生したイベント
         */
        function onMoveImplementation49(event: PointerEvent) {
            const bounds = shellRef.current?.getBoundingClientRect();
            if (!bounds)
                return;
            const ratio = Math.max(0.35, Math.min(0.65, (event.clientX - bounds.left) / bounds.width));
            applyPreferenceChange({ paneRatio: ratio });
        });
        const onUp = (/**
         * ドラッグを終了し、確定したペイン幅を次回表示用に保存する。
         */
        function onUpImplementation50() { setDragging(false); saveUiPreferences(preferencesRef.current); });
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return (/**
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources51() { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); });
    }), [applyPreferenceChange, dragging]);
    // --------------------
    // 画像処理
    // --------------------

    const beginAssetOperation = useCallback((/**
     * 画像保存Promiseを保留一覧へ登録し、完了時に一覧と処理中件数から除外する。
     *
     * @returns 呼び出し元が後で実行する関数
     */
    function createMemoizedCallback52() {
        let resolveOperation: () => void = (/**
         * Promise生成前に完了関数を保持するための初期値を用意する。
         */
        function resolveOperationImplementation53() {
            return undefined;
        });
        const operation = new Promise<void>((/**
         * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
         *
         * @param resolve 非同期処理を正常完了させるPromise関数
         */
        function settlePromise54(resolve) { resolveOperation = resolve; }));
        pendingAssetOperationsRef.current.add(operation);
        setPendingAssetOperationCount(pendingAssetOperationsRef.current.size);
        let finished = false;
        return (/**
         * 画像保存を一度だけ完了扱いにし、待機中の保存処理を再開できるようにする。
         */
        function applyDeferredOperation55() {
            if (finished)
                return;
            finished = true;
            pendingAssetOperationsRef.current.delete(operation);
            resolveOperation();
            setPendingAssetOperationCount(pendingAssetOperationsRef.current.size);
        });
    }), []);
    const waitForPendingAssetOperations = useCallback((/**
     * 実行中の画像保存がすべて完了するまで、最新の保留Promise群を待機する。
     *
      * @returns すべての画像保存が完了したときに解決するPromise
     */
    async function createMemoizedCallback56() {
        while (pendingAssetOperationsRef.current.size > 0) {
            await Promise.all(pendingAssetOperationsRef.current);
        }
    }), []);
    // --------------------
    // 保存処理
    // --------------------

    const flushSave = useCallback((/**
     * 最新の編集内容と参照画像を保存し、成功時だけ保存済み状態へ進める。
     *
     * @param discardHistory 編集履歴を破棄するかどうか
     * @returns 最新版の保存に成功した場合はtrue、失敗した場合はfalse
     */
    async function createMemoizedCallback57(discardHistory = false) {
        await waitForPendingAssetOperations();
        while (true) {
            const state = useEditorStore.getState();
            if (!state.worksheet || (state.saveStatus === "saved" && !discardHistory))
                return true;
            const request = createSaveRequest(state);
            if (!request)
                return true;
            state.markSaving(request);
            try {
                await repository.save(state.worksheet, {
                    pruneUnreferencedAssets: true,
                    ...(discardHistory ? {} : {
                        retainedAssetIds: collectRetainedAssetIds(state.worksheet, [...state.undoStack, ...state.redoStack]),
                    }),
                });
                state.markSaved(request);
                const latest = useEditorStore.getState();
                if (latest.worksheet?.id !== request.worksheetId
                    || latest.sessionId !== request.sessionId
                    || (latest.revision === request.revision && latest.saveStatus === "saved"))
                    return true;
            }
            catch {
                state.markFailed(request);
                setToast("保存できませんでした。ブラウザの空き容量を確認してください。");
                return false;
            }
        }
    }), [repository, waitForPendingAssetOperations]);
    // --------------------
    // 画面遷移
    // --------------------

    const shouldBlockNavigation = useCallback((/**
     * 保存先が変わる画面遷移だけを、未保存データがある間保留する。
     *
     * @param callbackInput 現在地と遷移先のURL情報
     * @returns 別画面へ移動し、かつ未保存処理が残る場合はtrue
     */
    function createMemoizedCallback58(callbackInput: {
        currentLocation: {
            pathname: string;
        };
        nextLocation: {
            pathname: string;
        };
    }) {
        let { currentLocation, nextLocation } = callbackInput;
        return (currentLocation.pathname !== nextLocation.pathname
            && (useEditorStore.getState().saveStatus !== "saved"
                || pendingAssetOperationsRef.current.size > 0));
    }), []);
    const navigationBlocker = useBlocker(shouldBlockNavigation);
    useEffect((/**
     * 未保存状態で発生した画面遷移を保留し、保存完了後だけ遷移を再開する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect59() {
        if (navigationBlocker.state !== "blocked")
            return;
        let active = true;
        // 保留された画面遷移は、外部リポジトリへの保存完了を待ってから再開する。
        // oxlint-disable-next-line react/set-state-in-effect
        void flushSave(true).then((/**
         * 保存結果に応じて、保留中の画面遷移を再開または取り消す。
         *
         * @param saved 最新の編集内容を保存できたかどうか
         */
        function handleResolvedValue60(saved) {
            if (!active)
                return;
            if (saved)
                navigationBlocker.proceed();
            else
                navigationBlocker.reset();
        }));
        return (/**
         * Effect終了後に保存結果が古い画面遷移へ反映されないよう無効化する。
         */
        function releaseResources61() { active = false; });
    }), [flushSave, navigationBlocker]);
    const backToList = (/**
     * プリント一覧画面へ戻る。
     */
    function backToListImplementation62() { void navigate("/"); });
    const updatePreferences = (/**
     * 表示設定を更新し、ブラウザーへ保存する。
     *
     * @param change 適用する編集内容
     */
    function updatePreferencesImplementation63(change: Partial<typeof preferences>) {
        saveUiPreferences(applyPreferenceChange(change));
    });
    const numericZoom = typeof preferences.zoom === "number" ? preferences.zoom : fittedZoom;
    // --------------------
    // スクロール同期
    // --------------------

    const syncPreviewScroll = useCallback((/**
     * 編集位置に対応するプレビュー内の問題を求め、スクロール位置を同期する。
     */
    function createMemoizedCallback64() {
        const editorScroll = editingScrollRef.current;
        const previewScroll = previewScrollRef.current;
        if (editorScroll && previewScroll) {
            syncProblemScroll(editorScroll, previewScroll, preferences.previewMode);
        }
    }), [preferences.previewMode]);
    const schedulePreviewScrollSync = useCallback((/**
     * スクロール同期を次の描画フレームへ集約し、同一フレーム内の重複実行を避ける。
     */
    function createMemoizedCallback65() {
        if (scrollSyncFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(scrollSyncFrameRef.current);
        }
        if (typeof window.requestAnimationFrame !== "function") {
            scrollSyncFrameRef.current = null;
            syncPreviewScroll();
            return;
        }
        scrollSyncFrameRef.current = window.requestAnimationFrame((/**
         * ブラウザーが直前のレイアウト変更を描画した次のフレームで処理を再開する。
         */
        function handleAnimationFrame66() {
            scrollSyncFrameRef.current = null;
            syncPreviewScroll();
        }));
    }), [syncPreviewScroll]);
    useEffect((/**
     * 編集側のスクロールと両ペインのサイズ変更を監視し、対応する問題をプレビューへ同期する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect67() {
        const editorScroll = editingScrollRef.current;
        const previewScroll = previewScrollRef.current;
        if (!editorScroll || !previewScroll)
            return;
        editorScroll.addEventListener("scroll", schedulePreviewScrollSync, { passive: true });
        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePreviewScrollSync);
        resizeObserver?.observe(editorScroll);
        resizeObserver?.observe(previewScroll);
        const problemList = editorScroll.querySelector<HTMLElement>(".problem-list");
        const previewPages = previewScroll.querySelector<HTMLElement>(".preview-pages");
        if (problemList)
            resizeObserver?.observe(problemList);
        if (previewPages)
            resizeObserver?.observe(previewPages);
        schedulePreviewScrollSync();
        return (/**
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources68() {
            editorScroll.removeEventListener("scroll", schedulePreviewScrollSync);
            resizeObserver?.disconnect();
        });
    }), [schedulePreviewScrollSync, worksheet?.id]);
    useLayoutEffect((/**
     * プレビュー内容や倍率が変わった直後に、選択中の問題へスクロール位置を合わせ直す。
     */
    function synchronizeLayoutEffect69() {
        if (worksheetForPreview)
            schedulePreviewScrollSync();
    }), [numericZoom, preferences.previewMode, schedulePreviewScrollSync, worksheetForPreview]);
    useEffect((/**
     * コンポーネント破棄時に保留中のスクロール同期フレームを取り消す。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect70() {
        return (/**
         * 破棄後にスクロール位置を書き換えないよう、予約済みフレームを取り消す。
         */
        function applyDeferredOperation71() {
            if (scrollSyncFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
                window.cancelAnimationFrame(scrollSyncFrameRef.current);
            }
        });
    }), []);
    // --------------------
    // イベント処理
    // --------------------

    const updateTitle = (/**
     * 空白と最大長を正規化し、プリント題名とヘッダー題名を同時に更新する。
     *
     * @param value 入力されたプリント題名
     */
    function updateTitleImplementation72(value: string) {
        return mutate("題名を変更", (/**
         * Immerが提供する更新中の状態の題名をプリントまたはテストへ設定する題名へ更新する。
         *
         * @param draft Immerが提供する更新中の状態
         */
        function mutateCallback73(draft) {
            const title = (value.trim() || "無題のプリント").slice(0, 100);
            draft.title = title;
            draft.header.title = title;
        }), { historyGroup: `text:${worksheet?.id ?? "unknown"}:title` });
    });
    const addImage = useCallback((/**
     * 追加画像を保存し、開始時と同じ編集セッションへ画像参照を挿入する。
     *
     * @param problemId 対象を識別するID
     * @param asset 処理対象の画像アセット
     * @param placement 画像を本文の前後どちらへ置くかの指定
     * @param width 要素または列へ適用する幅
     * @param alt 画像の代替テキスト
     * @param target 編集操作を適用する対象
      * @returns 追加画像を保存し、開始時と同じ編集セッションへ画像参照を挿入する処理の完了時に解決するPromise
     */
    async function createMemoizedCallback74(problemId: string, asset: AssetRecord, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) {
        const state = useEditorStore.getState();
        const currentWorksheet = state.worksheet;
        if (!currentWorksheet)
            return;
        const operationSession = { worksheetId: currentWorksheet.id, sessionId: state.sessionId };
        const afterContentId = state.selectedContentId;
        let image: ImageBlock;
        if (placement === "block") {
            image = { id: createId(), type: "image", assetId: asset.id, alt, placement, widthPercent: width };
        }
        else if (placement === "floatLeft") {
            image = { id: createId(), type: "image", assetId: asset.id, alt, placement, widthPercent: Math.min(width, 50) as 25 | 33 | 50 };
        }
        else {
            image = { id: createId(), type: "image", assetId: asset.id, alt, placement, widthPercent: Math.min(width, 50) as 25 | 33 | 50 };
        }
        const applyImage = (/**
         * 追加先に応じて、画像をリッチテキスト文書または問題内容へ挿入する。
         *
         * @param source 画像を挿入するプリント
         * @returns 挿入結果。対象が見つからない場合は失敗結果
         */
        function applyImageImplementation75(source: Worksheet) {
            return target
                ? updateRichTextDocument(source, problemId, target, (/**
                 * 更新対象のリッチテキスト文書末尾へ画像参照を追加する。
                 *
                 * @param document 処理対象のリッチテキスト文書
                 */
                function updateRichTextDocumentCallback76(document) {
                    document.content.push(toImageRef(image, target.kind !== "solution" && target.color === "answer"));
                }))
                : addContent(source, problemId, image, afterContentId);
        });
        const result = applyImage(currentWorksheet);
        if (!result.ok) {
            setToast("画像を追加できませんでした");
            return;
        }
        const finishAssetOperation = beginAssetOperation();
        try {
            await repository.putAsset(asset, result.worksheet);
            const latest = useEditorStore.getState();
            if (!isCurrentEditorSession(latest, operationSession))
                return;
            const rebasedResult = applyImage(latest.worksheet);
            if (!rebasedResult.ok) {
                setToast("画像を追加できませんでした");
                return;
            }
            latest.commit("画像を挿入", rebasedResult.worksheet);
            latest.selectContent(target ? (target.kind === "content" ? target.contentId : target.kind === "subQuestion" ? target.groupId : null) : image.id);
            setAssetUrls((/**
             * 保存した画像を直ちに表示できるようObject URLを登録する。
             *
             * @param current 更新前または現在の状態
             * @returns 追加画像のURLを含む新しい対応表
             */
            function setAssetUrlsCallback77(current) {
                return new Map(current).set(asset.id, URL.createObjectURL(asset.blob));
            }));
        }
        catch {
            if (isCurrentEditorSession(useEditorStore.getState(), operationSession)) {
                setToast("画像を保存できませんでした");
            }
        }
        finally {
            finishAssetOperation();
        }
    }), [beginAssetOperation, repository]);
    const updateImage = useCallback((/**
     * 差し替えた画像アセットを保存し、開始時と同じ編集セッションへ参照更新を反映する。
     *
     * @param problemId 対象を識別するID
     * @param imageId 対象を識別するID
     * @param asset 処理対象の画像アセット
     * @param placement 画像を本文の前後どちらへ置くかの指定
     * @param width 要素または列へ適用する幅
     * @param alt 画像の代替テキスト
     * @param target 編集操作を適用する対象
      * @returns 差し替えた画像アセットを保存し、開始時と同じ編集セッションへ参照更新を反映する処理の完了時に解決するPromise
     */
    async function createMemoizedCallback78(problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) {
        const state = useEditorStore.getState();
        const currentWorksheet = state.worksheet;
        if (!currentWorksheet)
            return;
        const operationSession = { worksheetId: currentWorksheet.id, sessionId: state.sessionId };
        const applyUpdate = (/**
         * 指定した画像参照の配置・幅・代替テキスト・アセットIDを更新する。
         *
         * @param source 画像参照を更新するプリント
         * @returns 更新結果。対象が見つからない場合は失敗結果
         */
        function applyUpdateImplementation79(source: Worksheet) {
            return updateImageReference(source, problemId, imageId, target ?? null, {
                ...(asset ? { assetId: asset.id } : {}),
                alt,
                placement,
                widthPercent: width,
            });
        });
        const result = applyUpdate(currentWorksheet);
        if (!result.ok) {
            setToast("画像を更新できませんでした");
            return;
        }
        if (!asset) {
            state.commit("画像の設定を変更", result.worksheet);
            return;
        }
        const finishAssetOperation = beginAssetOperation();
        try {
            await repository.putAsset(asset, result.worksheet);
            const latest = useEditorStore.getState();
            if (!isCurrentEditorSession(latest, operationSession))
                return;
            const rebasedResult = applyUpdate(latest.worksheet);
            if (!rebasedResult.ok) {
                setToast("画像を更新できませんでした");
                return;
            }
            latest.commit("画像を差し替え", rebasedResult.worksheet);
            setAssetUrls((/**
             * 差し替えた画像を直ちに表示できるようObject URLを登録する。
             *
             * @param current 更新前または現在の状態
             * @returns 差し替え画像のURLを含む新しい対応表
             */
            function setAssetUrlsCallback80(current) {
                return new Map(current).set(asset.id, URL.createObjectURL(asset.blob));
            }));
        }
        catch {
            if (isCurrentEditorSession(useEditorStore.getState(), operationSession)) {
                setToast("画像を保存できませんでした");
            }
        }
        finally {
            finishAssetOperation();
        }
    }), [beginAssetOperation, repository]);
    // --------------------
    // 画面表示
    // --------------------

    if (loadState === "loading")
        return <div className="centered-state"><div className="spinner"/><p>プリントを読み込んでいます</p></div>;
    if (loadState === "notFound")
        return <div className="centered-state"><h1>プリントが見つかりません</h1><p>削除されたか、別のブラウザに保存されている可能性があります。</p><button className="primary-button" onClick={(/**
         * 「プリント一覧へ戻る」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
         *
         */
        function handleClick81() {
            return navigate("/");
        })}>プリント一覧へ戻る</button></div>;
    if (loadState === "error" || !worksheet)
        return <div className="centered-state"><h1>プリントを読み込めませんでした</h1><p>一時的な問題が発生しました。もう一度お試しください。</p><button className="primary-button" onClick={(/**
         * 読み込み処理を再実行するため試行回数を進める。
         */
        function handleClick82() {
            return setLoadAttempt((/**
             * Effectの再実行を促すため読み込み試行回数を1つ進める。
             *
             * @param current 更新前または現在の状態
             * @returns 更新前の値と1を加算した値
             */
            function setLoadAttemptCallback83(current) {
                return current + 1;
            }));
        })}>再読み込み</button><button className="secondary-button" onClick={(/**
         * 「プリント一覧へ戻る」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
         *
         */
        function handleClick84() {
            return navigate("/");
        })}>プリント一覧へ戻る</button></div>;
    return <div className="editor-app">
    <header className="editor-header">
      <button className="secondary-button" onClick={backToList}><ArrowLeft size={17}/>一覧</button>
      <input className="title-input" aria-label="プリント題名" value={worksheet.title} maxLength={100} onChange={(/**
     * 入力された題名をプリントとヘッダーへ反映する。
     *
     * @param event 発生したイベント
     */
    function handleChange85(event) {
        return updateTitle(event.target.value);
    })} onBlur={(/**
     * 題名欄が空のままフォーカスを失った場合、既定の題名へ戻す。
     *
     * @param event 発生したイベント
     */
    function handleBlur86(event) { if (!event.target.value.trim())
        updateTitle("無題のプリント"); })}/>
      <SaveIndicator status={saveStatus} onRetry={(/**
     * 自動保存の失敗後に、最新内容の保存を再試行する。
     *
     */
    function handleRetry87() {
        return void flushSave();
    })}/>
      <span className="header-spacer"/>
      <button className="icon-text-button" title="元に戻す (Ctrl+Z)" disabled={undoStack.length === 0} onClick={undo}><Undo2 size={17}/><span>元に戻す</span></button>
      <button className="icon-text-button" title="やり直す (Ctrl+Y)" disabled={redoStack.length === 0} onClick={redo}><Redo2 size={17}/><span>やり直す</span></button>
      <ManualContextLink topic="editorBasics" variant="icon"/>
      <button className="secondary-button" onClick={(/**
     * 「プリント設定」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick88() {
        return setSettingsOpen(true);
    })}><Settings2 size={16}/>プリント設定</button>
      <button className="primary-button" onClick={(/**
     * 「PDF出力」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     * @returns 「PDF出力」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する処理の完了時に解決するPromise
     */
    async function handleClick89() { if (await flushSave())
        setPdfOpen(true); })}><FileDown size={16}/>PDF出力</button>
    </header>
    <div className="screen-width-warning"><h2>PCサイズの画面で利用してください</h2><p>プリントの編集には横幅1024px以上の画面が必要です。</p><button className="secondary-button" onClick={backToList}>一覧へ戻る</button></div>
    <div className="editor-workspace" ref={shellRef}>
      <section className="editing-pane" ref={editingScrollRef} style={{ width: `${preferences.paneRatio * 100}%` }}>
        <div className="pane-heading"><div><p className="eyebrow">WORKSHEET</p><h1>編集</h1></div><span>{worksheet.problems.filter((/**
     * 処理対象の問題または例題の問題または例題の種別が「problem」と一致する要素だけを後続処理へ残す。
     *
     * @param problem 処理対象の問題または例題
     * @returns 処理対象の問題または例題の問題または例題の種別が「problem」と一致する場合はtrue
     */
    function filterItem90(problem) {
        return problem.kind === "problem";
    })).length}問・{worksheet.problems.filter((/**
     * 処理対象の問題または例題の問題または例題の種別が「example」と一致する要素だけを後続処理へ残す。
     *
     * @param problem 処理対象の問題または例題
     * @returns 処理対象の問題または例題の問題または例題の種別が「example」と一致する場合はtrue
     */
    function filterItem91(problem) {
        return problem.kind === "example";
    })).length}例題</span></div>
        <div className="problem-list">
          <ProblemList assetUrls={assetUrls} onAddImage={addImage} onUpdateImage={updateImage} onToast={setToast}/>
        </div>
        <button className="add-problem-button" disabled={worksheet.problems.length >= 200} onClick={(/**
     * 選択中の項目の次へ問題を追加し、新しい問題を選択する。
     */
    function handleClick92() { const result = addProblem(worksheet, selectedProblemId); if (result.ok) {
        commit("問題を追加", result.worksheet);
        const selectedIndex = result.worksheet.problems.findIndex((/**
         * 各処理対象の問題または例題が探している位置の要素か判定する。
         *
         * @param problem 処理対象の問題または例題
         * @returns 処理対象の問題または例題の対象を一意に特定する識別子が選択中の問題の識別子と一致する場合はtrue
         */
        function findItemIndex93(problem) {
            return problem.id === selectedProblemId;
        }));
        selectProblem(result.worksheet.problems[selectedIndex + 1]?.id ?? result.worksheet.problems.at(-1)?.id ?? null);
    } })}><Plus size={17}/>問題・例題を追加</button>
      </section>
      <div className={dragging ? "pane-divider dragging" : "pane-divider"} role="separator" aria-orientation="vertical" aria-valuemin={35} aria-valuemax={65} aria-valuenow={Math.round(preferences.paneRatio * 100)} tabIndex={0} onPointerDown={(/**
     * div要素から画面操作を受け、Draggingを操作内容に合う状態へ更新する。
     */
    function handlePointerDown94() {
        return setDragging(true);
    })} onKeyDown={(/**
     * 画面要素からキーボード操作を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDown95(event) { if (!["ArrowLeft", "ArrowRight"].includes(event.key))
        return; const step = event.shiftKey ? 0.1 : 0.02; const direction = event.key === "ArrowLeft" ? -1 : 1; updatePreferences({ paneRatio: Math.max(0.35, Math.min(0.65, preferences.paneRatio + step * direction)) }); })}><i /><i /><i /></div>
      <section className="preview-pane" style={{ width: `${(1 - preferences.paneRatio) * 100}%` }}>
        <div className="preview-toolbar"><div className="preview-heading"><strong>プレビュー</strong>{previewUpdating && <span className="updating">更新中…</span>}</div><select aria-label="プレビューモード" value={preferences.previewMode} onChange={(/**
     * 問題のみ／解答付きのプレビューモードを切り替える。
     *
     * @param event 発生したイベント
     */
    function handleChange96(event) {
        return updatePreferences({ previewMode: event.target.value as EditorPreviewMode });
    })}><option value="questions">問題のみ</option><option value="withAnswers">解答付き</option></select><div className="zoom-controls"><button className="icon-button" aria-label="縮小" disabled={numericZoom <= MIN_PREVIEW_ZOOM} onClick={(/**
     * プレビュー倍率を1段階縮小する。
     *
     */
    function handleClick97() {
        return updatePreferences({ zoom: getNextPreviewZoom(numericZoom, -1) });
    })}><Minus size={15}/></button><button className="zoom-value">{Math.round(numericZoom * 100)}%</button><button className="icon-button" aria-label="拡大" disabled={numericZoom >= MAX_PREVIEW_ZOOM} onClick={(/**
     * プレビュー倍率を1段階拡大する。
     *
     */
    function handleClick98() {
        return updatePreferences({ zoom: getNextPreviewZoom(numericZoom, 1) });
    })}><Plus size={15}/></button></div><button className={preferences.zoom === "fitWidth" ? "toolbar-text-button active" : "toolbar-text-button"} onClick={(/**
     * 「幅に合わせる」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick99() {
        return updatePreferences({ zoom: "fitWidth" });
    })}>幅に合わせる</button><button className={preferences.zoom === "fitPage" ? "toolbar-text-button active" : "toolbar-text-button"} onClick={(/**
     * 「ページ全体」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick100() {
        return updatePreferences({ zoom: "fitPage" });
    })}>ページ全体</button></div>
        <div className="preview-scroll" ref={previewScrollRef}><WorksheetPreview worksheet={worksheetForPreview ?? worksheet} mode={preferences.previewMode} zoom={numericZoom} assetUrls={assetUrls}/></div>
      </section>
    </div>
    {settingsOpen && <WorksheetSettingsDialog worksheet={worksheet} onClose={(/**
     * プリント設定ダイアログを閉じる。
     */
    function handleClose101() {
        return setSettingsOpen(false);
    })} onApply={(/**
     * 画面要素から設定の適用要求を受け、対応する編集状態と画面表示を更新する。
     *
     * @param pageSettings 用紙サイズと余白を含むページ設定
     * @param header プリントへ適用するヘッダー設定
     */
    function handleApply102(pageSettings, header) { commit("プリント設定を適用", applyWorksheetSettings(worksheet, pageSettings, header)); setSettingsOpen(false); })}/>}
    {pdfOpen && <PdfDialog worksheet={worksheet} initialMode={preferences.previewMode} assetUrls={assetUrls} onClose={(/**
     * PDF出力ダイアログを閉じる。
     */
    function handleClose103() {
        return setPdfOpen(false);
    })} onDone={setToast}/>}
    {toast && <Toast message={toast} onClose={(/**
     * Toast要素から終了要求を受け、Toastを操作内容に合う状態へ更新する。
     */
    function handleClose104() {
        return setToast(null);
    })}/>}
  </div>;
}
// --------------------
// 補助関数
// --------------------

/**
 * 問題内の画像をリッチテキスト文書で使用する画像参照へ変換する。
 *
 * @param image 表示または編集する画像
 * @param answerColor 解答へ適用する文字色
 * @returns 元画像の属性と解答色設定を持つ画像参照ノード
 */
function toImageRef(image: ImageBlock, answerColor = false): Extract<RichTextNode, {
    type: "imageRef";
}> {
    if (image.placement === "block") {
        return { type: "imageRef", attrs: { id: image.id, assetId: image.assetId, alt: image.alt, placement: image.placement, widthPercent: image.widthPercent, answerColor } };
    }
    if (image.placement === "floatLeft") {
        return { type: "imageRef", attrs: { id: image.id, assetId: image.assetId, alt: image.alt, placement: image.placement, widthPercent: image.widthPercent, answerColor } };
    }
    return { type: "imageRef", attrs: { id: image.id, assetId: image.assetId, alt: image.alt, placement: image.placement, widthPercent: image.widthPercent, answerColor } };
}
/**
 * 自動保存の待機・実行・成功・失敗状態を表示し、失敗時は再試行操作を提供する。
 *
 * @param props 保存状態と再試行処理
 * @returns 保存状態と必要に応じた再試行ボタン
 */
function SaveIndicator(props: SaveIndicatorProps) {
    let { status, onRetry } = props;
    const labels = { saved: "保存済み", dirty: "未保存", saving: "保存中…", failed: "保存できませんでした" };
    return <div className={`save-indicator ${status}`} aria-live="polite"><i />{labels[status]}{status === "failed" && <button onClick={onRetry}>再試行</button>}</div>;
}
/**
 * CSSの寸法文字列をレイアウト計算で扱えるピクセル数へ変換する。
 *
 * @param value CSSから取得した寸法文字列
 * @returns 解析できた数値。解析できない場合は0
 */
function toPixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
