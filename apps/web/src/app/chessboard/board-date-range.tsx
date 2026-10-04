'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { Icon } from '../../components/icon';

/**
 * Ручной период раскрывается по запросу, чтобы оставлять место календарю.
 * Календарный месяц живёт здесь же (ТЗ «Шахматка v2» §7): в сегменте видов — rolling 7/14/30.
 */
export function BoardDateRange({
  from,
  to,
  monthHref,
  monthCurrent,
}: {
  from: string;
  to: string;
  monthHref?: string;
  monthCurrent?: boolean;
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
        {monthHref && (
          <Link
            href={monthHref}
            className="btn btn--secondary"
            aria-current={monthCurrent ? 'true' : undefined}
          >
            Месяц
          </Link>
        )}
      </form>
    </div>
  );
}
