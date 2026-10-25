import type { ReactNode } from 'react';
import './period-bar.css';
import { msg } from '../i18n';
import { T } from '../i18n/locale-provider';
import { Button } from './ui';
import { PeriodPicker } from './period-picker';
import { reportPresets } from './period-bar-presets';

/**
 * Ряд периода отчётов одной строкой: готовые отрезки, поля «С» и «По», «Показать». Область отчёта или вкладки
 * ставит экран слева через `lead`; адрес остаётся прежним (`from`, `to` и скрытые поля формы).
 */
export function PeriodBar({
  action,
  from,
  to,
  today,
  hidden,
  href,
  lead,
  label,
}: {
  action: string;
  from: string;
  to: string;
  today: string;
  /** остальные поля адреса, которые форма обязана сохранить (`view`, `scope`) */
  hidden?: Record<string, string>;
  href: (from: string, to: string) => string;
  lead?: ReactNode;
  label: string;
}) {
  return (
    <div className="period-bar">
      {lead}
      <form action={action} className="period-bar__form" aria-label={label}>
        <PeriodPicker
          from={from}
          to={to}
          fromName="from"
          toName="to"
          presets={reportPresets(today, from, to, href)}
        />
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <Button type="submit">
          <T text={msg('Показать')} />
        </Button>
      </form>
    </div>
  );
}
