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
type TrashScreenProps = {
    repository?: WorksheetRepository;
};
/**
 * ごみ箱内のプリントを一覧表示し、復元・完全削除・一括削除を提供する。
 *
 * @param props ごみ箱データの読み込みと更新に使用するリポジトリ
 * @returns ごみ箱画面
 */
export function TrashScreen(props: TrashScreenProps) {
    let { repository = worksheetRepository } = props;
    const navigate = useNavigate();
    const [items, setItems] = useState<Worksheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TrashError | null>(null);
    const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
    const [target, setTarget] = useState<Worksheet | "all" | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const load = useCallback((/**
     * ごみ箱内のプリントを読み込み、削除日時の新しい順で表示する。
     *
      * @returns ごみ箱一覧の更新が完了したときに解決するPromise
     */
    async function createMemoizedCallback1() {
        setLoading(true);
        setError(null);
        try {
            const result = await repository.list();
            setItems(result.worksheets.filter((/**
             * 処理対象となるプリントのごみ箱へ移した日時がnullと異なる要素だけを後続処理へ残す。
             *
             * @param worksheet 処理対象となるプリント
             * @returns 処理対象となるプリントのごみ箱へ移した日時がnullと異なる場合はtrue
             */
            function filterItem2(worksheet) {
                return worksheet.deletedAt !== null;
            })).sort((/**
             * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
             *
             * @param a 左側の要素
             * @param b 右側の要素
             * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
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
     * 読み込みとReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
     */
    function synchronizeEffect4() {
        // 初期表示時に画面の状態をIndexedDBの内容と同期する。
        // oxlint-disable-next-line react/set-state-in-effect
        void load();
    }), [load]);
    const restore = (/**
     * 保留中・操作をユーザー操作または非同期処理の結果に合わせて更新する。
     *
     * @param worksheet 処理対象となるプリント
     * @returns 保留中・操作をユーザー操作または非同期処理の結果に合わせて更新する処理の完了時に解決するPromise
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
     * 保留中・操作をユーザー操作または非同期処理の結果に合わせて更新する。
     *
     * @returns 保留中・操作をユーザー操作または非同期処理の結果に合わせて更新する処理の完了時に解決するPromise
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
     * 「プリント一覧」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick7() {
        return navigate("/");
    })}><ArrowLeft size={17}/>プリント一覧</button><span className="header-divider"/><h1>ゴミ箱</h1></div>
      <button className="danger-outline-button" disabled={items.length === 0 || operationPending || loading} onClick={(/**
     * 「ゴミ箱を空にする」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick8() { setError(null); setTarget("all"); })}><Trash2 size={16}/>ゴミ箱を空にする</button>
    </header>
    <main className="list-main trash-main">
      <div className="trash-note"><span>削除したプリントは自動では削除されません。</span><ManualContextLink topic="trash">ゴミ箱について</ManualContextLink></div>
      {error && !target && <div className="error-panel" role="alert"><strong>{error.title}</strong><p>{error.message}</p>{loadFailed && <button className="secondary-button" disabled={loading} onClick={load}>再読み込み</button>}</div>}
      {!loadFailed && (loading ? <div className="worksheet-list"><div className="worksheet-row skeleton"><span /><span /><span /></div></div> : items.length ? <div className="worksheet-list">
        {items.map((/**
             * 各処理対象となるプリントを画面表示用のReact要素へ変換する。
             *
             * @param worksheet 処理対象となるプリント
             * @returns 画面表示用のReact要素
             */
            function mapItem9(worksheet) {
                return <article className="worksheet-row trash-row" key={worksheet.id}>
          <strong className="worksheet-name">{worksheet.title}</strong>
          <span className="paper-badge">{worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"}</span>
          <time>削除: {formatDeletedDate(worksheet.deletedAt!)}</time>
          <div className="row-actions"><button className="secondary-button" disabled={operationPending} onClick={(/**
                 * ボタンからクリック操作を受け、restoreを実行する。
                 *
                 */
                function handleClick10() {
                    return restore(worksheet);
                })}>{pendingOperation?.kind === "restore" && pendingOperation.worksheetId === worksheet.id ? "復元中…" : "復元"}</button><button className="danger-outline-button" disabled={operationPending} onClick={(/**
                 * 「完全に削除」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
                 */
                function handleClick11() { setError(null); setTarget(worksheet); })}>完全に削除</button></div>
        </article>;
            }))}
      </div> : <div className="empty-state"><div className="empty-icon"><Trash2 /></div><h3>ゴミ箱は空です</h3><button className="secondary-button" onClick={(/**
         * 「プリント一覧へ戻る」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
         *
         */
        function handleClick12() {
            return navigate("/");
        })}><ArrowLeft size={16}/>プリント一覧へ戻る</button></div>)}
    </main>
    {target && <Modal title={target === "all" ? "ゴミ箱を空にしますか？" : "プリントを完全に削除しますか？"} size="small" onClose={(/**
     * 「キャンセル」要素のon・閉じる操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClose13() { if (!operationPending)
        setTarget(null); })} footer={<><button className="secondary-button" autoFocus disabled={operationPending} onClick={(/**
     * 「キャンセル」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick14() {
        return setTarget(null);
    })}>キャンセル</button><button className="danger-button" disabled={operationPending} onClick={remove}>{operationPending ? "削除中…" : target === "all" ? `${items.length}件を完全に削除` : "完全に削除"}</button></>}><p>{target === "all" ? `ゴミ箱内の${items.length}件を削除します。` : `「${target.title}」を削除します。`} この操作は元に戻せません。</p>{error && <div className="notice danger" role="alert"><strong>{error.title}</strong><p>{error.message}</p></div>}</Modal>}
    {toast && <Toast message={toast} onClose={(/**
     * Toast要素から終了要求を受け、Toastを操作内容に合う状態へ更新する。
     */
    function handleClose15() {
        return setToast(null);
    })}/>}
  </div>;
}
/**
 * 未知の例外値を利用者へ表示できる失敗理由の文字列へ変換する。
 *
 * @param reason 処理中に発生したエラー
 * @param fallback 設定値が不正な場合に採用する既定値
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function failureMessage(reason: unknown, fallback: string): string {
    return reason instanceof Error && reason.message ? reason.message : fallback;
}
/**
 * Deleted・Dateを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value 表示形式・Deleted・Dateで判定または変換する入力値
 * @returns 問題番号へ適用する表示形式の結果として得た文字列。変換できない場合は関数固有の既定値
 */
function formatDeletedDate(value: string): string {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
