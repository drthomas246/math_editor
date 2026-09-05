import { Children, isValidElement, type ReactNode, useState } from "react";
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { resolveManualAsset } from "../../manual/manual-assets";
const SAFE_WEB_URL = /^https?:\/\//iu;
export const transformManualUrl: UrlTransform = (/**
 * transformManualUrlに必要な処理を実行する。
 *
 * @param url urlとして使用する値
 * @param key keyとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
 * textFromChildrenに必要な処理を実行する。
 *
 * @param children childrenとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function textFromChildren(children: ReactNode): string {
    return Children.toArray(children).map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param child childとして使用する値
     * @returns 呼び出し元で使用する処理結果
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
     * aに必要な処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    a(parameter1) {
        let { href = "", children } = parameter1;
        if (href === "/help" || href.startsWith("/help/") || (href.startsWith("/") && !href.startsWith("//"))) {
            return <Link to={href}>{children}</Link>;
        }
        if (SAFE_WEB_URL.test(href)) {
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        }
        return <>{children}</>;
    },
    /**
     * pに必要な処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    p(parameter1) {
        let { node, children } = parameter1;
        const onlyChild = node?.children.length === 1 ? node.children[0] : undefined;
        const imageOnly = onlyChild?.type === "element" && onlyChild.tagName === "img";
        if (!imageOnly)
            return <p>{children}</p>;
        const alt = onlyChild.properties.alt;
        const caption = typeof alt === "string" ? alt : "";
        return <figure className="manual-figure">{children}{caption && <figcaption>{caption}</figcaption>}</figure>;
    },
    /**
     * imgに必要な処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    img(parameter1) {
        let { src = "", alt = "" } = parameter1;
        return <ManualImage src={src} alt={alt}/>;
    },
    /**
     * tableに必要な処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    table(parameter1) {
        let { children } = parameter1;
        return <div className="manual-table-scroll"><table>{children}</table></div>;
    },
    /**
     * blockquoteに必要な処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    blockquote(parameter1) {
        let { children } = parameter1;
        const label = textFromChildren(children).trimStart();
        const kind = label.startsWith("重要")
            ? "important"
            : label.startsWith("注意") ? "warning" : label.startsWith("ヒント") ? "tip" : "default";
        return <blockquote className={`manual-callout manual-callout-${kind}`}>{children}</blockquote>;
    },
    /**
     * preに必要な処理を実行する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    pre(parameter1) {
        let { children } = parameter1;
        return <pre className="manual-code-block">{children}</pre>;
    },
} satisfies Components;
/**
 * ManualImageコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * onErrorで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleError3() {
        return setFailed(true);
    })}/>;
}
/**
 * ManualMarkdownコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
