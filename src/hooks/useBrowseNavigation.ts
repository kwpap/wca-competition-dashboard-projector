import { useEffect, useRef } from 'react';

export interface BrowseActions {
  next: () => void;
  previous: () => void;
  nextEvent: () => void;
  previousEvent: () => void;
}

const SWIPE_MIN_PX = 80;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Arrow keys step one group, Ctrl+arrows step one event.
 * A horizontal touch swipe works like the plain arrows.
 */
export function useBrowseNavigation(actions: BrowseActions, enabled: boolean): void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const a = actionsRef.current;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.ctrlKey) a.nextEvent();
        else a.next();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (event.ctrlKey) a.previousEvent();
        else a.previous();
      }
    }

    let start: { x: number; y: number } | null = null;

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' || !event.isPrimary || isTyping(event.target)) return;
      start = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event: PointerEvent) {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
      if (dx < 0) actionsRef.current.next();
      else actionsRef.current.previous();
    }

    function onPointerCancel() {
      start = null;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [enabled]);
}
