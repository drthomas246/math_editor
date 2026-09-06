import { useEffect, type RefObject } from "react";
/**
 * 指定DOM領域の外側で発生したpointerdownだけを検出し、呼び出し元へ通知する。
 *
 * @param containerRef 内外判定の基準となるDOM要素への参照
 * @param enabled 外側クリック監視を有効にするかどうか
 * @param onOutsidePointerDown 対象領域の外側を押したときに通知する処理
 */
export function useOutsidePointerDown<T extends HTMLElement>(containerRef: RefObject<T | null>, enabled: boolean, onOutsidePointerDown: () => void) {
    useEffect((/**
     * add・イベント・ListenerとReact状態を同期し、再実行前に古い購読や一時リソースを後始末する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
     */
    function synchronizeEffect1() {
        if (!enabled)
            return;
        const handlePointerDown = (/**
         * Pointer・Downの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
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
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function releaseResources3() {
            return document.removeEventListener("pointerdown", handlePointerDown, true);
        });
    }), [containerRef, enabled, onOutsidePointerDown]);
}
