'use client';
import { useId, useState } from 'react';
import { Button, Input } from '../../components/ui';
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
          <Input type="date" name="from" defaultValue={from} aria-label="Шахматка: с" />
        </label>
        <label className="field field--inline">
          <span>По</span>
          <Input type="date" name="to" defaultValue={to} aria-label="Шахматка: по" />
        </label>
        <Button tone="secondary" type="submit">
          Применить
        </Button>
      </form>
    </div>
  );
}
