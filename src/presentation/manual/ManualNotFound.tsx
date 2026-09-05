import type { RefObject } from "react";
import { Link } from "react-router-dom";
import { MANUAL_CHAPTERS } from "../../manual/manual-chapters";
/**
 * ManualNotFoundコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param chapter chapterとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem1(chapter) {
        return <li key={chapter.slug}><Link to={`/help/${chapter.slug}`}>{chapter.title}</Link></li>;
    }))}</ul>
    </main>);
}
