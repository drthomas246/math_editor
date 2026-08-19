import { ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Worksheet } from "../../domain/worksheet/worksheet";
import { worksheetRepository } from "../../infrastructure/indexeddb/dexie-worksheet-repository";
import { Modal } from "../components/Modal";
import { ManualContextLink } from "../components/ManualContextLink";
import { Toast } from "../components/Toast";

export function TrashScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Worksheet | "all" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await worksheetRepository.list();
    setItems(result.worksheets.filter((worksheet) => worksheet.deletedAt !== null).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const restore = async (worksheet: Worksheet) => {
    await worksheetRepository.restore(worksheet.id);
    setToast("プリントを復元しました");
    await load();
  };
  const remove = async () => {
    if (target === "all") {
      const count = await worksheetRepository.emptyTrash();
      setToast(`${count}件を完全に削除しました`);
    } else if (target) {
      await worksheetRepository.deletePermanently(target.id);
      setToast("プリントを完全に削除しました");
    }
    setTarget(null);
    await load();
  };

  return <div className="app-shell">
    <header className="app-header trash-header">
      <div className="header-title-group"><button className="secondary-button" onClick={() => navigate("/")}><ArrowLeft size={17} />プリント一覧</button><span className="header-divider" /><h1>ゴミ箱</h1></div>
      <button className="danger-outline-button" disabled={items.length === 0} onClick={() => setTarget("all")}><Trash2 size={16} />ゴミ箱を空にする</button>
    </header>
    <main className="list-main trash-main">
      <div className="trash-note"><span>削除したプリントは自動では削除されません。</span><ManualContextLink topic="trash">ゴミ箱について</ManualContextLink></div>
      {loading ? <div className="worksheet-list"><div className="worksheet-row skeleton"><span /><span /><span /></div></div> : items.length ? <div className="worksheet-list">
        {items.map((worksheet) => <article className="worksheet-row trash-row" key={worksheet.id}>
          <strong className="worksheet-name">{worksheet.title}</strong>
          <span className="paper-badge">{worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"}</span>
          <time>削除: {formatDeletedDate(worksheet.deletedAt!)}</time>
          <div className="row-actions"><button className="secondary-button" onClick={() => restore(worksheet)}>復元</button><button className="danger-outline-button" onClick={() => setTarget(worksheet)}>完全に削除</button></div>
        </article>)}
      </div> : <div className="empty-state"><div className="empty-icon"><Trash2 /></div><h3>ゴミ箱は空です</h3><button className="secondary-button" onClick={() => navigate("/")}><ArrowLeft size={16} />プリント一覧へ戻る</button></div>}
    </main>
    {target && <Modal title={target === "all" ? "ゴミ箱を空にしますか？" : "プリントを完全に削除しますか？"} size="small" onClose={() => setTarget(null)} footer={<><button className="secondary-button" autoFocus onClick={() => setTarget(null)}>キャンセル</button><button className="danger-button" onClick={remove}>{target === "all" ? `${items.length}件を完全に削除` : "完全に削除"}</button></>}><p>{target === "all" ? `ゴミ箱内の${items.length}件を削除します。` : `「${target.title}」を削除します。`} この操作は元に戻せません。</p></Modal>}
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </div>;
}

function formatDeletedDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
