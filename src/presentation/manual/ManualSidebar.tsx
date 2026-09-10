import { Link } from "react-router-dom";
import { MANUAL_CHAPTERS } from "../../manual/manual-chapters";
import type { ManualChapterSlug } from "../../manual/manual-manifest";
type ManualSidebarProps = {
    currentSlug?: ManualChapterSlug;
    searchActive: boolean;
    onChapterSelect: () => void;
};
/**
 * 章の並び順と現在位置を示すマニュアルナビゲーションを表示する。
 *
 * @param props マニュアル・Sidebarへ渡す表示情報と操作
 * @returns マニュアル・Sidebarを表示するReact要素
 */
export function ManualSidebar(props: ManualSidebarProps) {
    let { currentSlug, searchActive, onChapterSelect } = props;
    return (<aside className="manual-sidebar">
      <p className="manual-sidebar-title">マニュアル目次</p>
      <nav className="manual-toc" aria-label="マニュアル目次">
        {MANUAL_CHAPTERS.map((/**
         * 各検索または表示の対象となるマニュアル章を画面表示用のReact要素へ変換する。
         *
         * @param chapter 検索または表示の対象となるマニュアル章
         * @returns 画面表示用のReact要素
         */
        function mapItem1(chapter) {
            return (<Link key={chapter.slug} to={`/help/${chapter.slug}`} className={chapter.slug === currentSlug ? "active" : undefined} aria-current={chapter.slug === currentSlug ? "page" : undefined} onClick={searchActive ? onChapterSelect : undefined}>
            <span>{chapter.order}</span>
            {chapter.title}
          </Link>);
        }))}
      </nav>
    </aside>);
}
