'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Подсказка над шахматкой. Раскрытый текст выводится поверх планки (`position: absolute` в `board.css`),
 * поэтому он накрывает строку фильтров под собой: пока подсказка открыта, по кнопке «Сбросить» и по
 * фильтрам под ней нельзя попасть мышью. Закрываем её как любую всплывающую подсказку — щелчком вне
 * и по Escape (DESIGN.md §8 «Подсказка»). Найдено обходом стойки 17.09.2026.
 */
export function BoardHelp({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') el.open = false;
        return;
      }
      if (event.target instanceof Node && !el.contains(event.target)) el.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  return (
    <details className="board-help" ref={ref}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
