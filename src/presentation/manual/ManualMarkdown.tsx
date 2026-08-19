import { Children, isValidElement, type ReactNode, useState } from "react";
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { resolveManualAsset } from "../../manual/manual-assets";

const SAFE_WEB_URL = /^https?:\/\//iu;

export const transformManualUrl: UrlTransform = (url, key) => {
  if (key === "src") return resolveManualAsset(url) ?? "";
  if (url === "/help" || url.startsWith("/help/") || (url.startsWith("/") && !url.startsWith("//"))) return url;
  if (SAFE_WEB_URL.test(url)) return url;
  return "";
};

function textFromChildren(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (isValidElement<{ children?: ReactNode }>(child)) return textFromChildren(child.props.children);
    return "";
  }).join("");
}

const manualMarkdownComponents = {
  a({ href = "", children }) {
    if (href === "/help" || href.startsWith("/help/") || (href.startsWith("/") && !href.startsWith("//"))) {
      return <Link to={href}>{children}</Link>;
    }
    if (SAFE_WEB_URL.test(href)) {
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    }
    return <>{children}</>;
  },
  p({ node, children }) {
    const onlyChild = node?.children.length === 1 ? node.children[0] : undefined;
    const imageOnly = onlyChild?.type === "element" && onlyChild.tagName === "img";
    if (!imageOnly) return <p>{children}</p>;
    const alt = onlyChild.properties.alt;
    const caption = typeof alt === "string" ? alt : "";
    return <figure className="manual-figure">{children}{caption && <figcaption>{caption}</figcaption>}</figure>;
  },
  img({ src = "", alt = "" }) {
    return <ManualImage src={src} alt={alt} />;
  },
  table({ children }) {
    return <div className="manual-table-scroll"><table>{children}</table></div>;
  },
  blockquote({ children }) {
    const label = textFromChildren(children).trimStart();
    const kind = label.startsWith("重要")
      ? "important"
      : label.startsWith("注意") ? "warning" : label.startsWith("ヒント") ? "tip" : "default";
    return <blockquote className={`manual-callout manual-callout-${kind}`}>{children}</blockquote>;
  },
  pre({ children }) {
    return <pre className="manual-code-block">{children}</pre>;
  },
} satisfies Components;

function ManualImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(!src);
  if (failed) return <span className="manual-image-missing" role="img" aria-label={alt || "画像を表示できません"}>{alt || "画像を表示できません"}</span>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

export function ManualMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="manual-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={transformManualUrl}
        components={manualMarkdownComponents}
        remarkRehypeOptions={{ footnoteLabel: "脚注", footnoteBackLabel: "本文へ戻る" }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
