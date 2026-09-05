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
const SAVE_DEBOUNCE_MS = 750;
const PREVIEW_DEBOUNCE_MS = 750;
type EditorLoadState = "loading" | "ready" | "notFound" | "error";
type EditorSessionIdentity = {
    worksheetId: string;
    sessionId: number;
};
/**
 * isCurrentEditorSessionで表される条件を判定する。
 *
 * @param state 更新前または現在の状態
 * @param expected expectedとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function isCurrentEditorSession(state: ReturnType<typeof useEditorStore.getState>, expected: EditorSessionIdentity): state is ReturnType<typeof useEditorStore.getState> & {
    worksheet: Worksheet;
} {
    return state.worksheet?.id === expected.worksheetId && state.sessionId === expected.sessionId;
}
/**
 * EditorScreenコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function EditorScreen(props: {
    repository?: WorksheetRepository;
}) {
    let { repository = worksheetRepository } = props;
    const { worksheetId } = useParams();
    const navigate = useNavigate();
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
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param change changeとして使用する値
     * @returns 呼び出し元で使用する処理結果
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
    const worksheet = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback2(state) {
        return state.worksheet;
    }));
    const sessionId = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback3(state) {
        return state.sessionId;
    }));
    const revision = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback4(state) {
        return state.revision;
    }));
    const saveStatus = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback5(state) {
        return state.saveStatus;
    }));
    const selectedProblemId = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback6(state) {
        return state.selectedProblemId;
    }));
    const undoStack = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback7(state) {
        return state.undoStack;
    }));
    const redoStack = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback8(state) {
        return state.redoStack;
    }));
    const initialize = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback9(state) {
        return state.initialize;
    }));
    const commit = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback10(state) {
        return state.commit;
    }));
    const mutate = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback11(state) {
        return state.mutate;
    }));
    const selectProblem = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback12(state) {
        return state.selectProblem;
    }));
    const undo = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback13(state) {
        return state.undo;
    }));
    const redo = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback14(state) {
        return state.redo;
    }));
    const markSaving = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback15(state) {
        return state.markSaving;
    }));
    const markSaved = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback16(state) {
        return state.markSaved;
    }));
    const markFailed = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback17(state) {
        return state.markFailed;
    }));
    const clear = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback18(state) {
        return state.clear;
    }));
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
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
         * 非同期処理が成功した結果を反映する。
         *
         * @param data 処理対象の値
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
             * 対象要素を結果へ残すか判定する。
             *
             * @param asset assetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function filterItem21(asset) {
                return referencedAssetIds.has(asset.id);
            }))
                .map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param asset assetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem22(asset) {
                return [asset.id, URL.createObjectURL(asset.blob)];
            })));
            setAssetUrls(urls);
            setLoadState("ready");
        })).catch((/**
         * 非同期処理で発生した失敗を処理する。
         */
        function handleRejectedValue23() { if (active)
            setLoadState("error"); }));
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback24() {
            active = false;
            clear();
        });
    }), [worksheetId, initialize, clear, repository, loadAttempt]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect25() { assetUrlsRef.current = assetUrls; }), [assetUrls]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect26() {
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback27() { assetUrlsRef.current.forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param url urlとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function processItem28(url) {
            return URL.revokeObjectURL(url);
        })); });
    }), []);
    const retainedAssetIds = useMemo((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue29() {
        return worksheet ? collectRetainedAssetIds(worksheet, [...undoStack, ...redoStack]) : new Set<string>();
    }), [worksheet, undoStack, redoStack]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect30() {
        // Object URLの保持対象は、編集履歴から参照されるアセットに合わせる。
        // oxlint-disable-next-line react/set-state-in-effect
        setAssetUrls((/**
         * setAssetUrlsへ渡す処理を実行する。
         *
         * @param current 更新前または現在の状態
         * @returns 呼び出し元で使用する処理結果
         */
        function setAssetUrlsCallback31(current) {
            return pruneAssetUrls(current, retainedAssetIds);
        }));
    }), [retainedAssetIds]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect32() {
        if (!worksheet || saveStatus !== "dirty" || pendingAssetOperationCount > 0)
            return;
        const request = { worksheetId: worksheet.id, sessionId, revision };
        const timer = window.setTimeout((/**
         * 指定時間後に必要な処理を実行する。
         *
         * @returns 非同期処理の結果
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
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback34() {
            return window.clearTimeout(timer);
        });
    }), [worksheet, sessionId, revision, saveStatus, retainedAssetIds, pendingAssetOperationCount, markSaving, markSaved, markFailed, repository]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect35() {
        const warnAboutUnsavedChanges = (/**
         * warnAboutUnsavedChangesに対応するイベントまたは通知を処理する。
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
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback37() {
            return window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
        });
    }), []);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect38() {
        if (!worksheet || previewWorksheet === worksheet)
            return;
        // 入力のたびに再改ページしないよう、プレビュー反映を意図的に遅延させる。
        // oxlint-disable-next-line react/set-state-in-effect
        setPreviewUpdating(true);
        const timer = window.setTimeout((/**
         * 指定時間後に必要な処理を実行する。
         */
        function handleScheduledTask39() {
            setPreviewWorksheet(worksheet);
            setPreviewUpdating(false);
        }), PREVIEW_DEBOUNCE_MS);
        return (/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback40() {
            return window.clearTimeout(timer);
        });
    }), [previewWorksheet, worksheet]);
    const worksheetForPreview = previewWorksheet ?? worksheet;
    const previewPageSize = worksheetForPreview?.pageSettings.size;
    useLayoutEffect((/**
     * 描画前にレイアウト依存の状態を同期する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeLayoutEffect41() {
        if (typeof preferences.zoom === "number" || !previewPageSize)
            return;
        const previewScroll = previewScrollRef.current;
        if (!previewScroll)
            return;
        const updateFittedZoom = (/**
         * updateFittedZoomの対象となる状態を更新する。
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
             * setFittedZoomへ渡す処理を実行する。
             *
             * @param current 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
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
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback44() {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateFittedZoom);
        });
    }), [preferences.zoom, previewPageSize]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect45() {
        const onKey = (/**
         * onKeyに対応するイベントまたは通知を処理する。
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
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback47() {
            return window.removeEventListener("keydown", onKey);
        });
    }), [undo, redo]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect48() {
        if (!dragging)
            return;
        const onMove = (/**
         * onMoveに対応するイベントまたは通知を処理する。
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
         * onUpに対応するイベントまたは通知を処理する。
         */
        function onUpImplementation50() { setDragging(false); saveUiPreferences(preferencesRef.current); });
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback51() { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); });
    }), [applyPreferenceChange, dragging]);
    const beginAssetOperation = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function createMemoizedCallback52() {
        let resolveOperation: () => void = (/**
         * resolveOperationで必要な値を取得する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function resolveOperationImplementation53() {
            return undefined;
        });
        const operation = new Promise<void>((/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @param resolve resolveとして使用する値
         */
        function commentRuleCallback54(resolve) { resolveOperation = resolve; }));
        pendingAssetOperationsRef.current.add(operation);
        setPendingAssetOperationCount(pendingAssetOperationsRef.current.size);
        let finished = false;
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback55() {
            if (finished)
                return;
            finished = true;
            pendingAssetOperationsRef.current.delete(operation);
            resolveOperation();
            setPendingAssetOperationCount(pendingAssetOperationsRef.current.size);
        });
    }), []);
    const waitForPendingAssetOperations = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @returns 非同期処理の結果
     */
    async function createMemoizedCallback56() {
        while (pendingAssetOperationsRef.current.size > 0) {
            await Promise.all(pendingAssetOperationsRef.current);
        }
    }), []);
    const flushSave = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param discardHistory discardHistoryとして使用する値
     * @returns 非同期処理の結果
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
    const shouldBlockNavigation = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function createMemoizedCallback58(parameter1: {
        currentLocation: {
            pathname: string;
        };
        nextLocation: {
            pathname: string;
        };
    }) {
        let { currentLocation, nextLocation } = parameter1;
        return (currentLocation.pathname !== nextLocation.pathname
            && (useEditorStore.getState().saveStatus !== "saved"
                || pendingAssetOperationsRef.current.size > 0));
    }), []);
    const navigationBlocker = useBlocker(shouldBlockNavigation);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect59() {
        if (navigationBlocker.state !== "blocked")
            return;
        let active = true;
        // 保留された画面遷移は、外部リポジトリへの保存完了を待ってから再開する。
        // oxlint-disable-next-line react/set-state-in-effect
        void flushSave(true).then((/**
         * 非同期処理が成功した結果を反映する。
         *
         * @param saved savedとして使用する値
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
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback61() { active = false; });
    }), [flushSave, navigationBlocker]);
    const backToList = (/**
     * backToListに対応する画面表示を更新する。
     */
    function backToListImplementation62() { void navigate("/"); });
    const updatePreferences = (/**
     * updatePreferencesの対象となる状態を更新する。
     *
     * @param change changeとして使用する値
     */
    function updatePreferencesImplementation63(change: Partial<typeof preferences>) {
        saveUiPreferences(applyPreferenceChange(change));
    });
    const numericZoom = typeof preferences.zoom === "number" ? preferences.zoom : fittedZoom;
    const syncPreviewScroll = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     */
    function createMemoizedCallback64() {
        const editorScroll = editingScrollRef.current;
        const previewScroll = previewScrollRef.current;
        if (editorScroll && previewScroll) {
            syncProblemScroll(editorScroll, previewScroll, preferences.previewMode);
        }
    }), [preferences.previewMode]);
    const schedulePreviewScrollSync = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
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
         * 次の描画タイミングで画面状態を更新する。
         */
        function handleAnimationFrame66() {
            scrollSyncFrameRef.current = null;
            syncPreviewScroll();
        }));
    }), [syncPreviewScroll]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
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
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback68() {
            editorScroll.removeEventListener("scroll", schedulePreviewScrollSync);
            resizeObserver?.disconnect();
        });
    }), [schedulePreviewScrollSync, worksheet?.id]);
    useLayoutEffect((/**
     * 描画前にレイアウト依存の状態を同期する。
     */
    function synchronizeLayoutEffect69() {
        if (worksheetForPreview)
            schedulePreviewScrollSync();
    }), [numericZoom, preferences.previewMode, schedulePreviewScrollSync, worksheetForPreview]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect70() {
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback71() {
            if (scrollSyncFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
                window.cancelAnimationFrame(scrollSyncFrameRef.current);
            }
        });
    }), []);
    const updateTitle = (/**
     * updateTitleの対象となる状態を更新する。
     *
     * @param value 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function updateTitleImplementation72(value: string) {
        return mutate("題名を変更", (/**
         * mutateへ渡す処理を実行する。
         *
         * @param draft draftとして使用する値
         */
        function mutateCallback73(draft) {
            const title = (value.trim() || "無題のプリント").slice(0, 100);
            draft.title = title;
            draft.header.title = title;
        }), { historyGroup: `text:${worksheet?.id ?? "unknown"}:title` });
    });
    const addImage = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param problemId 対象を識別するID
     * @param asset assetとして使用する値
     * @param placement placementとして使用する値
     * @param width widthとして使用する値
     * @param alt altとして使用する値
     * @param target targetとして使用する値
     * @returns 非同期処理の結果
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
         * applyImageの対象となる状態を更新する。
         *
         * @param source sourceとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function applyImageImplementation75(source: Worksheet) {
            return target
                ? updateRichTextDocument(source, problemId, target, (/**
                 * updateRichTextDocumentへ渡す処理を実行する。
                 *
                 * @param document documentとして使用する値
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
             * setAssetUrlsへ渡す処理を実行する。
             *
             * @param current 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
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
     * 依存値に応じて再利用する操作を作成する。
     *
     * @param problemId 対象を識別するID
     * @param imageId 対象を識別するID
     * @param asset assetとして使用する値
     * @param placement placementとして使用する値
     * @param width widthとして使用する値
     * @param alt altとして使用する値
     * @param target targetとして使用する値
     * @returns 非同期処理の結果
     */
    async function createMemoizedCallback78(problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) {
        const state = useEditorStore.getState();
        const currentWorksheet = state.worksheet;
        if (!currentWorksheet)
            return;
        const operationSession = { worksheetId: currentWorksheet.id, sessionId: state.sessionId };
        const applyUpdate = (/**
         * applyUpdateの対象となる状態を更新する。
         *
         * @param source sourceとして使用する値
         * @returns 呼び出し元で使用する処理結果
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
             * setAssetUrlsへ渡す処理を実行する。
             *
             * @param current 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
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
    if (loadState === "loading")
        return <div className="centered-state"><div className="spinner"/><p>プリントを読み込んでいます</p></div>;
    if (loadState === "notFound")
        return <div className="centered-state"><h1>プリントが見つかりません</h1><p>削除されたか、別のブラウザに保存されている可能性があります。</p><button className="primary-button" onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick81() {
            return navigate("/");
        })}>プリント一覧へ戻る</button></div>;
    if (loadState === "error" || !worksheet)
        return <div className="centered-state"><h1>プリントを読み込めませんでした</h1><p>一時的な問題が発生しました。もう一度お試しください。</p><button className="primary-button" onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick82() {
            return setLoadAttempt((/**
             * setLoadAttemptへ渡す処理を実行する。
             *
             * @param current 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setLoadAttemptCallback83(current) {
                return current + 1;
            }));
        })}>再読み込み</button><button className="secondary-button" onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick84() {
            return navigate("/");
        })}>プリント一覧へ戻る</button></div>;
    return <div className="editor-app">
    <header className="editor-header">
      <button className="secondary-button" onClick={backToList}><ArrowLeft size={17}/>一覧</button>
      <input className="title-input" aria-label="プリント題名" value={worksheet.title} maxLength={100} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange85(event) {
        return updateTitle(event.target.value);
    })} onBlur={(/**
     * onBlurで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleBlur86(event) { if (!event.target.value.trim())
        updateTitle("無題のプリント"); })}/>
      <SaveIndicator status={saveStatus} onRetry={(/**
     * onRetryで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleRetry87() {
        return void flushSave();
    })}/>
      <span className="header-spacer"/>
      <button className="icon-text-button" title="元に戻す (Ctrl+Z)" disabled={undoStack.length === 0} onClick={undo}><Undo2 size={17}/><span>元に戻す</span></button>
      <button className="icon-text-button" title="やり直す (Ctrl+Y)" disabled={redoStack.length === 0} onClick={redo}><Redo2 size={17}/><span>やり直す</span></button>
      <ManualContextLink topic="editorBasics" variant="icon"/>
      <button className="secondary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick88() {
        return setSettingsOpen(true);
    })}><Settings2 size={16}/>プリント設定</button>
      <button className="primary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 非同期処理の結果
     */
    async function handleClick89() { if (await flushSave())
        setPdfOpen(true); })}><FileDown size={16}/>PDF出力</button>
    </header>
    <div className="screen-width-warning"><h2>PCサイズの画面で利用してください</h2><p>プリントの編集には横幅1024px以上の画面が必要です。</p><button className="secondary-button" onClick={backToList}>一覧へ戻る</button></div>
    <div className="editor-workspace" ref={shellRef}>
      <section className="editing-pane" ref={editingScrollRef} style={{ width: `${preferences.paneRatio * 100}%` }}>
        <div className="pane-heading"><div><p className="eyebrow">WORKSHEET</p><h1>編集</h1></div><span>{worksheet.problems.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param problem problemとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem90(problem) {
        return problem.kind === "problem";
    })).length}問・{worksheet.problems.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param problem problemとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem91(problem) {
        return problem.kind === "example";
    })).length}例題</span></div>
        <div className="problem-list">
          <ProblemList assetUrls={assetUrls} onAddImage={addImage} onUpdateImage={updateImage} onToast={setToast}/>
        </div>
        <button className="add-problem-button" disabled={worksheet.problems.length >= 200} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick92() { const result = addProblem(worksheet, selectedProblemId); if (result.ok) {
        commit("問題を追加", result.worksheet);
        const selectedIndex = result.worksheet.problems.findIndex((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param problem problemとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItemIndex93(problem) {
            return problem.id === selectedProblemId;
        }));
        selectProblem(result.worksheet.problems[selectedIndex + 1]?.id ?? result.worksheet.problems.at(-1)?.id ?? null);
    } })}><Plus size={17}/>問題・例題を追加</button>
      </section>
      <div className={dragging ? "pane-divider dragging" : "pane-divider"} role="separator" aria-orientation="vertical" aria-valuemin={35} aria-valuemax={65} aria-valuenow={Math.round(preferences.paneRatio * 100)} tabIndex={0} onPointerDown={(/**
     * onPointerDownで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handlePointerDown94() {
        return setDragging(true);
    })} onKeyDown={(/**
     * onKeyDownで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDown95(event) { if (!["ArrowLeft", "ArrowRight"].includes(event.key))
        return; const step = event.shiftKey ? 0.1 : 0.02; const direction = event.key === "ArrowLeft" ? -1 : 1; updatePreferences({ paneRatio: Math.max(0.35, Math.min(0.65, preferences.paneRatio + step * direction)) }); })}><i /><i /><i /></div>
      <section className="preview-pane" style={{ width: `${(1 - preferences.paneRatio) * 100}%` }}>
        <div className="preview-toolbar"><div className="preview-heading"><strong>プレビュー</strong>{previewUpdating && <span className="updating">更新中…</span>}</div><select aria-label="プレビューモード" value={preferences.previewMode} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange96(event) {
        return updatePreferences({ previewMode: event.target.value as EditorPreviewMode });
    })}><option value="questions">問題のみ</option><option value="withAnswers">解答付き</option></select><div className="zoom-controls"><button className="icon-button" aria-label="縮小" disabled={numericZoom <= MIN_PREVIEW_ZOOM} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick97() {
        return updatePreferences({ zoom: getNextPreviewZoom(numericZoom, -1) });
    })}><Minus size={15}/></button><button className="zoom-value">{Math.round(numericZoom * 100)}%</button><button className="icon-button" aria-label="拡大" disabled={numericZoom >= MAX_PREVIEW_ZOOM} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick98() {
        return updatePreferences({ zoom: getNextPreviewZoom(numericZoom, 1) });
    })}><Plus size={15}/></button></div><button className={preferences.zoom === "fitWidth" ? "toolbar-text-button active" : "toolbar-text-button"} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick99() {
        return updatePreferences({ zoom: "fitWidth" });
    })}>幅に合わせる</button><button className={preferences.zoom === "fitPage" ? "toolbar-text-button active" : "toolbar-text-button"} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick100() {
        return updatePreferences({ zoom: "fitPage" });
    })}>ページ全体</button></div>
        <div className="preview-scroll" ref={previewScrollRef}><WorksheetPreview worksheet={worksheetForPreview ?? worksheet} mode={preferences.previewMode} zoom={numericZoom} assetUrls={assetUrls}/></div>
      </section>
    </div>
    {settingsOpen && <WorksheetSettingsDialog worksheet={worksheet} onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose101() {
        return setSettingsOpen(false);
    })} onApply={(/**
     * onApplyで発生した画面イベントを処理する。
     *
     * @param pageSettings pageSettingsとして使用する値
     * @param header headerとして使用する値
     */
    function handleApply102(pageSettings, header) { commit("プリント設定を適用", applyWorksheetSettings(worksheet, pageSettings, header)); setSettingsOpen(false); })}/>}
    {pdfOpen && <PdfDialog worksheet={worksheet} initialMode={preferences.previewMode} assetUrls={assetUrls} onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose103() {
        return setPdfOpen(false);
    })} onDone={setToast}/>}
    {toast && <Toast message={toast} onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose104() {
        return setToast(null);
    })}/>}
  </div>;
}
/**
 * toImageRefの入力値を必要な形式へ変換する。
 *
 * @param image imageとして使用する値
 * @param answerColor answerColorとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * SaveIndicatorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function SaveIndicator(props: {
    status: "saved" | "dirty" | "saving" | "failed";
    onRetry: () => void;
}) {
    let { status, onRetry } = props;
    const labels = { saved: "保存済み", dirty: "未保存", saving: "保存中…", failed: "保存できませんでした" };
    return <div className={`save-indicator ${status}`} aria-live="polite"><i />{labels[status]}{status === "failed" && <button onClick={onRetry}>再試行</button>}</div>;
}
/**
 * toPixelsの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function toPixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
