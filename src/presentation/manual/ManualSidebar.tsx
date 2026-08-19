import { Link } from "react-router-dom";

import { MANUAL_CHAPTERS } from "../../manual/manual-chapters";
import type { ManualChapterSlug } from "../../manual/manual-manifest";

type ManualSidebarProps = {
  currentSlug?: ManualChapterSlug;
  searchActive: boolean;
  onChapterSelect: () => void;
};

export function ManualSidebar({ currentSlug, searchActive, onChapterSelect }: ManualSidebarProps) {
  return (
    <aside className="manual-sidebar">
      <p className="manual-sidebar-title">マニュアル目次</p>
      <nav className="manual-toc" aria-label="マニュアル目次">
        {MANUAL_CHAPTERS.map((chapter) => (
          <Link
            key={chapter.slug}
            to={`/help/${chapter.slug}`}
            className={chapter.slug === currentSlug ? "active" : undefined}
            aria-current={chapter.slug === currentSlug ? "page" : undefined}
            onClick={searchActive ? onChapterSelect : undefined}
          >
            <span>{chapter.order}</span>
            {chapter.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
