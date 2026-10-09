'use client';
import { useEffect, useRef, type RefObject } from 'react';
import type { BoardFilters } from './board-filters';

const PREFIX = 'wetop:calendar-position:';
export const RESET_BOARD_POSITION = 'wetop:calendar-today';

export interface BoardSelection {
  query: string;
  filters: BoardFilters;
}

function isSelection(value: unknown): value is BoardSelection {
  if (!value || typeof value !== 'object') return false;
  const v = value as BoardSelection;
  const f = v.filters;
  return (
    typeof v.query === 'string' &&
    !!f &&
    typeof f.category === 'string' &&
    ['', 'ROOM', 'BED'].includes(f.kind) &&
    ['all', 'FREE', 'OCCUPIED', 'BLOCKED', 'cleaning'].includes(f.state) &&
    Array.isArray(f.stays) &&
    f.stays.every((flag) => ['arrival', 'departure', 'inhouse', 'debt'].includes(flag)) &&
    Array.isArray(f.sources) &&
    f.sources.every((source) => typeof source === 'string') &&
    Array.isArray(f.statuses) &&
    f.statuses.every((status) => typeof status === 'string')
  );
}

/** Tab-local UI state only, never reservation or guest records. */
export function useBoardPosition(
  ref: RefObject<HTMLDivElement | null>,
  period: string,
  selection: BoardSelection,
  restoreSelection: (selection: BoardSelection) => void,
) {
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    const wrap = ref.current;
    if (!wrap || !window.matchMedia('(max-width: 600px)').matches) return;
    const key = PREFIX + period;
    const save = () => {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            x: wrap.scrollLeft,
            y: wrap.scrollTop,
            page: window.scrollY,
            selection: selectionRef.current,
          }),
        );
      } catch {
        /* Private browsers can disable storage. Scrolling still works. */
      }
    };
    let frame = 0;
    let restoring = true;
    const onScroll = () => {
      if (!restoring) save();
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as {
        x: number;
        y: number;
        page: number;
        selection?: unknown;
      } | null;
      if (
        saved &&
        [saved.x, saved.y, saved.page].every((value) => Number.isFinite(value) && value >= 0)
      ) {
        if (isSelection(saved.selection)) restoreSelection(saved.selection);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            wrap.scrollLeft = saved.x;
            wrap.scrollTop = saved.y;
            window.scrollTo(0, saved.page);
            restoring = false;
          });
        });
      } else restoring = false;
    } catch {
      restoring = false;
    }
    const reset = () => {
      cancelAnimationFrame(frame);
      restoring = false;
      wrap.scrollLeft = 0;
      wrap.scrollTop = 0;
      const today = wrap.querySelector<HTMLElement>('thead .is-today');
      const first = wrap.querySelector<HTMLElement>('thead [data-testid="date-col"]');
      if (today && first) wrap.scrollLeft = Math.max(0, today.offsetLeft - first.offsetLeft);
      save();
    };
    saveRef.current = onScroll;
    wrap.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    window.addEventListener(RESET_BOARD_POSITION, reset);
    return () => {
      saveRef.current = () => {};
      cancelAnimationFrame(frame);
      if (!restoring) save();
      wrap.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', save);
      window.removeEventListener(RESET_BOARD_POSITION, reset);
    };
  }, [ref, period, restoreSelection]);
  useEffect(() => {
    saveRef.current();
  }, [selection.query, selection.filters]);
}
