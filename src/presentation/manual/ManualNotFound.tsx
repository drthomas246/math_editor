import type { RefObject } from "react";
import { Link } from "react-router-dom";
import { MANUAL_CHAPTERS } from "../../manual/manual-chapters";
/**
 * 存在しない章URLに対して案内と利用可能な章一覧を表示する。
 *
 * @param props マニュアル・Not・Foundへ渡す表示情報と操作
 * @returns マニュアル・Not・Foundを表示するReact要素
 */
export function ManualNotFound(props: {
    headingRef: RefObject<HTMLHeadingElement | null>;
}) {
    let { headingRef } = props;
    return (<main className="manual-main manual-not-found" id="manual-main">
      <h1 ref={headingRef} tabIndex={-1}>マニュアルのページが見つかりません</h1>
      <p>URLを確認するか、目次から読みたい章を選んでください。</p>
      <Link className="primary-button" to="/help/overview">はじめにを見る</Link>
      <h2>章目次</h2>
      <ul>{MANUAL_CHAPTERS.map((/**
     * 各検索または表示の対象となるマニュアル章を画面表示用のReact要素へ変換する。
     *
     * @param chapter 検索または表示の対象となるマニュアル章
     * @returns 画面表示用のReact要素
     */
    function mapItem1(chapter) {
        return <li key={chapter.slug}><Link to={`/help/${chapter.slug}`}>{chapter.title}</Link></li>;
    }))}</ul>
    </main>);
}
