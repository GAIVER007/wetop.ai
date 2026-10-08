import type { ReactNode } from 'react';

/**
 * Полоса инструментов над списком (MV8.5 DS1b, DESIGN.md §8.1). Слоты всегда идут в одном порядке:
 * поиск, отбор, период, действия; так идёт Tab, и CSS этот порядок не переставляет. Пустой слот не рисуется.
 */
export function Toolbar({
  label,
  search,
  filters,
  period,
  actions,
  className,
}: {
  label: string;
  search?: ReactNode;
  filters?: ReactNode;
  period?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const slots = { search, filters, period, actions };
  return (
    <div className={className ? `toolbar ${className}` : 'toolbar'} role="group" aria-label={label}>
      {(['search', 'filters', 'period', 'actions'] as const).map((slot) =>
        slots[slot] === undefined || slots[slot] === null || slots[slot] === false ? null : (
          <div key={slot} className={`toolbar__${slot}`}>
            {slots[slot]}
          </div>
        ),
      )}
    </div>
  );
}
