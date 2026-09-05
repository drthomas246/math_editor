import { X } from "lucide-react";
import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
type ModalProps = PropsWithChildren<{
    title: string;
    onClose: () => void;
    footer?: ReactNode;
    size?: "small" | "medium" | "large";
}>;
/**
 * Modalコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function Modal(props: ModalProps) {
    let { title, onClose, footer, size = "medium", children } = props;
    const dialogRef = useRef<HTMLDivElement>(null);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect1() {
        const previous = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        dialog?.focus();
        const onKeyDown = (/**
         * onKeyDownに対応するイベントまたは通知を処理する。
         *
         * @param event 発生したイベント
         */
        function onKeyDownImplementation2(event: KeyboardEvent) {
            if (event.key === "Escape")
                onClose();
            if (event.key !== "Tab" || !dialog)
                return;
            const focusable = [...dialog.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")]
                .filter((/**
             * 対象要素を結果へ残すか判定する。
             *
             * @param element 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function filterItem3(element) {
                return !element.hasAttribute("disabled");
            }));
            const first = focusable[0];
            const last = focusable.at(-1);
            const activeElement = document.activeElement;
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
            }
            else if (!activeElement || !dialog.contains(activeElement)) {
                event.preventDefault();
                (event.shiftKey ? last : first)?.focus();
            }
            else if (event.shiftKey && (activeElement === first || activeElement === dialog)) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        });
        document.addEventListener("keydown", onKeyDown);
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback4() {
            document.removeEventListener("keydown", onKeyDown);
            previous?.focus();
        });
    }), [onClose]);
    return (<div className="modal-backdrop" onMouseDown={(/**
     * onMouseDownで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleMouseDown5(event) {
        return event.target === event.currentTarget && onClose();
    })}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef} tabIndex={-1}>
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="閉じる" title="閉じる" onClick={onClose}><X size={19}/></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>);
}
