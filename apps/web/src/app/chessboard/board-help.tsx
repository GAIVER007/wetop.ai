'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Подсказка над шахматкой. Раскрытая занимает свою строку планки (`board.css`), а не выводится поверх
 * неё: оверлей накрывал переключатель «Номера / Койки» и фильтры, и попасть по ним мышью было нельзя
 * (обход стойки 17.09.2026). Закрывать её щелчком вне нельзя по той же причине с другой стороны: планка
 * при закрытии уезжает вверх, и нажатие, начатое на кнопке, до неё уже не доходит — кнопку приходилось
 * нажимать дважды. Поэтому закрывают её сама подпись и Escape (DESIGN.md §8 «Подсказка»).
 */
export function BoardHelp({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      const el = ref.current;
      if (el?.open && event.key === 'Escape') el.open = false;
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);
  return (
    <details className="board-help" ref={ref}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
