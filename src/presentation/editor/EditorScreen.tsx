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
import { loadUiPreferences, saveUiPreferences } from "../app/ui-preferences";
import { collectRetainedAssetIds, pruneAssetUrls } from "./editor-assets";
import { createSaveRequest, useEditorStore } from "./editor-store";
import { syncProblemScroll } from "./problem-scroll-sync";
import { ProblemList } from "./ProblemList";

const SAVE_DEBOUNCE_MS = 750;

export function EditorScreen({ repository = worksheetRepository }: { repository?: WorksheetRepository }) {
  const { worksheetId } = useParams();
  const navigate = useNavigate();
  const shellRef = useRef<HTMLDivElement>(null);
  const editingScrollRef = useRef<HTMLElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const assetUrlsRef = useRef<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Map<string, string>>(new Map());
  const [preferences, setPreferences] = useState(loadUiPreferences);
  const [fittedZoom, setFittedZoom] = useState(1);
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [previewWorksheet, setPreviewWorksheet] = useState<Worksheet | null>(null);

  const worksheet = useEditorStore((state) => state.worksheet);
  const sessionId = useEditorStore((state) => state.sessionId);
  const revision = useEditorStore((state) => state.revision);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const selectedProblemId = useEditorStore((state) => state.selectedProblemId);
  const undoStack = useEditorStore((state) => state.undoStack);
  const redoStack = useEditorStore((state) => state.redoStack);
  const initialize = useEditorStore((state) => state.initialize);
  const commit = useEditorStore((state) => state.commit);
  const mutate = useEditorStore((state) => state.mutate);
  const selectProblem = useEditorStore((state) => state.selectProblem);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const markSaving = useEditorStore((state) => state.markSaving);
  const markSaved = useEditorStore((state) => state.markSaved);
  const markFailed = useEditorStore((state) => state.markFailed);
  const clear = useEditorStore((state) => state.clear);

  useEffect(() => {
    if (!worksheetId) return;
    let active = true;
    void repository.get(worksheetId).then((data) => {
      if (!active) return;
      if (!data || data.worksheet.deletedAt !== null) { setNotFound(true); setLoading(false); return; }
      initialize(data.worksheet);
      setPreviewWorksheet(data.worksheet);
      const referencedAssetIds = collectRetainedAssetIds(data.worksheet, []);
      const urls = new Map(data.assets
        .filter((asset) => referencedAssetIds.has(asset.id))
        .map((asset) => [asset.id, URL.createObjectURL(asset.blob)]));
      setAssetUrls(urls);
      setLoading(false);
    }).catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    return () => {
      active = false;
      clear();
    };
  }, [worksheetId, initialize, clear, repository]);

  useEffect(() => { assetUrlsRef.current = assetUrls; }, [assetUrls]);
  useEffect(() => () => { assetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const retainedAssetIds = useMemo(
    () => worksheet ? collectRetainedAssetIds(worksheet, [...undoStack, ...redoStack]) : new Set<string>(),
    [worksheet, undoStack, redoStack],
  );

  useEffect(() => {
    setAssetUrls((current) => pruneAssetUrls(current, retainedAssetIds));
  }, [retainedAssetIds]);

  useEffect(() => {
    if (!worksheet || saveStatus !== "dirty") return;
    const request = { worksheetId: worksheet.id, sessionId, revision };
    const timer = window.setTimeout(async () => {
      markSaving(request);
      try {
        await repository.save(worksheet, {
          pruneUnreferencedAssets: true,
          retainedAssetIds,
        });
        markSaved(request);
      }
      catch { markFailed(request); }
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [worksheet, sessionId, revision, saveStatus, retainedAssetIds, markSaving, markSaved, markFailed, repository]);

  useEffect(() => {
    if (saveStatus === "saved") return;
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnAboutUnsavedChanges);
    return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
  }, [saveStatus]);

  useEffect(() => {
    if (!worksheet || previewWorksheet === worksheet) return;
    setPreviewUpdating(true);
    const timer = window.setTimeout(() => {
      setPreviewWorksheet(worksheet);
      setPreviewUpdating(false);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [previewWorksheet, worksheet]);

  const worksheetForPreview = previewWorksheet ?? worksheet;

  useLayoutEffect(() => {
    if (typeof preferences.zoom === "number" || !worksheetForPreview) return;
    const previewScroll = previewScrollRef.current;
    if (!previewScroll) return;

    const updateFittedZoom = () => {
      const style = getComputedStyle(previewScroll);
      const pageSize = PAGE_SIZES_MM[worksheetForPreview.pageSettings.size];
      const nextZoom = calculateFittedPreviewZoom({
        mode: preferences.zoom as "fitWidth" | "fitPage",
        viewportWidth: previewScroll.clientWidth,
        viewportHeight: previewScroll.clientHeight,
        horizontalPadding: toPixels(style.paddingLeft) + toPixels(style.paddingRight),
        verticalPadding: toPixels(style.paddingTop) + toPixels(style.paddingBottom),
        pageAspectRatio: pageSize.height / pageSize.width,
      });
      setFittedZoom((current) => Math.abs(current - nextZoom) < 0.001 ? current : nextZoom);
    };

    updateFittedZoom();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateFittedZoom);
    resizeObserver?.observe(previewScroll);
    window.addEventListener("resize", updateFittedZoom);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFittedZoom);
    };
  }, [preferences.zoom, worksheetForPreview?.pageSettings.size]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,[contenteditable='true']")) return;
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const bounds = shellRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const ratio = Math.max(0.35, Math.min(0.65, (event.clientX - bounds.left) / bounds.width));
      setPreferences((current) => ({ ...current, paneRatio: ratio }));
    };
    const onUp = () => { setDragging(false); setPreferences((current) => { saveUiPreferences(current); return current; }); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragging]);

  const flushSave = useCallback(async (discardHistory = false) => {
    while (true) {
      const state = useEditorStore.getState();
      if (!state.worksheet || (state.saveStatus === "saved" && !discardHistory)) return true;
      const request = createSaveRequest(state);
      if (!request) return true;
      state.markSaving(request);
      try {
        await repository.save(state.worksheet, {
          pruneUnreferencedAssets: true,
          ...(discardHistory ? {} : {
            retainedAssetIds: collectRetainedAssetIds(
              state.worksheet,
              [...state.undoStack, ...state.redoStack],
            ),
          }),
        });
        state.markSaved(request);
        const latest = useEditorStore.getState();
        if (
          latest.worksheet?.id !== request.worksheetId
          || latest.sessionId !== request.sessionId
          || (latest.revision === request.revision && latest.saveStatus === "saved")
        ) return true;
      } catch {
        state.markFailed(request);
        setToast("保存できませんでした。ブラウザの空き容量を確認してください。");
        return false;
      }
    }
  }, [repository]);

  const shouldBlockNavigation = useCallback(({ currentLocation, nextLocation }: {
    currentLocation: { pathname: string };
    nextLocation: { pathname: string };
  }) => (
    currentLocation.pathname !== nextLocation.pathname
    && useEditorStore.getState().saveStatus !== "saved"
  ), []);
  const navigationBlocker = useBlocker(shouldBlockNavigation);

  useEffect(() => {
    if (navigationBlocker.state !== "blocked") return;
    let active = true;
    void flushSave(true).then((saved) => {
      if (!active) return;
      if (saved) navigationBlocker.proceed();
      else navigationBlocker.reset();
    });
    return () => { active = false; };
  }, [flushSave, navigationBlocker]);

  const backToList = () => { void navigate("/"); };
  const updatePreferences = (change: Partial<typeof preferences>) => {
    const next = { ...preferences, ...change };
    setPreferences(next); saveUiPreferences(next);
  };
  const numericZoom = typeof preferences.zoom === "number" ? preferences.zoom : fittedZoom;
  const syncPreviewScroll = useCallback(() => {
    const editorScroll = editingScrollRef.current;
    const previewScroll = previewScrollRef.current;
    if (editorScroll && previewScroll) {
      syncProblemScroll(editorScroll, previewScroll, preferences.previewMode);
    }
  }, [preferences.previewMode]);
  const schedulePreviewScrollSync = useCallback(() => {
    if (scrollSyncFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(scrollSyncFrameRef.current);
    }
    if (typeof window.requestAnimationFrame !== "function") {
      scrollSyncFrameRef.current = null;
      syncPreviewScroll();
      return;
    }
    scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
      scrollSyncFrameRef.current = null;
      syncPreviewScroll();
    });
  }, [syncPreviewScroll]);

  useEffect(() => {
    const editorScroll = editingScrollRef.current;
    const previewScroll = previewScrollRef.current;
    if (!editorScroll || !previewScroll) return;

    editorScroll.addEventListener("scroll", schedulePreviewScrollSync, { passive: true });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePreviewScrollSync);
    resizeObserver?.observe(editorScroll);
    resizeObserver?.observe(previewScroll);
    const problemList = editorScroll.querySelector<HTMLElement>(".problem-list");
    const previewPages = previewScroll.querySelector<HTMLElement>(".preview-pages");
    if (problemList) resizeObserver?.observe(problemList);
    if (previewPages) resizeObserver?.observe(previewPages);
    schedulePreviewScrollSync();

    return () => {
      editorScroll.removeEventListener("scroll", schedulePreviewScrollSync);
      resizeObserver?.disconnect();
    };
  }, [schedulePreviewScrollSync, worksheet?.id]);

  useLayoutEffect(() => {
    if (worksheetForPreview) schedulePreviewScrollSync();
  }, [numericZoom, preferences.previewMode, schedulePreviewScrollSync, worksheetForPreview]);

  useEffect(() => () => {
    if (scrollSyncFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(scrollSyncFrameRef.current);
    }
  }, []);

  const updateTitle = (value: string) => mutate("題名を変更", (draft) => {
    const title = (value.trim() || "無題のプリント").slice(0, 100);
    draft.title = title;
    draft.header.title = title;
  }, { historyGroup: `text:${worksheet?.id ?? "unknown"}:title` });

  const addImage = useCallback(async (problemId: string, asset: AssetRecord, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => {
    const state = useEditorStore.getState();
    const currentWorksheet = state.worksheet;
    if (!currentWorksheet) return;
    let image: ImageBlock;
    if (placement === "block") {
      image = { id: createId(), type: "image", assetId: asset.id, alt, placement, widthPercent: width };
    } else if (placement === "floatLeft") {
      image = { id: createId(), type: "image", assetId: asset.id, alt, placement, widthPercent: Math.min(width, 50) as 25 | 33 | 50 };
    } else {
      image = { id: createId(), type: "image", assetId: asset.id, alt, placement, widthPercent: Math.min(width, 50) as 25 | 33 | 50 };
    }
    const result = target
      ? updateRichTextDocument(currentWorksheet, problemId, target, (document) => {
        document.content.push(toImageRef(image, target.kind !== "solution" && target.color === "answer"));
      })
      : addContent(currentWorksheet, problemId, image, state.selectedContentId);
    if (!result.ok) { setToast("画像を追加できませんでした"); return; }
    try {
      await repository.putAsset(asset, result.worksheet);
      state.commit("画像を挿入", result.worksheet);
      state.selectContent(target ? (target.kind === "content" ? target.contentId : target.kind === "subQuestion" ? target.groupId : null) : image.id);
      setAssetUrls((current) => new Map(current).set(asset.id, URL.createObjectURL(asset.blob)));
    } catch { setToast("画像を保存できませんでした"); }
  }, [repository]);

  const updateImage = useCallback(async (problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => {
    const state = useEditorStore.getState();
    const currentWorksheet = state.worksheet;
    if (!currentWorksheet) return;
    const result = updateImageReference(currentWorksheet, problemId, imageId, target ?? null, {
      ...(asset ? { assetId: asset.id } : {}),
      alt,
      placement,
      widthPercent: width,
    });
    if (!result.ok) { setToast("画像を更新できませんでした"); return; }
    try {
      if (asset) {
        await repository.putAsset(asset, result.worksheet);
        setAssetUrls((current) => new Map(current).set(asset.id, URL.createObjectURL(asset.blob)));
      }
      state.commit(asset ? "画像を差し替え" : "画像の設定を変更", result.worksheet);
    } catch { setToast("画像を保存できませんでした"); }
  }, [repository]);

  if (loading) return <div className="centered-state"><div className="spinner" /><p>プリントを読み込んでいます</p></div>;
  if (notFound || !worksheet) return <div className="centered-state"><h1>プリントが見つかりません</h1><p>削除されたか、別のブラウザに保存されている可能性があります。</p><button className="primary-button" onClick={() => navigate("/")}>プリント一覧へ戻る</button></div>;

  return <div className="editor-app">
    <header className="editor-header">
      <button className="secondary-button" onClick={backToList}><ArrowLeft size={17} />一覧</button>
      <input className="title-input" aria-label="プリント題名" value={worksheet.title} maxLength={100} onChange={(event) => updateTitle(event.target.value)} onBlur={(event) => { if (!event.target.value.trim()) updateTitle("無題のプリント"); }} />
      <SaveIndicator status={saveStatus} onRetry={() => void flushSave()} />
      <span className="header-spacer" />
      <button className="icon-text-button" title="元に戻す (Ctrl+Z)" disabled={undoStack.length === 0} onClick={undo}><Undo2 size={17} /><span>元に戻す</span></button>
      <button className="icon-text-button" title="やり直す (Ctrl+Y)" disabled={redoStack.length === 0} onClick={redo}><Redo2 size={17} /><span>やり直す</span></button>
      <ManualContextLink topic="editorBasics" variant="icon" />
      <button className="secondary-button" onClick={() => setSettingsOpen(true)}><Settings2 size={16} />プリント設定</button>
      <button className="primary-button" onClick={async () => { if (await flushSave()) setPdfOpen(true); }}><FileDown size={16} />PDF出力</button>
    </header>
    <div className="screen-width-warning"><h2>PCサイズの画面で利用してください</h2><p>プリントの編集には横幅1024px以上の画面が必要です。</p><button className="secondary-button" onClick={backToList}>一覧へ戻る</button></div>
    <div className="editor-workspace" ref={shellRef}>
      <section className="editing-pane" ref={editingScrollRef} style={{ width: `${preferences.paneRatio * 100}%` }}>
        <div className="pane-heading"><div><p className="eyebrow">WORKSHEET</p><h1>編集</h1></div><span>{worksheet.problems.filter((problem) => problem.kind === "problem").length}問・{worksheet.problems.filter((problem) => problem.kind === "example").length}例題</span></div>
        <div className="problem-list">
          <ProblemList assetUrls={assetUrls} onAddImage={addImage} onUpdateImage={updateImage} onToast={setToast} />
        </div>
        <button className="add-problem-button" disabled={worksheet.problems.length >= 200} onClick={() => { const result = addProblem(worksheet, selectedProblemId); if (result.ok) { commit("問題を追加", result.worksheet); const selectedIndex = result.worksheet.problems.findIndex((problem) => problem.id === selectedProblemId); selectProblem(result.worksheet.problems[selectedIndex + 1]?.id ?? result.worksheet.problems.at(-1)?.id ?? null); } }}><Plus size={17} />問題・例題を追加</button>
      </section>
      <div className={dragging ? "pane-divider dragging" : "pane-divider"} role="separator" aria-orientation="vertical" aria-valuemin={35} aria-valuemax={65} aria-valuenow={Math.round(preferences.paneRatio * 100)} tabIndex={0} onPointerDown={() => setDragging(true)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; const step = event.shiftKey ? 0.1 : 0.02; const direction = event.key === "ArrowLeft" ? -1 : 1; updatePreferences({ paneRatio: Math.max(0.35, Math.min(0.65, preferences.paneRatio + step * direction)) }); }}><i /><i /><i /></div>
      <section className="preview-pane" style={{ width: `${(1 - preferences.paneRatio) * 100}%` }}>
        <div className="preview-toolbar"><div className="preview-heading"><strong>プレビュー</strong>{previewUpdating && <span className="updating">更新中…</span>}</div><select aria-label="プレビューモード" value={preferences.previewMode} onChange={(event) => updatePreferences({ previewMode: event.target.value as EditorPreviewMode })}><option value="questions">問題のみ</option><option value="withAnswers">解答付き</option></select><div className="zoom-controls"><button className="icon-button" aria-label="縮小" disabled={numericZoom <= MIN_PREVIEW_ZOOM} onClick={() => updatePreferences({ zoom: getNextPreviewZoom(numericZoom, -1) })}><Minus size={15} /></button><button className="zoom-value">{Math.round(numericZoom * 100)}%</button><button className="icon-button" aria-label="拡大" disabled={numericZoom >= MAX_PREVIEW_ZOOM} onClick={() => updatePreferences({ zoom: getNextPreviewZoom(numericZoom, 1) })}><Plus size={15} /></button></div><button className={preferences.zoom === "fitWidth" ? "toolbar-text-button active" : "toolbar-text-button"} onClick={() => updatePreferences({ zoom: "fitWidth" })}>幅に合わせる</button><button className={preferences.zoom === "fitPage" ? "toolbar-text-button active" : "toolbar-text-button"} onClick={() => updatePreferences({ zoom: "fitPage" })}>ページ全体</button></div>
        <div className="preview-scroll" ref={previewScrollRef}><WorksheetPreview worksheet={worksheetForPreview ?? worksheet} mode={preferences.previewMode} zoom={numericZoom} assetUrls={assetUrls} /></div>
      </section>
    </div>
    {settingsOpen && <WorksheetSettingsDialog worksheet={worksheet} onClose={() => setSettingsOpen(false)} onApply={(pageSettings, header) => { commit("プリント設定を適用", applyWorksheetSettings(worksheet, pageSettings, header)); setSettingsOpen(false); }} />}
    {pdfOpen && <PdfDialog worksheet={worksheet} initialMode={preferences.previewMode} assetUrls={assetUrls} onClose={() => setPdfOpen(false)} onDone={setToast} />}
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </div>;
}

function toImageRef(image: ImageBlock, answerColor = false): Extract<RichTextNode, { type: "imageRef" }> {
  if (image.placement === "block") {
    return { type: "imageRef", attrs: { id: image.id, assetId: image.assetId, alt: image.alt, placement: image.placement, widthPercent: image.widthPercent, answerColor } };
  }
  if (image.placement === "floatLeft") {
    return { type: "imageRef", attrs: { id: image.id, assetId: image.assetId, alt: image.alt, placement: image.placement, widthPercent: image.widthPercent, answerColor } };
  }
  return { type: "imageRef", attrs: { id: image.id, assetId: image.assetId, alt: image.alt, placement: image.placement, widthPercent: image.widthPercent, answerColor } };
}

function SaveIndicator({ status, onRetry }: { status: "saved" | "dirty" | "saving" | "failed"; onRetry: () => void }) {
  const labels = { saved: "保存済み", dirty: "未保存", saving: "保存中…", failed: "保存できませんでした" };
  return <div className={`save-indicator ${status}`} aria-live="polite"><i />{labels[status]}{status === "failed" && <button onClick={onRetry}>再試行</button>}</div>;
}

function toPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
