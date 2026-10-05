'use client';
import { useEffect, type RefObject } from 'react';

const PREFIX = 'wetop:calendar-position:';
export const RESET_BOARD_POSITION = 'wetop:calendar-today';

/** Coordinates only. No reservation, guest or search data is stored. */
export function useBoardPosition(ref: RefObject<HTMLDivElement | null>, period: string) {
  useEffect(() => {
    const wrap = ref.current;
    if (!wrap || !window.matchMedia('(max-width: 600px)').matches) return;
    const key = PREFIX + period;
    const save = () => {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ x: wrap.scrollLeft, y: wrap.scrollTop, page: window.scrollY }),
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
      } | null;
      if (
        saved &&
        [saved.x, saved.y, saved.page].every((value) => Number.isFinite(value) && value >= 0)
      ) {
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
      restoring = false;
      wrap.scrollLeft = 0;
      wrap.scrollTop = 0;
      const today = wrap.querySelector<HTMLElement>('thead .is-today');
      const first = wrap.querySelector<HTMLElement>('thead [data-testid="date-col"]');
      if (today && first) wrap.scrollLeft = Math.max(0, today.offsetLeft - first.offsetLeft);
      save();
    };
    wrap.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    window.addEventListener(RESET_BOARD_POSITION, reset);
    return () => {
      cancelAnimationFrame(frame);
      if (!restoring) save();
      wrap.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', save);
      window.removeEventListener(RESET_BOARD_POSITION, reset);
    };
  }, [ref, period]);
}
