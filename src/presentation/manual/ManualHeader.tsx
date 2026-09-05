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
 * ManualHeaderコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function ManualHeader(props: ManualHeaderProps) {
    let { query, resultCount, onQueryChange, onClearQuery } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const handleKeyDown = (/**
     * handleKeyDownに対応するイベントまたは通知を処理する。
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
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
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
