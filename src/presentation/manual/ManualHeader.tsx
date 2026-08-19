import { BookOpen, Search, X } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { Link } from "react-router-dom";

type ManualHeaderProps = {
  query: string;
  resultCount: number | null;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
};

export function ManualHeader({ query, resultCount, onQueryChange, onClearQuery }: ManualHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape" || !query) return;
    event.preventDefault();
    onClearQuery();
    inputRef.current?.focus();
  };
  return (
    <header className="manual-header">
      <Link className="brand" to="/" aria-label="プリント一覧へ戻る">
        <span className="brand-mark">Σ</span>
        <span>数学プリント作成</span>
      </Link>
      <span className="manual-header-divider" />
      <span className="manual-header-title"><BookOpen size={18} />使い方</span>
      <div className="manual-header-tools">
        <label className="manual-search">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="使い方を検索"
            aria-label="マニュアルを検索"
            aria-describedby={resultCount === null ? undefined : "manual-search-status"}
          />
          {query && <button type="button" onClick={onClearQuery} aria-label="検索をクリア"><X size={15} /></button>}
        </label>
        <Link className="secondary-button" to="/">アプリへ戻る</Link>
      </div>
    </header>
  );
}
