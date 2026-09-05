import { Link } from "react-router-dom";
import { MANUAL_CHAPTERS } from "../../manual/manual-chapters";
import type { ManualChapterSlug } from "../../manual/manual-manifest";
type ManualSidebarProps = {
    currentSlug?: ManualChapterSlug;
    searchActive: boolean;
    onChapterSelect: () => void;
};
/**
 * ManualSidebarコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function ManualSidebar(props: ManualSidebarProps) {
    let { currentSlug, searchActive, onChapterSelect } = props;
    return (<aside className="manual-sidebar">
      <p className="manual-sidebar-title">マニュアル目次</p>
      <nav className="manual-toc" aria-label="マニュアル目次">
        {MANUAL_CHAPTERS.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param chapter chapterとして使用する値
         * @returns 呼び出し元で使用する処理結果
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
