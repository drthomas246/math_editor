import { Monitor } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getAdjacentManualChapters, getManualChapter } from "../../manual/manual-chapters";
import { normalizeManualSearchText, searchManual } from "../../manual/manual-search";
import { ManualArticle } from "./ManualArticle";
import { ManualHeader } from "./ManualHeader";
import { ManualNotFound } from "./ManualNotFound";
import { ManualSearchResults } from "./ManualSearchResults";
import { ManualSidebar } from "./ManualSidebar";
/**
 * ManualScreenコンポーネントを表示する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
export function ManualScreen() {
    const { chapterSlug } = useParams();
    const location = useLocation();
    const chapter = chapterSlug ? getManualChapter(chapterSlug) : undefined;
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const searchActive = normalizeManualSearchText(query).length > 0;
    const results = useMemo((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue1() {
        return searchManual(deferredQuery);
    }), [deferredQuery]);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect2() {
        if (searchActive)
            return;
        headingRef.current?.focus();
        window.scrollTo({ top: 0 });
        // 検索クリア時は検索欄のフォーカスを維持し、章の移動時だけ本文へ移す。
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }), [chapterSlug, location.pathname]);
    const clearQuery = (/**
     * clearQueryの対象となる要素を削除または解放する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function clearQueryImplementation3() {
        return setQuery("");
    });
    const adjacent = chapter ? getAdjacentManualChapters(chapter.slug) : {};
    return (<div className="manual-shell">
      <a className="manual-skip-link" href="#manual-main">本文へ移動</a>
      <ManualHeader query={query} resultCount={searchActive ? results.length : null} onQueryChange={setQuery} onClearQuery={clearQuery}/>
      <div className="manual-workspace">
        <ManualSidebar {...(chapter ? { currentSlug: chapter.slug } : {})} searchActive={searchActive} onChapterSelect={clearQuery}/>
        {searchActive ? (<ManualSearchResults query={query} results={results} headingRef={headingRef} onSelect={clearQuery} onClear={clearQuery}/>) : chapter ? (<ManualArticle chapter={chapter} {...adjacent} headingRef={headingRef}/>) : (<ManualNotFound headingRef={headingRef}/>)}
      </div>
      <main className="manual-width-warning">
        <Monitor size={42}/>
        <h1>PCサイズの画面で開いてください</h1>
        <p>マニュアルは横幅1024px以上のPC画面に対応しています。</p>
        <a className="secondary-button" href="/">アプリへ戻る</a>
      </main>
    </div>);
}
