'use client';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui';
import { Icon } from '../../components/icon';

/**
 * Списки отбора R2 (ADR-106): на широком экране стоят второй строкой панели, кнопка скрыта. На телефоне
 * они за кнопкой «Фильтры», как «С / По» за «Датами», — иначе первая строка списка уходит ниже первого
 * экрана. Заданный отбор держит блок раскрытым: условие не прячется от того, кто его выбрал.
 */
export function FiltersToggle({
  active,
  children,
}: {
  /** Сколько условий задано — число на кнопке и раскрытый блок */
  active: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active > 0);
  const id = useId();
  return (
    <div className="reservations-selects" data-open={open}>
      <Button
        type="button"
        tone="secondary"
        className="reservations-selects__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name="filter" />
        Фильтры{active > 0 ? `: ${active}` : ''}
      </Button>
      <div id={id} className="reservations-selects__fields">
        {children}
      </div>
    </div>
  );
}
