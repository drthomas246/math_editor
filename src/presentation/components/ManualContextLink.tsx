import { CircleHelp, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { MANUAL_TOPIC_CHAPTERS, type ManualTopic } from "../../manual/manual-context";
type ManualContextLinkProps = {
    topic: ManualTopic;
    children?: ReactNode;
    variant?: "text" | "icon";
    className?: string;
};
/**
 * ManualContextLinkコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function ManualContextLink(props: ManualContextLinkProps) {
    let { topic, children, variant = "text", className, } = props;
    const href = `/help/${MANUAL_TOPIC_CHAPTERS[topic]}`;
    if (variant === "icon") {
        return (<a className={["icon-button", "manual-context-icon", className].filter(Boolean).join(" ")} href={href} target="_blank" rel="noopener noreferrer" aria-label="編集の詳しい使い方を新しいタブで開く" title="使い方を新しいタブで開く">
        <CircleHelp size={18}/>
      </a>);
    }
    return (<a className={["manual-context-link", className].filter(Boolean).join(" ")} href={href} target="_blank" rel="noopener noreferrer">
      {children ?? "詳しい使い方"}<ExternalLink size={13} aria-hidden="true"/>
    </a>);
}
