'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Подсказка раскрывается в потоке, не перекрывая фильтры. Щелчок вне и Escape закрывают её.
 * Слушаем click, а не pointerdown: выбранный фильтр должен сработать до сдвига разметки.
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
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
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
