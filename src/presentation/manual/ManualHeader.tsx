import { BookOpen, Search, X } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { Link } from "react-router-dom";
type ManualHeaderProps = {
    query: string;
    resultCount: number | null;
    onQueryChange: (value: string) => void;
    onClearQuery: () => void;
};
/**
 * マニュアル検索欄・検索解除・アプリへ戻る操作を表示する。
 *
 * @param props マニュアル・ヘッダーへ渡す表示情報と操作
 * @returns マニュアル・ヘッダーを表示するReact要素
 */
export function ManualHeader(props: ManualHeaderProps) {
    let { query, resultCount, onQueryChange, onClearQuery } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const handleKeyDown = (/**
     * キー・Downの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
     *
     * @param event 発生したイベント
     */
    function handleKeyDownImplementation1(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== "Escape" || !query)
            return;
        event.preventDefault();
        onClearQuery();
        inputRef.current?.focus();
    });
    return (<header className="manual-header">
      <Link className="brand" to="/" aria-label="プリント一覧へ戻る">
        <span className="brand-mark">Σ</span>
        <span>数学プリント作成</span>
      </Link>
      <span className="manual-header-divider"/>
      <span className="manual-header-title"><BookOpen size={18}/>使い方</span>
      <div className="manual-header-tools">
        <label className="manual-search">
          <Search size={17}/>
          <input ref={inputRef} value={query} onChange={(/**
     * 「マニュアルを検索」要素のon・Changeを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange2(event) {
        return onQueryChange(event.target.value);
    })} onKeyDown={handleKeyDown} placeholder="使い方を検索" aria-label="マニュアルを検索" aria-describedby={resultCount === null ? undefined : "manual-search-status"}/>
          {query && <button type="button" onClick={onClearQuery} aria-label="検索をクリア"><X size={15}/></button>}
        </label>
        <Link className="secondary-button" to="/">アプリへ戻る</Link>
      </div>
    </header>);
}
