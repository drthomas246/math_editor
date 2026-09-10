import { X } from "lucide-react";
import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
type ModalProps = PropsWithChildren<{
    title: string;
    onClose: () => void;
    footer?: ReactNode;
    size?: "small" | "medium" | "large";
}>;
/**
 * フォーカスを内部へ閉じ込め、Escape終了と終了後のフォーカス復元を備えたダイアログを表示する。
 *
 * @param props Modalへ渡す表示情報と操作
 * @returns Modalを表示するReact要素
 */
export function Modal(props: ModalProps) {
    let { title, onClose, footer, size = "medium", children } = props;
    const dialogRef = useRef<HTMLDivElement>(null);
    useEffect((/**
     * focusとReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect1() {
        const previous = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        dialog?.focus();
        const onKeyDown = (/**
         * キー・Downの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
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
             * has・Attributeの結果が存在しない要素だけを後続処理へ残す。
             *
             * @param element 走査または監視の対象となる要素
             * @returns has・Attributeの結果が存在しない場合はtrue
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
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources4() {
            document.removeEventListener("keydown", onKeyDown);
            previous?.focus();
        });
    }), [onClose]);
    return (<div className="modal-backdrop" onMouseDown={(/**
     * div要素から画面操作を受け、on・閉じる操作として親コンポーネントへ通知する。
     *
     * @param event 発生したイベント
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
