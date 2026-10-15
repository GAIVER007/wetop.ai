import type { ReactNode } from 'react';

/**
 * Ряд связанных полей формы (MV8.5 DS1c, DESIGN.md §8.2): на компьютере `columns` колонок, на
 * телефоне одна. Колонки сжимаются (`minmax(0, 1fr)`), поэтому длинная подпись не выталкивает форму за
 * экран. Ширин в пикселях нет: место делит сетка. `compact` уменьшает промежуток между полями.
 */
export function FormGrid({
  columns = 2,
  density = 'normal',
  className,
  children,
}: {
  columns?: 1 | 2 | 3;
  density?: 'normal' | 'compact';
  className?: string;
  children: ReactNode;
}) {
  const cls = [
    'form-grid',
    `form-grid--${columns}`,
    density === 'compact' && 'form-grid--compact',
    className,
  ].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
