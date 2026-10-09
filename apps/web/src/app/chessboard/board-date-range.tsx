'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { Icon } from '../../components/icon';

/**
 * Ручной период раскрывается по запросу, чтобы оставлять место календарю.
 * Здесь же живут готовые периоды (ТЗ «Шахматка v2» §6–7): 7/14/30 дней и календарный месяц.
 * Из строки управления их убрал владелец 09.10.2026: шапка календаря стала компактнее,
 * а весь выбор дат собрался в одном месте.
 */
export function BoardDateRange({
  from,
  to,
  periods,
}: {
  from: string;
  to: string;
  periods?: ReadonlyArray<{ href: string; label: string; current?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="board-custom-range" data-open={open}>
      <Button
        type="button"
        tone="secondary"
        className="board-custom-range-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name="board" />
        Даты
      </Button>
      <form id={id} method="get" className="board-range-form">
        <label className="field field--inline">
          <span>С</span>
          <DateInput name="from" defaultValue={from} aria-label="Календарь: с" />
        </label>
        <label className="field field--inline">
          <span>По</span>
          <DateInput name="to" rangeFromName="from" defaultValue={to} aria-label="Календарь: по" />
        </label>
        <Button tone="secondary" type="submit">
          Применить
        </Button>
        {periods && periods.length > 0 && (
          <span className="board-quick-periods" role="group" aria-label="Готовые периоды календаря">
            {periods.map((p) => (
              <Link
                key={p.label}
                href={p.href}
                className="btn btn--secondary"
                aria-current={p.current ? 'true' : undefined}
              >
                {p.label}
              </Link>
            ))}
          </span>
        )}
      </form>
    </div>
  );
}
