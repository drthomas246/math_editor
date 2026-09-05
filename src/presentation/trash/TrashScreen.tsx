import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WorksheetRepository } from "../../application/repositories/worksheet-repository";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { Modal } from "../components/Modal";
import { ManualContextLink } from "../components/ManualContextLink";
import { Toast } from "../components/Toast";
type TrashError = {
    kind: "load" | "operation";
    title: string;
    message: string;
};
type PendingOperation = {
    kind: "restore";
    worksheetId: string;
} | {
    kind: "delete";
    worksheetId: string;
} | {
    kind: "empty";
};
/**
 * TrashScreenコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function TrashScreen(props: {
    repository?: WorksheetRepository;
}) {
    let { repository = worksheetRepository } = props;
    const navigate = useNavigate();
    const [items, setItems] = useState<Worksheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TrashError | null>(null);
    const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
    const [target, setTarget] = useState<Worksheet | "all" | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const load = useCallback((/**
     * 依存値に応じて再利用する操作を作成する。
     *
     * @returns 非同期処理の結果
     */
    async function createMemoizedCallback1() {
        setLoading(true);
        setError(null);
        try {
            const result = await repository.list();
            setItems(result.worksheets.filter((/**
             * 対象要素を結果へ残すか判定する。
             *
             * @param worksheet worksheetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function filterItem2(worksheet) {
                return worksheet.deletedAt !== null;
            })).sort((/**
             * 表示順を決めるため二つの要素を比較する。
             *
             * @param a aとして使用する値
             * @param b bとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function compareItems3(a, b) {
                return (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "");
            })));
        }
        catch (reason) {
            setError({ kind: "load", title: "ゴミ箱を読み込めませんでした", message: failureMessage(reason, "ゴミ箱を読み込めませんでした") });
        }
        finally {
            setLoading(false);
        }
    }), [repository]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect4() {
        // 初期表示時に画面の状態をIndexedDBの内容と同期する。
        // oxlint-disable-next-line react/set-state-in-effect
        void load();
    }), [load]);
    const restore = (/**
     * restoreに必要な処理を実行する。
     *
     * @param worksheet worksheetとして使用する値
     * @returns 非同期処理の結果
     */
    async function restoreImplementation5(worksheet: Worksheet) {
        if (pendingOperation)
            return;
        setPendingOperation({ kind: "restore", worksheetId: worksheet.id });
        setError(null);
        try {
            await repository.restore(worksheet.id);
            setToast("プリントを復元しました");
            await load();
        }
        catch (reason) {
            setError({ kind: "operation", title: "プリントを復元できませんでした", message: failureMessage(reason, "プリントを復元できませんでした") });
        }
        finally {
            setPendingOperation(null);
        }
    });
    const remove = (/**
     * removeの対象となる要素を削除または解放する。
     *
     * @returns 非同期処理の結果
     */
    async function removeImplementation6() {
        if (!target || pendingOperation)
            return;
        const operation: PendingOperation = target === "all" ? { kind: "empty" } : { kind: "delete", worksheetId: target.id };
        setPendingOperation(operation);
        setError(null);
        try {
            if (target === "all") {
                const count = await repository.emptyTrash();
                setToast(`${count}件を完全に削除しました`);
            }
            else {
                await repository.deletePermanently(target.id);
                setToast("プリントを完全に削除しました");
            }
            setTarget(null);
            await load();
        }
        catch (reason) {
            setError({
                kind: "operation",
                title: operation.kind === "empty" ? "ゴミ箱を空にできませんでした" : "プリントを完全に削除できませんでした",
                message: failureMessage(reason, operation.kind === "empty" ? "ゴミ箱を空にできませんでした" : "プリントを完全に削除できませんでした"),
            });
        }
        finally {
            setPendingOperation(null);
        }
    });
    const operationPending = pendingOperation !== null;
    const loadFailed = error?.kind === "load";
    return <div className="app-shell">
    <header className="app-header trash-header">
      <div className="header-title-group"><button className="secondary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick7() {
        return navigate("/");
    })}><ArrowLeft size={17}/>プリント一覧</button><span className="header-divider"/><h1>ゴミ箱</h1></div>
      <button className="danger-outline-button" disabled={items.length === 0 || operationPending || loading} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick8() { setError(null); setTarget("all"); })}><Trash2 size={16}/>ゴミ箱を空にする</button>
    </header>
    <main className="list-main trash-main">
      <div className="trash-note"><span>削除したプリントは自動では削除されません。</span><ManualContextLink topic="trash">ゴミ箱について</ManualContextLink></div>
      {error && !target && <div className="error-panel" role="alert"><strong>{error.title}</strong><p>{error.message}</p>{loadFailed && <button className="secondary-button" disabled={loading} onClick={load}>再読み込み</button>}</div>}
      {!loadFailed && (loading ? <div className="worksheet-list"><div className="worksheet-row skeleton"><span /><span /><span /></div></div> : items.length ? <div className="worksheet-list">
        {items.map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param worksheet worksheetとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem9(worksheet) {
                return <article className="worksheet-row trash-row" key={worksheet.id}>
          <strong className="worksheet-name">{worksheet.title}</strong>
          <span className="paper-badge">{worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"}</span>
          <time>削除: {formatDeletedDate(worksheet.deletedAt!)}</time>
          <div className="row-actions"><button className="secondary-button" disabled={operationPending} onClick={(/**
                 * onClickで発生した画面イベントを処理する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleClick10() {
                    return restore(worksheet);
                })}>{pendingOperation?.kind === "restore" && pendingOperation.worksheetId === worksheet.id ? "復元中…" : "復元"}</button><button className="danger-outline-button" disabled={operationPending} onClick={(/**
                 * onClickで発生した画面イベントを処理する。
                 */
                function handleClick11() { setError(null); setTarget(worksheet); })}>完全に削除</button></div>
        </article>;
            }))}
      </div> : <div className="empty-state"><div className="empty-icon"><Trash2 /></div><h3>ゴミ箱は空です</h3><button className="secondary-button" onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick12() {
            return navigate("/");
        })}><ArrowLeft size={16}/>プリント一覧へ戻る</button></div>)}
    </main>
    {target && <Modal title={target === "all" ? "ゴミ箱を空にしますか？" : "プリントを完全に削除しますか？"} size="small" onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     */
    function handleClose13() { if (!operationPending)
        setTarget(null); })} footer={<><button className="secondary-button" autoFocus disabled={operationPending} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick14() {
        return setTarget(null);
    })}>キャンセル</button><button className="danger-button" disabled={operationPending} onClick={remove}>{operationPending ? "削除中…" : target === "all" ? `${items.length}件を完全に削除` : "完全に削除"}</button></>}><p>{target === "all" ? `ゴミ箱内の${items.length}件を削除します。` : `「${target.title}」を削除します。`} この操作は元に戻せません。</p>{error && <div className="notice danger" role="alert"><strong>{error.title}</strong><p>{error.message}</p></div>}</Modal>}
    {toast && <Toast message={toast} onClose={(/**
     * onCloseで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClose15() {
        return setToast(null);
    })}/>}
  </div>;
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
/**
 * formatDeletedDateの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function formatDeletedDate(value: string): string {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
