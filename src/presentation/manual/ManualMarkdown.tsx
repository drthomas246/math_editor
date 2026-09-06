import { Children, isValidElement, type ReactNode, useState } from "react";
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { resolveManualAsset } from "../../manual/manual-assets";
const SAFE_WEB_URL = /^https?:\/\//iu;
export const transformManualUrl: UrlTransform = (/**
 * transform・マニュアル・URLをresolve・マニュアル・アセットで処理し、その結果を呼び出し元へ反映する。
 *
 * @param url 安全性の検証または解放を行うURL
 * @param key 保存先または要素を特定するキー
 * @returns 二つの値を比較した結果
 */
function transformManualUrlImplementation1(url, key) {
    if (key === "src")
        return resolveManualAsset(url) ?? "";
    if (url === "/help" || url.startsWith("/help/") || (url.startsWith("/") && !url.startsWith("//")))
        return url;
    if (SAFE_WEB_URL.test(url))
        return url;
    return "";
});
/**
 * テキスト・From・Childrenをjoinで処理し、その結果を呼び出し元へ反映する。
 *
 * @param children Markdown要素内の子コンテンツ
 * @returns 区切り文字で連結した文字列として得た文字列。変換できない場合は関数固有の既定値
 */
function textFromChildren(children: ReactNode): string {
    return Children.toArray(children).map((/**
     * 各走査中の子ノードをStringの結果へ変換する。
     *
     * @param child 走査中の子ノード
     * @returns Stringの結果
     */
    function mapItem2(child) {
        if (typeof child === "string" || typeof child === "number")
            return String(child);
        if (isValidElement<{
            children?: ReactNode;
        }>(child))
            return textFromChildren(child.props.children);
        return "";
    })).join("");
}
const manualMarkdownComponents = {
    /**
     * マニュアル内リンクはアプリ内遷移、外部リンクは安全な新規タブとして表示する。
     *
     * @param callbackInput リンク先と表示内容
     * @returns リンク先の種別に応じたリンク要素
     */
    a(callbackInput) {
        let { href = "", children } = callbackInput;
        if (href === "/help" || href.startsWith("/help/") || (href.startsWith("/") && !href.startsWith("//"))) {
            return <Link to={href}>{children}</Link>;
        }
        if (SAFE_WEB_URL.test(href)) {
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        }
        return <>{children}</>;
    },
    /**
     * 画像だけの段落をキャプション付きfigureへ変換する。
     *
     * @param callbackInput Markdownノードと段落内容
     * @returns 通常段落または画像用figure
     */
    p(callbackInput) {
        let { node, children } = callbackInput;
        const onlyChild = node?.children.length === 1 ? node.children[0] : undefined;
        const imageOnly = onlyChild?.type === "element" && onlyChild.tagName === "img";
        if (!imageOnly)
            return <p>{children}</p>;
        const alt = onlyChild.properties.alt;
        const caption = typeof alt === "string" ? alt : "";
        return <figure className="manual-figure">{children}{caption && <figcaption>{caption}</figcaption>}</figure>;
    },
    /**
     * マニュアル画像を許可済みパスだけで表示するコンポーネントへ渡す。
     *
     * @param callbackInput 画像パスと代替テキスト
     * @returns 検証付きのマニュアル画像
     */
    img(callbackInput) {
        let { src = "", alt = "" } = callbackInput;
        return <ManualImage src={src} alt={alt}/>;
    },
    /**
     * 編集または検証の対象となる表の情報と操作を、画面へ組み込むReact要素として構成する。
     *
     * @param callbackInput 表の内容
     * @returns 編集または検証の対象となる表を表示するReact要素
     */
    table(callbackInput) {
        let { children } = callbackInput;
        return <div className="manual-table-scroll"><table>{children}</table></div>;
    },
    /**
     * blockquoteの情報と操作を、画面へ組み込むReact要素として構成する。
     *
     * @param callbackInput 引用内容
     * @returns blockquoteを表示するReact要素
     */
    blockquote(callbackInput) {
        let { children } = callbackInput;
        const label = textFromChildren(children).trimStart();
        const kind = label.startsWith("重要")
            ? "important"
            : label.startsWith("注意") ? "warning" : label.startsWith("ヒント") ? "tip" : "default";
        return <blockquote className={`manual-callout manual-callout-${kind}`}>{children}</blockquote>;
    },
    /**
     * preの情報と操作を、画面へ組み込むReact要素として構成する。
     *
     * @param callbackInput コードブロックの内容
     * @returns preを表示するReact要素
     */
    pre(callbackInput) {
        let { children } = callbackInput;
        return <pre className="manual-code-block">{children}</pre>;
    },
} satisfies Components;
/**
 * マニュアル・画像の情報と操作を、画面へ組み込むReact要素として構成する。
 *
 * @param props マニュアル・画像へ渡す表示情報と操作
 * @returns マニュアル・画像を表示するReact要素
 */
function ManualImage(props: {
    src: string;
    alt: string;
}) {
    let { src, alt } = props;
    const [failed, setFailed] = useState(!src);
    if (failed)
        return <span className="manual-image-missing" role="img" aria-label={alt || "画像を表示できません"}>{alt || "画像を表示できません"}</span>;
    return <img src={src} alt={alt} onError={(/**
     * img要素から画面操作を受け、Failedを操作内容に合う状態へ更新する。
     */
    function handleError3() {
        return setFailed(true);
    })}/>;
}
/**
 * マニュアルMarkdownを安全なリンクと画像だけを許可したReact要素へ変換する。
 *
 * @param props マニュアル・Markdownへ渡す表示情報と操作
 * @returns マニュアル・Markdownを表示するReact要素
 */
export function ManualMarkdown(props: {
    markdown: string;
}) {
    let { markdown } = props;
    return (<div className="manual-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={transformManualUrl} components={manualMarkdownComponents} remarkRehypeOptions={{ footnoteLabel: "脚注", footnoteBackLabel: "本文へ戻る" }}>
        {markdown}
      </ReactMarkdown>
    </div>);
}
