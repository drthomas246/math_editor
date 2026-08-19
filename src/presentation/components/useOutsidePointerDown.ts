import { useEffect, type RefObject } from "react";

export function useOutsidePointerDown<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  enabled: boolean,
  onOutsidePointerDown: () => void,
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || containerRef.current?.contains(target)) return;
      onOutsidePointerDown();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [containerRef, enabled, onOutsidePointerDown]);
}
