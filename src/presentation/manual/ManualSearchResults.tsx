import type { RefObject } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";

import type { ManualSearchResult } from "../../manual/manual-search";

type Props = {
  query: string;
  results: readonly ManualSearchResult[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSelect: () => void;
  onClear: () => void;
};

export function ManualSearchResults({ query, results, headingRef, onSelect, onClear }: Props) {
  return (
    <main className="manual-main manual-search-results" id="manual-main">
      <h1 ref={headingRef} tabIndex={-1}>「{query.trim()}」の検索結果</h1>
      <p id="manual-search-status" role="status" aria-live="polite">{results.length}件見つかりました</p>
      {results.length > 0 ? (
        <div className="manual-search-result-list">
          {results.map((result) => (
            <Link key={result.slug} className="manual-search-result" to={`/help/${result.slug}`} onClick={onSelect}>
              <span className="manual-search-result-title">{result.title}<ChevronRight size={17} /></span>
              <span>{result.excerpt}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="manual-empty-search">
          <Search size={30} />
          <h2>一致する説明はありません</h2>
          <p>語句を短くするか、別の言葉で検索してください。</p>
          <button className="secondary-button" onClick={onClear}>検索をクリア</button>
        </div>
      )}
    </main>
  );
}
