import { ArchiveRestore, BookOpen, ChevronLeft, ChevronRight, FileDown, FileUp, MoreHorizontal, Plus, Search, Settings, Trash2, } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertBackupInputSize, createArchiveBackup, createSingleBackup, hydrateBackup, parseBackup, serializeBackup, } from "../../application/backup/backup";
import { STRUCTURE_LIMITS } from "../../domain/worksheet/structure-limits";
import type { AssetRecord, MathWorksheetFile, Worksheet } from "../../domain/worksheet/worksheet";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import { normalizeSearchKey } from "../../domain/worksheet/worksheet.search";
import { localTimestamp, prepareJsonTextDownload, sanitizeFileNamePart, type PreparedDownload, } from "../../infrastructure/file/download";
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
type PendingListOperation = {
    kind: "trash";
    worksheetId: string;
} | {
    kind: "restore";
    worksheetId: string;
};
/**
 * WorksheetListScreenコンポーネントを表示する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
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
    const [toast, setToast] = useState<{
        message: string;
        worksheet?: Worksheet;
    } | null>(null);
    const [pendingOperation, setPendingOperation] = useState<PendingListOperation | null>(null);
    const openMenuRef = useRef<HTMLDivElement>(null);
    useOutsidePointerDown(openMenuRef, openMenu !== null, (/**
     * useOutsidePointerDownへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useOutsidePointerDownCallback1() {
        return setOpenMenu(null);
    }));
    const load = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @returns 非同期処理の結果
     */
    async function createMemoizedCallback2() {
        setLoading(true);
        setError(null);
        try {
            const result = await worksheetRepository.list();
            setWorksheets(result.worksheets);
            setInvalidCount(result.invalidCount);
        }
        catch (reason) {
            setError({ kind: "load", title: "一覧を読み込めませんでした", message: failureMessage(reason, "一覧を読み込めませんでした") });
        }
        finally {
            setLoading(false);
        }
    }), []);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect3() {
        // 初期表示時に画面の状態をIndexedDBの内容と同期する。
        // oxlint-disable-next-line react/set-state-in-effect
        void load();
    }), [load]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect4() {
        const timer = window.setTimeout((/**
         * 指定時間後に必要な処理を実行する。
         */
        function handleScheduledTask5() { setDebouncedQuery(query); setPage(1); }), 150);
        return (/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback6() {
            return window.clearTimeout(timer);
        });
    }), [query]);
    const active = useMemo((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue7() {
        return worksheets
            .filter((/**
         * 対象要素を結果へ残すか判定する。
         *
         * @param worksheet worksheetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function filterItem8(worksheet) {
            return worksheet.deletedAt === null;
        }))
            .filter((/**
         * 対象要素を結果へ残すか判定する。
         *
         * @param worksheet worksheetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function filterItem9(worksheet) {
            return normalizeSearchKey(worksheet.title).includes(normalizeSearchKey(debouncedQuery));
        }))
            .sort((/**
         * 表示順を決めるため二つの要素を比較する。
         *
         * @param a aとして使用する値
         * @param b bとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function compareItems10(a, b) {
            return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
        }));
    }), [worksheets, debouncedQuery]);
    const trashCount = worksheets.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem11(worksheet) {
        return worksheet.deletedAt !== null;
    })).length;
    const totalPages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const visible = active.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const atLimit = worksheets.length >= STRUCTURE_LIMITS.worksheetsPerArchive;
    const createNew = (/**
     * createNewで必要な値を作成する。
     *
     * @returns 非同期処理の結果
     */
    async function createNewImplementation12() {
        const worksheet = createWorksheet();
        try {
            await worksheetRepository.create({ worksheet, assets: [] });
            await navigate(`/worksheets/${worksheet.id}`);
        }
        catch (reason) {
            setError({ kind: "operation", title: "プリントを作成できませんでした", message: failureMessage(reason, "プリントを作成できませんでした") });
        }
    });
    const duplicate = (/**
     * duplicateで必要な値を作成する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 非同期処理の結果
     */
    async function duplicateImplementation13(worksheet: Worksheet) {
        setOpenMenu(null);
        try {
            await worksheetRepository.duplicate(worksheet.id);
            await load();
            setToast({ message: "プリントを複製しました" });
        }
        catch (reason) {
            setError({ kind: "operation", title: "プリントを複製できませんでした", message: failureMessage(reason, "プリントを複製できませんでした") });
        }
    });
    const exportSingle = (/**
     * exportSingleの対象となるデータを保存または出力する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 非同期処理の結果
     */
    async function exportSingleImplementation14(worksheet: Worksheet) {
        setOpenMenu(null);
        try {
            const data = await worksheetRepository.get(worksheet.id);
            if (!data)
                throw new Error("対象のプリントを読み込めませんでした");
            const backup = await createSingleBackup(data.worksheet, data.assets);
            const serialized = serializeBackup(backup);
            preparedDownload?.revoke();
            setPreparedDownload(prepareJsonTextDownload(serialized, `${sanitizeFileNamePart(worksheet.title)}_${localTimestamp()}.json`));
        }
        catch (reason) {
            setError({ kind: "operation", title: "JSONを書き出せませんでした", message: failureMessage(reason, "JSONを書き出せませんでした") });
        }
    });
    const closePreparedDownload = (/**
     * closePreparedDownloadに対応する画面表示を更新する。
     */
    function closePreparedDownloadImplementation15() {
        preparedDownload?.revoke();
        setPreparedDownload(null);
    });
    const completePreparedDownload = (/**
     * completePreparedDownloadに必要な処理を実行する。
     */
    function completePreparedDownloadImplementation16() {
        if (!preparedDownload)
            return;
        const revoke = preparedDownload.revoke;
        setPreparedDownload(null);
        window.setTimeout(revoke, 60000);
        setToast({ message: "JSONのダウンロードを開始しました" });
    });
    const trash = (/**
     * trashに必要な処理を実行する。
     *
     * @returns 非同期処理の結果
     */
    async function trashImplementation17() {
        if (!deleteTarget || pendingOperation)
            return;
        const target = deleteTarget;
        setPendingOperation({ kind: "trash", worksheetId: target.id });
        setError(null);
        try {
            const worksheet = await worksheetRepository.trash(target.id);
            setDeleteTarget(null);
            await load();
            setToast({ message: "ゴミ箱へ移動しました", worksheet });
        }
        catch (reason) {
            setError({ kind: "operation", title: "プリントをゴミ箱へ移動できませんでした", message: failureMessage(reason, "プリントをゴミ箱へ移動できませんでした") });
        }
        finally {
            setPendingOperation(null);
        }
    });
    const undoTrash = (/**
     * undoTrashに必要な処理を実行する。
     *
     * @returns 非同期処理の結果
     */
    async function undoTrashImplementation18() {
        if (!toast?.worksheet || pendingOperation)
            return;
        const worksheet = toast.worksheet;
        setPendingOperation({ kind: "restore", worksheetId: worksheet.id });
        setError(null);
        try {
            await worksheetRepository.restore(worksheet.id);
            setToast(null);
            await load();
        }
        catch (reason) {
            setError({ kind: "operation", title: "プリントを復元できませんでした", message: failureMessage(reason, "プリントを復元できませんでした") });
        }
        finally {
            setPendingOperation(null);
        }
    });
    const operationPending = pendingOperation !== null;
    return (<div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick19() {
        return navigate("/");
    })} aria-label="プリント一覧">
          <span className="brand-mark">Σ</span>
          <span>数学プリント作成</span>
        </button>
        <div className="header-actions"><ManualContextLink topic="overview"><BookOpen size={16}/>使い方</ManualContextLink><button className="secondary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick20() {
        return setSettingsOpen(true);
    })}><Settings size={16}/>設定・バックアップ</button></div>
      </header>
      <main className="list-main">
        <section className="title-row">
          <div><p className="eyebrow">{active.length} PRINTS</p><h1>プリント</h1></div>
          <button className="primary-button" onClick={createNew} disabled={atLimit} title={atLimit ? "完全削除により空きを作ってください" : undefined}><Plus size={17}/>新しいプリント</button>
        </section>

        <section className="list-tools">
          <label className="search-field"><Search size={17}/><input value={query} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange21(event) {
        return setQuery(event.target.value);
    })} placeholder="題名で検索" aria-label="題名で検索"/>{query && <button className="clear-search" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick22() {
        return setQuery("");
    })}>クリア</button>}</label>
          <div className="tool-actions">
            <button className="secondary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick23() {
        return setImportOpen(true);
    })}><FileUp size={16}/>インポート</button>
            <button className="secondary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick24() {
        return navigate("/trash");
    })}><Trash2 size={16}/>ゴミ箱{trashCount > 0 && <span className="count-badge">{trashCount}</span>}</button>
          </div>
        </section>

        {invalidCount > 0 && <div className="notice warning">破損したプリントが{invalidCount}件あります。データは削除していません。</div>}
        {error && !deleteTarget && <div className="error-panel" role="alert"><strong>{error.title}</strong><p>{error.message}</p>{error.kind === "load" && <button className="secondary-button" disabled={loading} onClick={load}>再読み込み</button>}</div>}

        {error?.kind !== "load" && <section className="worksheet-section">
          <div className="section-heading"><h2>最近のプリント</h2><span>更新日時の新しい順</span></div>
          {loading ? <ListSkeleton /> : visible.length > 0 ? (<div className="worksheet-list">
              {visible.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param worksheet worksheetとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem25(worksheet) {
                    return (<article className="worksheet-row" key={worksheet.id}>
                  <button className="worksheet-title-button" onClick={(/**
                     * onClickで発生した画面イベントを処理する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function handleClick26() {
                        return navigate(`/worksheets/${worksheet.id}`);
                    })} title={worksheet.title}>{worksheet.title}</button>
                  <span className="paper-badge">{worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"}</span>
                  <time dateTime={worksheet.updatedAt}>{formatDate(worksheet.updatedAt)}</time>
                  <div className="row-menu-wrap" ref={openMenu === worksheet.id ? openMenuRef : undefined}>
                    <button className="icon-button" aria-label={`${worksheet.title}のメニュー`} onClick={(/**
                     * onClickで発生した画面イベントを処理する。
                     *
                     * @returns 呼び出し元で使用する処理結果
                     */
                    function handleClick27() {
                        return setOpenMenu(openMenu === worksheet.id ? null : worksheet.id);
                    })}><MoreHorizontal size={19}/></button>
                    {openMenu === worksheet.id && <div className="row-menu">
                      <button onClick={(/**
                         * onClickで発生した画面イベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleClick28() {
                            return navigate(`/worksheets/${worksheet.id}`);
                        })}>開く</button>
                      <button disabled={atLimit} onClick={(/**
                         * onClickで発生した画面イベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleClick29() {
                            return duplicate(worksheet);
                        })}>複製</button>
                      <button onClick={(/**
                         * onClickで発生した画面イベントを処理する。
                         *
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function handleClick30() {
                            return exportSingle(worksheet);
                        })}>JSONエクスポート</button>
                      <hr />
                      <button className="danger-text" onClick={(/**
                         * onClickで発生した画面イベントを処理する。
                         */
                        function handleClick31() { setError(null); setDeleteTarget(worksheet); setOpenMenu(null); })}>ゴミ箱へ移動</button>
                    </div>}
                  </div>
                </article>);
                }))}
            </div>) : debouncedQuery ? (<EmptyState icon={<Search />} title={`「${debouncedQuery}」に一致するプリントはありません`} description="別の語句で検索するか、検索条件を解除してください。"><button className="secondary-button" onClick={(/**
             * onClickで発生した画面イベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleClick32() {
                return setQuery("");
            })}>検索をクリア</button></EmptyState>) : (<EmptyState icon={<ArchiveRestore />} title="まだプリントがありません" description="新しいプリントを作成するか、JSONからインポートしてください。"><button className="primary-button" onClick={createNew}><Plus size={17}/>新しいプリント</button><button className="secondary-button" onClick={(/**
             * onClickで発生した画面イベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleClick33() {
                return setImportOpen(true);
            })}>インポート</button></EmptyState>)}
          {active.length > PAGE_SIZE && <Pagination page={currentPage} totalPages={totalPages} total={active.length} onChange={setPage}/>}
        </section>}
      </main>

      {deleteTarget && <Modal title="プリントをゴミ箱へ移動しますか？" size="small" onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     */
    function handleClose34() { if (!operationPending)
        setDeleteTarget(null); })} footer={<><button className="secondary-button" autoFocus disabled={operationPending} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick35() {
        return setDeleteTarget(null);
    })}>キャンセル</button><button className="danger-button" disabled={operationPending} onClick={trash}>{pendingOperation?.kind === "trash" ? "移動中…" : "移動する"}</button></>}><p>「{deleteTarget.title}」はゴミ箱から復元できます。</p>{error && <div className="notice danger" role="alert"><strong>{error.title}</strong><p>{error.message}</p></div>}</Modal>}
      {settingsOpen && <BackupModal worksheets={worksheets} onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose36() {
        return setSettingsOpen(false);
    })} onImport={(/**
     * onImportで発生した画面イベントを処理する。
     */
    function handleImport37() { setSettingsOpen(false); setImportOpen(true); })} onDownloadReady={(/**
     * onDownloadReadyで発生した画面イベントを処理する。
     *
     * @param download downloadとして使用する値
     */
    function handleDownloadReady38(download) { preparedDownload?.revoke(); setPreparedDownload(download); })}/>}
      {importOpen && <ImportModal onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose39() {
        return setImportOpen(false);
    })} onImported={(/**
     * onImportedで発生した画面イベントを処理する。
     *
     * @param count countとして使用する値
     * @returns 非同期処理の結果
     */
    async function handleImported40(count) { setImportOpen(false); await load(); setToast({ message: `${count}件をインポートしました` }); })}/>}
      {preparedDownload && <Modal title="JSONを書き出す" size="small" onClose={closePreparedDownload} footer={<><button className="secondary-button" onClick={closePreparedDownload}>キャンセル</button><a className="primary-button" href={preparedDownload.url} download={preparedDownload.fileName} onClick={completePreparedDownload}><FileDown size={16}/>JSONをダウンロード</a></>}><p>JSONファイルの準備ができました。ダウンロードをクリックして保存してください。</p><div className="import-summary"><span>ファイル: {preparedDownload.fileName}</span></div></Modal>}
      {toast && <Toast message={toast.message} {...(toast.worksheet ? { action: pendingOperation?.kind === "restore" ? "復元中…" : "元に戻す", onAction: (/**
         * onActionに対応するイベントまたは通知を処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function onActionCallback41() {
            return void undoTrash();
        }) } : {})} disabled={operationPending} onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose42() {
        return setToast(null);
    })}/>}
    </div>);
}
/**
 * BackupModalコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function BackupModal(props: {
    worksheets: Worksheet[];
    onClose: () => void;
    onImport: () => void;
    onDownloadReady: (download: PreparedDownload) => void;
}) {
    let { worksheets, onClose, onImport, onDownloadReady } = props;
    const active = worksheets.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem43(worksheet) {
        return worksheet.deletedAt === null;
    }));
    const exportingRef = useRef(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const exportAll = (/**
     * exportAllの対象となるデータを保存または出力する。
     *
     * @returns 非同期処理の結果
     */
    async function exportAllImplementation44() {
        if (active.length === 0 || exportingRef.current)
            return;
        exportingRef.current = true;
        setExporting(true);
        setError(null);
        try {
            const referencedAssetIds = [...collectReferencedAssetIds(active)];
            const assets = (await database.assets.bulkGet(referencedAssetIds))
                .filter((/**
             * 対象要素を結果へ残すか判定する。
             *
             * @param asset assetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function filterItem45(asset): asset is AssetRecord {
                return asset !== undefined;
            }));
            const backup = await createArchiveBackup(active, assets);
            const serialized = serializeBackup(backup);
            exportingRef.current = false;
            setExporting(false);
            onDownloadReady(prepareJsonTextDownload(serialized, `math-worksheet-backup-${localTimestamp()}.json`));
            onClose();
        }
        catch (reason) {
            setError(failureMessage(reason, "全体バックアップを書き出せませんでした"));
        }
        finally {
            if (exportingRef.current) {
                exportingRef.current = false;
                setExporting(false);
            }
        }
    });
    return <Modal title="設定・バックアップ" onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     */
    function handleClose46() { if (!exporting)
        onClose(); })}>
    <div className="settings-section"><div><h3>すべてのプリントをバックアップ</h3><p>通常一覧のプリントを1つのJSONに書き出します。ゴミ箱内のプリントは含まれません。</p></div><button className="secondary-button" disabled={active.length === 0 || exporting} onClick={exportAll}><FileDown size={16}/>{exporting ? "書き出し中…" : "全体をエクスポート"}</button></div>
    <div className="settings-section"><div><h3>バックアップから復元</h3><p>単一プリントまたは全体バックアップのJSONを読み込みます。</p></div><button className="secondary-button" disabled={exporting} onClick={onImport}><FileUp size={16}/>インポート</button></div>
    {error && <div className="notice danger" role="alert">{error}</div>}
    <div className="data-note"><strong>データについて</strong><span>保存先: このブラウザ内</span><span>スキーマバージョン: 1</span><p>クラウド保存やアカウント機能はありません。</p><ManualContextLink topic="backup">バックアップの詳しい使い方</ManualContextLink></div>
  </Modal>;
}
/**
 * ImportModalコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function ImportModal(props: {
    onClose: () => void;
    onImported: (count: number) => void;
}) {
    let { onClose, onImported } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState("");
    const [backup, setBackup] = useState<MathWorksheetFile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const executingRef = useRef(false);
    const [executing, setExecuting] = useState(false);
    const choose = (/**
     * chooseに必要な処理を実行する。
     *
     * @param file fileとして使用する値
     * @returns 非同期処理の結果
     */
    async function chooseImplementation47(file?: File) {
        if (!file || executingRef.current)
            return;
        setFileName(file.name);
        setError(null);
        setBackup(null);
        try {
            assertBackupInputSize(file.size);
            setBackup(parseBackup(await file.text()));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "このファイルは読み込めません");
        }
    });
    const execute = (/**
     * executeで定義された一連の処理を実行する。
     *
     * @returns 非同期処理の結果
     */
    async function executeImplementation48() {
        if (!backup || executingRef.current)
            return;
        executingRef.current = true;
        setExecuting(true);
        setError(null);
        try {
            const items = await hydrateBackup(backup);
            await worksheetRepository.createMany(items);
            executingRef.current = false;
            setExecuting(false);
            onImported(items.length);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "インポートできませんでした");
        }
        finally {
            if (executingRef.current) {
                executingRef.current = false;
                setExecuting(false);
            }
        }
    });
    const count = backup ? (backup.kind === "single" ? 1 : backup.worksheets.length) : 0;
    return <Modal title="JSONインポート" onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     */
    function handleClose49() { if (!executing)
        onClose(); })} footer={<><button className="secondary-button" disabled={executing} onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!backup || executing} onClick={execute}>{executing ? "インポート中…" : "インポート実行"}</button></>}>
    <div className="drop-zone" aria-disabled={executing} onDragOver={(/**
     * onDragOverで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleDragOver50(event) {
        return event.preventDefault();
    })} onDrop={(/**
     * onDropで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleDrop51(event) { event.preventDefault(); if (!executing)
        void choose(event.dataTransfer.files[0]); })} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick52() { if (!executing)
        inputRef.current?.click(); })}><FileUp size={28}/><strong>JSONファイルを選択</strong><span>またはここへドロップ</span><input ref={inputRef} hidden disabled={executing} type="file" accept="application/json,.json" onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange53(event) {
        return void choose(event.target.files?.[0]);
    })}/></div>
    {fileName && <div className="import-summary"><span>ファイル: {fileName}</span>{backup && <><span>形式: math-worksheet / バージョン: 1</span><span>内容: プリント{count}件</span></>}</div>}
    {error && <div className="notice danger" role="alert">{error}</div>}
    <div className="notice info">既存のプリントは削除されず、追加で読み込まれます。端末内の既存IDと衝突する場合は、全IDを自動で再生成します。</div>
    <ManualContextLink topic="backup">インポートの詳しい使い方</ManualContextLink>
  </Modal>;
}
/**
 * EmptyStateコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function EmptyState(props: {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    let { icon, title, description, children } = props;
    return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p><div className="empty-actions">{children}</div></div>;
}
/**
 * ListSkeletonコンポーネントを表示する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function ListSkeleton() { return <div className="worksheet-list">{[1, 2, 3].map((/**
 * 各要素を画面表示または別形式へ変換する。
 *
 * @param item 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function mapItem54(item) {
    return <div className="worksheet-row skeleton" key={item}><span /><span /><span /></div>;
}))}</div>; }
/**
 * Paginationコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function Pagination(props: {
    page: number;
    totalPages: number;
    total: number;
    onChange: (page: number) => void;
}) {
    let { page, totalPages, total, onChange } = props;
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return <nav className="pagination" aria-label="ページ切り替え"><span>{start}～{end} / {total}件</span><button className="secondary-button" disabled={page <= 1} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick55() {
        return onChange(page - 1);
    })}><ChevronLeft size={16}/>前へ</button><strong>{page} / {totalPages}</strong><button className="secondary-button" disabled={page >= totalPages} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick56() {
        return onChange(page + 1);
    })}>次へ<ChevronRight size={16}/></button></nav>;
}
/**
 * formatDateの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function formatDate(value: string): string {
    const date = new Date(value);
    const today = new Date();
    const time = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
    if (date.toDateString() === today.toDateString())
        return `今日 ${time}`;
    return `${new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date)} ${time}`;
}
/**
 * failureMessageに必要な処理を実行する。
 *
 * @param reason 処理中に発生したエラー
 * @param fallback fallbackとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function failureMessage(reason: unknown, fallback: string): string {
    return reason instanceof Error && reason.message ? reason.message : fallback;
}
