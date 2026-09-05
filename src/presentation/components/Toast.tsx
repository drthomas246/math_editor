import { CheckCircle2, X } from "lucide-react";
/**
 * Toastコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function Toast(props: {
    message: string;
    action?: string;
    onAction?: () => void;
    onClose: () => void;
    disabled?: boolean;
}) {
    let { message, action, onAction, onClose, disabled = false } = props;
    return (<div className="toast" role="status">
      <CheckCircle2 size={18}/>
      <span>{message}</span>
      {action && <button className="text-button" disabled={disabled} onClick={onAction}>{action}</button>}
      <button className="icon-button icon-button-inverse" aria-label="通知を閉じる" disabled={disabled} onClick={onClose}><X size={16}/></button>
    </div>);
}
