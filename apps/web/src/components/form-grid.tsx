import type { ReactNode } from 'react';

/**
 * Ряд связанных полей формы (MV8.5 DS1c, DESIGN.md §8.2): на компьютере `columns` колонок, на
 * телефоне одна. Колонки сжимаются (`minmax(0, 1fr)`), поэтому длинная подпись не выталкивает форму за
 * экран. Ширин в пикселях нет: место делит сетка.
 */
export function FormGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const cls = ['form-grid', `form-grid--${columns}`, className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
