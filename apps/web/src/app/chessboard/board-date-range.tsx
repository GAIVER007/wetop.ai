'use client';
import { useId, useState } from 'react';
import { Button } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { Icon } from '../../components/icon';

/** Ручной период раскрывается по запросу, чтобы оставлять место календарю. */
export function BoardDateRange({ from, to }: { from: string; to: string }) {
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
          <DateInput name="from" defaultValue={from} aria-label="Шахматка: с" />
        </label>
        <label className="field field--inline">
          <span>По</span>
          <DateInput name="to" rangeFromName="from" defaultValue={to} aria-label="Шахматка: по" />
        </label>
        <Button tone="secondary" type="submit">
          Применить
        </Button>
      </form>
    </div>
  );
}
