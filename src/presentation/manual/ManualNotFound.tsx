import type { RefObject } from "react";
import { Link } from "react-router-dom";

import { MANUAL_CHAPTERS } from "../../manual/manual-chapters";

export function ManualNotFound({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <main className="manual-main manual-not-found" id="manual-main">
      <h1 ref={headingRef} tabIndex={-1}>マニュアルのページが見つかりません</h1>
      <p>URLを確認するか、目次から読みたい章を選んでください。</p>
      <Link className="primary-button" to="/help/overview">はじめにを見る</Link>
      <h2>章目次</h2>
      <ul>{MANUAL_CHAPTERS.map((chapter) => <li key={chapter.slug}><Link to={`/help/${chapter.slug}`}>{chapter.title}</Link></li>)}</ul>
    </main>
  );
}
