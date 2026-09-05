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
/**
 * ManualSearchResultsコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function ManualSearchResults(props: Props) {
    let { query, results, headingRef, onSelect, onClear } = props;
    return (<main className="manual-main manual-search-results" id="manual-main">
      <h1 ref={headingRef} tabIndex={-1}>「{query.trim()}」の検索結果</h1>
      <p id="manual-search-status" role="status" aria-live="polite">{results.length}件見つかりました</p>
      {results.length > 0 ? (<div className="manual-search-result-list">
          {results.map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param result 処理によって得られた結果
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem1(result) {
                return (<Link key={result.slug} className="manual-search-result" to={`/help/${result.slug}`} onClick={onSelect}>
              <span className="manual-search-result-title">{result.title}<ChevronRight size={17}/></span>
              <span>{result.excerpt}</span>
            </Link>);
            }))}
        </div>) : (<div className="manual-empty-search">
          <Search size={30}/>
          <h2>一致する説明はありません</h2>
          <p>語句を短くするか、別の言葉で検索してください。</p>
          <button className="secondary-button" onClick={onClear}>検索をクリア</button>
        </div>)}
    </main>);
}
