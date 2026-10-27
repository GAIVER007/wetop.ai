'use client';
import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Месяц журнала ровно в один экран (владелец 27.10.2026: «когда выберем месяц, график ровно на один экран без
 * лишних свайпов вниз»). Сетка занимает высоту окна от своего верха до низа, недели делят её поровну, а в клетке
 * показывается столько записей, сколько влезает; остальные уходят в «ещё N». Общая для салона и ресторана.
 */
export const MONTH_MIN_SHOWN = 1;
export const MONTH_MAX_SHOWN = 6;

/**
 * Сколько записей влезает в клетку: высота строки минус шапка дня, строка «ещё N» и отступ, делённая на шаг записи.
 * Чистая функция, чтобы проверить её без браузера.
 */
export function monthFit(rowPx: number, headPx: number, chipPx: number, gapPx: number): number {
  if (!(rowPx > 0) || !(chipPx > 0)) return MONTH_MIN_SHOWN;
  // строка «ещё N» такой же высоты, как запись; нижний отступ клетки равен промежутку
  const room = rowPx - headPx - gapPx - (chipPx + gapPx);
  const n = Math.floor((room + gapPx) / (chipPx + gapPx));
  return Math.max(MONTH_MIN_SHOWN, Math.min(MONTH_MAX_SHOWN, n));
}

/** нижнее поле под сеткой, чтобы рамка не прилипала к краю окна */
const BOTTOM_PX = 16;
/** ниже этой высоты строки клетки не сжимаем: экран слишком низкий, лучше прокрутить */
const MIN_ROW_PX = 56;

export function useMonthFit(weeks: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ height: number | null; shown: number }>({ height: null, shown: 3 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const height = Math.floor(window.innerHeight - top - BOTTOM_PX);
      const row = height / weeks;
      if (row < MIN_ROW_PX) {
        setFit((was) => (was.height === null && was.shown === 3 ? was : { height: null, shown: 3 }));
        return;
      }
      const head = el.querySelector<HTMLElement>('.beauty-month-day__head')?.offsetHeight ?? 28;
      const chip = el.querySelector<HTMLElement>('.beauty-month-chip')?.offsetHeight ?? 22;
      const gap = parseFloat(getComputedStyle(el.querySelector('.beauty-month-appointments') ?? el).rowGap) || 4;
      const shown = monthFit(row, head, chip, gap);
      setFit((was) => (was.height === height && was.shown === shown ? was : { height, shown }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [weeks]);
  return {
    ref,
    shown: fit.shown,
    style: fit.height ? { height: `${fit.height}px`, gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` } : undefined,
  };
}
