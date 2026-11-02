// Phone panels behave like native sheets: drag the top down to close, or between two heights.

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const DISMISS_PX = 70;

interface SheetDrag {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** onUp fires on a drag upward; onDown on a drag downward. */
export function useSheetDrag(onDown: () => void, onUp?: () => void): SheetDrag {
  const start = useRef<number | null>(null);
  const panelOf = (event: ReactPointerEvent<HTMLElement>) => event.currentTarget.closest<HTMLElement>(".st-panel");

  const release = (event: ReactPointerEvent<HTMLElement>) => {
    const panel = panelOf(event);
    if (panel) {
      panel.style.transition = "";
      panel.style.transform = "";
    }
    start.current = null;
  };

  return {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
      start.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      const panel = panelOf(event);
      if (panel) panel.style.transition = "none";
    },
    onPointerMove: (event) => {
      if (start.current === null) return;
      const panel = panelOf(event);
      if (panel) panel.style.transform = `translateY(${Math.max(0, event.clientY - start.current)}px)`;
    },
    onPointerUp: (event) => {
      if (start.current === null) return;
      const moved = event.clientY - start.current;
      release(event);
      if (moved > DISMISS_PX) onDown();
      else if (moved < -24) onUp?.();
    },
    onPointerCancel: release,
  };
}
