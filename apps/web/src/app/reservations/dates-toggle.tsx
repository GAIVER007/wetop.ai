'use client';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui';
import { Icon } from '../../components/icon';

/**
 * «С / По» раскрываются по запросу (приём шахматки, ADR-058; ТЗ «Брони v2» §6, §62): при готовом
 * отрезке панель остаётся компактной. Поля живут внутри той же GET-формы и в свёрнутом виде —
 * поиск и статус уносят текущий период с собой. При ручном периоде блок раскрыт с самого начала.
 */
export function DatesToggle({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="reservations-dates" data-open={open}>
      <Button
        type="button"
        tone="secondary"
        className="reservations-dates__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name="board" />
        Даты
      </Button>
      <div id={id} className="reservations-dates__fields" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
