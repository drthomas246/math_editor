import { useEffect, type RefObject } from "react";
/**
 * useOutsidePointerDownに必要な処理を実行する。
 *
 * @param containerRef containerRefとして使用する値
 * @param enabled enabledとして使用する値
 * @param onOutsidePointerDown onOutsidePointerDownとして使用する値
 */
export function useOutsidePointerDown<T extends HTMLElement>(containerRef: RefObject<T | null>, enabled: boolean, onOutsidePointerDown: () => void) {
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect1() {
        if (!enabled)
            return;
        const handlePointerDown = (/**
         * handlePointerDownに対応するイベントまたは通知を処理する。
         *
         * @param event 発生したイベント
         */
        function handlePointerDownImplementation2(event: PointerEvent) {
            const target = event.target;
            if (!(target instanceof Node) || containerRef.current?.contains(target))
                return;
            onOutsidePointerDown();
        });
        document.addEventListener("pointerdown", handlePointerDown, true);
        return (/**
         * 呼び出し元から要求された処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function commentRuleCallback3() {
            return document.removeEventListener("pointerdown", handlePointerDown, true);
        });
    }), [containerRef, enabled, onOutsidePointerDown]);
}
