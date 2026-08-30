import { CheckCircle2, X } from "lucide-react";

export function Toast({ message, action, onAction, onClose, disabled = false }: { message: string; action?: string; onAction?: () => void; onClose: () => void; disabled?: boolean }) {
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={18} />
      <span>{message}</span>
      {action && <button className="text-button" disabled={disabled} onClick={onAction}>{action}</button>}
      <button className="icon-button icon-button-inverse" aria-label="通知を閉じる" disabled={disabled} onClick={onClose}><X size={16} /></button>
    </div>
  );
}
