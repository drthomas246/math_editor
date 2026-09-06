import { CheckCircle2, X } from "lucide-react";
/**
 * 処理結果の短い通知と、必要に応じた取消操作を一定時間表示する。
 *
 * @param props Toastへ渡す表示情報と操作
 * @returns Toastを表示するReact要素
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
