import type { RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ManualChapter } from "../../manual/manual-chapters";
import { ManualMarkdown } from "./ManualMarkdown";
type ManualArticleProps = {
    chapter: ManualChapter;
    previous?: ManualChapter;
    next?: ManualChapter;
    headingRef: RefObject<HTMLHeadingElement | null>;
};
/**
 * 選択中のマニュアル章本文と前後章への移動リンクを表示する。
 *
 * @param props マニュアル・Articleへ渡す表示情報と操作
 * @returns マニュアル・Articleを表示するReact要素
 */
export function ManualArticle(props: ManualArticleProps) {
    let { chapter, previous, next, headingRef } = props;
    return (<main className="manual-main" id="manual-main">
      <article className="manual-article">
        <p className="manual-chapter-number">CHAPTER {chapter.order}</p>
        <h1 ref={headingRef} tabIndex={-1}>{chapter.title}</h1>
        <p className="manual-summary">{chapter.summary}</p>
        <ManualMarkdown markdown={chapter.markdown}/>
        <nav className="manual-chapter-nav" aria-label="前後の章">
          {previous && <Link to={`/help/${previous.slug}`}><ChevronLeft size={17}/><span><small>前の章</small>{previous.title}</span></Link>}
          {next && <Link className="next" to={`/help/${next.slug}`}><span><small>次の章</small>{next.title}</span><ChevronRight size={17}/></Link>}
        </nav>
      </article>
    </main>);
}
