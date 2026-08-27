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

export function ManualScreen() {
  const { chapterSlug } = useParams();
  const location = useLocation();
  const chapter = chapterSlug ? getManualChapter(chapterSlug) : undefined;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchActive = normalizeManualSearchText(query).length > 0;
  const results = useMemo(() => searchManual(deferredQuery), [deferredQuery]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (searchActive) return;
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
    // Clearing search keeps focus in the search box; only route changes should move it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterSlug, location.pathname]);

  const clearQuery = () => setQuery("");
  const adjacent = chapter ? getAdjacentManualChapters(chapter.slug) : {};
  return (
    <div className="manual-shell">
      <a className="manual-skip-link" href="#manual-main">本文へ移動</a>
      <ManualHeader
        query={query}
        resultCount={searchActive ? results.length : null}
        onQueryChange={setQuery}
        onClearQuery={clearQuery}
      />
      <div className="manual-workspace">
        <ManualSidebar
          {...(chapter ? { currentSlug: chapter.slug } : {})}
          searchActive={searchActive}
          onChapterSelect={clearQuery}
        />
        {searchActive ? (
          <ManualSearchResults query={query} results={results} headingRef={headingRef} onSelect={clearQuery} onClear={clearQuery} />
        ) : chapter ? (
          <ManualArticle chapter={chapter} {...adjacent} headingRef={headingRef} />
        ) : (
          <ManualNotFound headingRef={headingRef} />
        )}
      </div>
      <main className="manual-width-warning">
        <Monitor size={42} />
        <h1>PCサイズの画面で開いてください</h1>
        <p>マニュアルは横幅1024px以上のPC画面に対応しています。</p>
        <a className="secondary-button" href="/">アプリへ戻る</a>
      </main>
    </div>
  );
}
