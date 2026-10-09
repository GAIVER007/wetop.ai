'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Раскрывашка полосы календаря (период, длина окна): родной `<details>`, который закрывается щелчком
 * вне его и Escape, чтобы две раскрытые не висели одна над другой. Слушаем click, а не pointerdown:
 * выбранная ссылка внутри должна сработать до закрытия.
 */
export function BoardMenu({
  className,
  summary,
  testId,
  title,
  children,
}: {
  className: string;
  summary: ReactNode;
  testId?: string;
  title?: string;
  children: ReactNode;
}) {
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
    <details className={className} ref={ref}>
      <summary data-testid={testId} title={title}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
