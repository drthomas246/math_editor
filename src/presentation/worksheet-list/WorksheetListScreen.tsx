import {
  ArchiveRestore,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileUp,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  assertBackupInputSize,
  createArchiveBackup,
  createSingleBackup,
  hydrateBackup,
  parseBackup,
  serializeBackup,
} from "../../application/backup/backup";
import { STRUCTURE_LIMITS } from "../../domain/worksheet/structure-limits";
import type { AssetRecord, MathWorksheetFile, Worksheet } from "../../domain/worksheet/worksheet";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import { normalizeSearchKey } from "../../domain/worksheet/worksheet.search";
import {
  localTimestamp,
  prepareJsonTextDownload,
  sanitizeFileNamePart,
  type PreparedDownload,
} from "../../infrastructure/file/download";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { database } from "../../infrastructure/indexeddb/database";
import { Modal } from "../components/Modal";
import { ManualContextLink } from "../components/ManualContextLink";
import { Toast } from "../components/Toast";
import { useOutsidePointerDown } from "../components/useOutsidePointerDown";

const PAGE_SIZE = 50;

type ListError = {
  kind: "load" | "operation";
  title: string;
  message: string;
};

type PendingListOperation =
  | { kind: "trash"; worksheetId: string }
  | { kind: "restore"; worksheetId: string };

export function WorksheetListScreen() {
  const navigate = useNavigate();
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ListError | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worksheet | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [preparedDownload, setPreparedDownload] = useState<PreparedDownload | null>(null);
  const [toast, setToast] = useState<{ message: string; worksheet?: Worksheet } | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingListOperation | null>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);

  useOutsidePointerDown(openMenuRef, openMenu !== null, () => setOpenMenu(null));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await worksheetRepository.list();
      setWorksheets(result.worksheets);
      setInvalidCount(result.invalidCount);
    } catch (reason) {
      setError({ kind: "load", title: "一覧を読み込めませんでした", message: failureMessage(reason, "一覧を読み込めませんでした") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loading on mount intentionally synchronizes this screen with IndexedDB.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const active = useMemo(() => worksheets
    .filter((worksheet) => worksheet.deletedAt === null)
    .filter((worksheet) => normalizeSearchKey(worksheet.title).includes(normalizeSearchKey(debouncedQuery)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)), [worksheets, debouncedQuery]);
  const trashCount = worksheets.filter((worksheet) => worksheet.deletedAt !== null).length;
  const totalPages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = active.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const atLimit = worksheets.length >= STRUCTURE_LIMITS.worksheetsPerArchive;

  const createNew = async () => {
    const worksheet = createWorksheet();
    try {
      await worksheetRepository.create({ worksheet, assets: [] });
      await navigate(`/worksheets/${worksheet.id}`);
    } catch (reason) {
      setError({ kind: "operation", title: "プリントを作成できませんでした", message: failureMessage(reason, "プリントを作成できませんでした") });
    }
  };

  const duplicate = async (worksheet: Worksheet) => {
    setOpenMenu(null);
    try {
      await worksheetRepository.duplicate(worksheet.id);
      await load();
      setToast({ message: "プリントを複製しました" });
    } catch (reason) {
      setError({ kind: "operation", title: "プリントを複製できませんでした", message: failureMessage(reason, "プリントを複製できませんでした") });
    }
  };

  const exportSingle = async (worksheet: Worksheet) => {
    setOpenMenu(null);
    try {
      const data = await worksheetRepository.get(worksheet.id);
      if (!data) throw new Error("対象のプリントを読み込めませんでした");
      const backup = await createSingleBackup(data.worksheet, data.assets);
      const serialized = serializeBackup(backup);
      preparedDownload?.revoke();
      setPreparedDownload(prepareJsonTextDownload(
        serialized,
        `${sanitizeFileNamePart(worksheet.title)}_${localTimestamp()}.json`,
      ));
    } catch (reason) {
      setError({ kind: "operation", title: "JSONを書き出せませんでした", message: failureMessage(reason, "JSONを書き出せませんでした") });
    }
  };

  const closePreparedDownload = () => {
    preparedDownload?.revoke();
    setPreparedDownload(null);
  };

  const completePreparedDownload = () => {
    if (!preparedDownload) return;
    const revoke = preparedDownload.revoke;
    setPreparedDownload(null);
    window.setTimeout(revoke, 60_000);
    setToast({ message: "JSONのダウンロードを開始しました" });
  };

  const trash = async () => {
    if (!deleteTarget || pendingOperation) return;
    const target = deleteTarget;
    setPendingOperation({ kind: "trash", worksheetId: target.id });
    setError(null);
    try {
      const worksheet = await worksheetRepository.trash(target.id);
      setDeleteTarget(null);
      await load();
      setToast({ message: "ゴミ箱へ移動しました", worksheet });
    } catch (reason) {
      setError({ kind: "operation", title: "プリントをゴミ箱へ移動できませんでした", message: failureMessage(reason, "プリントをゴミ箱へ移動できませんでした") });
    } finally {
      setPendingOperation(null);
    }
  };

  const undoTrash = async () => {
    if (!toast?.worksheet || pendingOperation) return;
    const worksheet = toast.worksheet;
    setPendingOperation({ kind: "restore", worksheetId: worksheet.id });
    setError(null);
    try {
      await worksheetRepository.restore(worksheet.id);
      setToast(null);
      await load();
    } catch (reason) {
      setError({ kind: "operation", title: "プリントを復元できませんでした", message: failureMessage(reason, "プリントを復元できませんでした") });
    } finally {
      setPendingOperation(null);
    }
  };

  const operationPending = pendingOperation !== null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => navigate("/")} aria-label="プリント一覧">
          <span className="brand-mark">Σ</span>
          <span>数学プリント作成</span>
        </button>
        <div className="header-actions"><ManualContextLink topic="overview"><BookOpen size={16} />使い方</ManualContextLink><button className="secondary-button" onClick={() => setSettingsOpen(true)}><Settings size={16} />設定・バックアップ</button></div>
      </header>
      <main className="list-main">
        <section className="title-row">
          <div><p className="eyebrow">{active.length} PRINTS</p><h1>プリント</h1></div>
          <button className="primary-button" onClick={createNew} disabled={atLimit} title={atLimit ? "完全削除により空きを作ってください" : undefined}><Plus size={17} />新しいプリント</button>
        </section>

        <section className="list-tools">
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="題名で検索" aria-label="題名で検索" />{query && <button className="clear-search" onClick={() => setQuery("")}>クリア</button>}</label>
          <div className="tool-actions">
            <button className="secondary-button" onClick={() => setImportOpen(true)}><FileUp size={16} />インポート</button>
            <button className="secondary-button" onClick={() => navigate("/trash")}><Trash2 size={16} />ゴミ箱{trashCount > 0 && <span className="count-badge">{trashCount}</span>}</button>
          </div>
        </section>

        {invalidCount > 0 && <div className="notice warning">破損したプリントが{invalidCount}件あります。データは削除していません。</div>}
        {error && !deleteTarget && <div className="error-panel" role="alert"><strong>{error.title}</strong><p>{error.message}</p>{error.kind === "load" && <button className="secondary-button" disabled={loading} onClick={load}>再読み込み</button>}</div>}

        {error?.kind !== "load" && <section className="worksheet-section">
          <div className="section-heading"><h2>最近のプリント</h2><span>更新日時の新しい順</span></div>
          {loading ? <ListSkeleton /> : visible.length > 0 ? (
            <div className="worksheet-list">
              {visible.map((worksheet) => (
                <article className="worksheet-row" key={worksheet.id}>
                  <button className="worksheet-title-button" onClick={() => navigate(`/worksheets/${worksheet.id}`)} title={worksheet.title}>{worksheet.title}</button>
                  <span className="paper-badge">{worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"}</span>
                  <time dateTime={worksheet.updatedAt}>{formatDate(worksheet.updatedAt)}</time>
                  <div className="row-menu-wrap" ref={openMenu === worksheet.id ? openMenuRef : undefined}>
                    <button className="icon-button" aria-label={`${worksheet.title}のメニュー`} onClick={() => setOpenMenu(openMenu === worksheet.id ? null : worksheet.id)}><MoreHorizontal size={19} /></button>
                    {openMenu === worksheet.id && <div className="row-menu">
                      <button onClick={() => navigate(`/worksheets/${worksheet.id}`)}>開く</button>
                      <button disabled={atLimit} onClick={() => duplicate(worksheet)}>複製</button>
                      <button onClick={() => exportSingle(worksheet)}>JSONエクスポート</button>
                      <hr />
                      <button className="danger-text" onClick={() => { setError(null); setDeleteTarget(worksheet); setOpenMenu(null); }}>ゴミ箱へ移動</button>
                    </div>}
                  </div>
                </article>
              ))}
            </div>
          ) : debouncedQuery ? (
            <EmptyState icon={<Search />} title={`「${debouncedQuery}」に一致するプリントはありません`} description="別の語句で検索するか、検索条件を解除してください。"><button className="secondary-button" onClick={() => setQuery("")}>検索をクリア</button></EmptyState>
          ) : (
            <EmptyState icon={<ArchiveRestore />} title="まだプリントがありません" description="新しいプリントを作成するか、JSONからインポートしてください。"><button className="primary-button" onClick={createNew}><Plus size={17} />新しいプリント</button><button className="secondary-button" onClick={() => setImportOpen(true)}>インポート</button></EmptyState>
          )}
          {active.length > PAGE_SIZE && <Pagination page={currentPage} totalPages={totalPages} total={active.length} onChange={setPage} />}
        </section>}
      </main>

      {deleteTarget && <Modal title="プリントをゴミ箱へ移動しますか？" size="small" onClose={() => { if (!operationPending) setDeleteTarget(null); }} footer={<><button className="secondary-button" autoFocus disabled={operationPending} onClick={() => setDeleteTarget(null)}>キャンセル</button><button className="danger-button" disabled={operationPending} onClick={trash}>{pendingOperation?.kind === "trash" ? "移動中…" : "移動する"}</button></>}><p>「{deleteTarget.title}」はゴミ箱から復元できます。</p>{error && <div className="notice danger" role="alert"><strong>{error.title}</strong><p>{error.message}</p></div>}</Modal>}
      {settingsOpen && <BackupModal worksheets={worksheets} onClose={() => setSettingsOpen(false)} onImport={() => { setSettingsOpen(false); setImportOpen(true); }} onDownloadReady={(download) => { preparedDownload?.revoke(); setPreparedDownload(download); }} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={async (count) => { setImportOpen(false); await load(); setToast({ message: `${count}件をインポートしました` }); }} />}
      {preparedDownload && <Modal title="JSONを書き出す" size="small" onClose={closePreparedDownload} footer={<><button className="secondary-button" onClick={closePreparedDownload}>キャンセル</button><a className="primary-button" href={preparedDownload.url} download={preparedDownload.fileName} onClick={completePreparedDownload}><FileDown size={16} />JSONをダウンロード</a></>}><p>JSONファイルの準備ができました。ダウンロードをクリックして保存してください。</p><div className="import-summary"><span>ファイル: {preparedDownload.fileName}</span></div></Modal>}
      {toast && <Toast message={toast.message} {...(toast.worksheet ? { action: pendingOperation?.kind === "restore" ? "復元中…" : "元に戻す", onAction: () => void undoTrash() } : {})} disabled={operationPending} onClose={() => setToast(null)} />}
    </div>
  );
}

function BackupModal({ worksheets, onClose, onImport, onDownloadReady }: { worksheets: Worksheet[]; onClose: () => void; onImport: () => void; onDownloadReady: (download: PreparedDownload) => void }) {
  const active = worksheets.filter((worksheet) => worksheet.deletedAt === null);
  const exportingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportAll = async () => {
    if (active.length === 0 || exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setError(null);
    try {
      const referencedAssetIds = [...collectReferencedAssetIds(active)];
      const assets = (await database.assets.bulkGet(referencedAssetIds))
        .filter((asset): asset is AssetRecord => asset !== undefined);
      const backup = await createArchiveBackup(active, assets);
      const serialized = serializeBackup(backup);
      exportingRef.current = false;
      setExporting(false);
      onDownloadReady(prepareJsonTextDownload(serialized, `math-worksheet-backup-${localTimestamp()}.json`));
      onClose();
    } catch (reason) {
      setError(failureMessage(reason, "全体バックアップを書き出せませんでした"));
    } finally {
      if (exportingRef.current) {
        exportingRef.current = false;
        setExporting(false);
      }
    }
  };
  return <Modal title="設定・バックアップ" onClose={() => { if (!exporting) onClose(); }}>
    <div className="settings-section"><div><h3>すべてのプリントをバックアップ</h3><p>通常一覧のプリントを1つのJSONに書き出します。ゴミ箱内のプリントは含まれません。</p></div><button className="secondary-button" disabled={active.length === 0 || exporting} onClick={exportAll}><FileDown size={16} />{exporting ? "書き出し中…" : "全体をエクスポート"}</button></div>
    <div className="settings-section"><div><h3>バックアップから復元</h3><p>単一プリントまたは全体バックアップのJSONを読み込みます。</p></div><button className="secondary-button" disabled={exporting} onClick={onImport}><FileUp size={16} />インポート</button></div>
    {error && <div className="notice danger" role="alert">{error}</div>}
    <div className="data-note"><strong>データについて</strong><span>保存先: このブラウザ内</span><span>スキーマバージョン: 1</span><p>クラウド保存やアカウント機能はありません。</p><ManualContextLink topic="backup">バックアップの詳しい使い方</ManualContextLink></div>
  </Modal>;
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [backup, setBackup] = useState<MathWorksheetFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const executingRef = useRef(false);
  const [executing, setExecuting] = useState(false);
  const choose = async (file?: File) => {
    if (!file || executingRef.current) return;
    setFileName(file.name); setError(null); setBackup(null);
    try {
      assertBackupInputSize(file.size);
      setBackup(parseBackup(await file.text()));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "このファイルは読み込めません"); }
  };
  const execute = async () => {
    if (!backup || executingRef.current) return;
    executingRef.current = true;
    setExecuting(true);
    setError(null);
    try {
      const items = await hydrateBackup(backup);
      await worksheetRepository.createMany(items);
      executingRef.current = false;
      setExecuting(false);
      onImported(items.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "インポートできませんでした");
    } finally {
      if (executingRef.current) {
        executingRef.current = false;
        setExecuting(false);
      }
    }
  };
  const count = backup ? (backup.kind === "single" ? 1 : backup.worksheets.length) : 0;
  return <Modal title="JSONインポート" onClose={() => { if (!executing) onClose(); }} footer={<><button className="secondary-button" disabled={executing} onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!backup || executing} onClick={execute}>{executing ? "インポート中…" : "インポート実行"}</button></>}>
    <div className="drop-zone" aria-disabled={executing} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!executing) void choose(event.dataTransfer.files[0]); }} onClick={() => { if (!executing) inputRef.current?.click(); }}><FileUp size={28} /><strong>JSONファイルを選択</strong><span>またはここへドロップ</span><input ref={inputRef} hidden disabled={executing} type="file" accept="application/json,.json" onChange={(event) => void choose(event.target.files?.[0])} /></div>
    {fileName && <div className="import-summary"><span>ファイル: {fileName}</span>{backup && <><span>形式: math-worksheet / バージョン: 1</span><span>内容: プリント{count}件</span></>}</div>}
    {error && <div className="notice danger" role="alert">{error}</div>}
    <div className="notice info">既存のプリントは削除されず、追加で読み込まれます。端末内の既存IDと衝突する場合は、全IDを自動で再生成します。</div>
    <ManualContextLink topic="backup">インポートの詳しい使い方</ManualContextLink>
  </Modal>;
}

function EmptyState({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p><div className="empty-actions">{children}</div></div>;
}

function ListSkeleton() { return <div className="worksheet-list">{[1, 2, 3].map((item) => <div className="worksheet-row skeleton" key={item}><span /><span /><span /></div>)}</div>; }

function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return <nav className="pagination" aria-label="ページ切り替え"><span>{start}～{end} / {total}件</span><button className="secondary-button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} />前へ</button><strong>{page} / {totalPages}</strong><button className="secondary-button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>次へ<ChevronRight size={16} /></button></nav>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const time = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (date.toDateString() === today.toDateString()) return `今日 ${time}`;
  return `${new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date)} ${time}`;
}

function failureMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
