import Link from 'next/link';
import { PERIOD_PRESETS, type ResolvedPeriod } from '@pms/domain';
import { Button, cx } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';

/** Подпись периода: один день — полностью, отрезок — «1 сент. — 30 сент. · 30 дней» */
export function periodCaption(period: { from: string; to: string }): string {
  if (period.from === period.to) return displayDate(period.from, 'full');
  const days =
    Math.round(
      (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  return `${displayDate(period.from)} — ${displayDate(period.to)} · ${pluralRu(days, ['день', 'дня', 'дней'])}`;
}

/** Готовые отрезки — ссылки (GET, без JS), свой отрезок — форма с двумя датами. */
export function PeriodBar({ period, today }: { period: ResolvedPeriod; today: string }) {
  return (
    <nav className="period-bar" aria-label="Период показателей">
      <div className="seg period-presets">
        {PERIOD_PRESETS.map((p) => (
          <Link
            key={p.id}
            href={`/today?period=${p.id}`}
            className={cx(period.preset === p.id && 'is-on')}
            aria-current={period.preset === p.id ? 'page' : undefined}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" className="period-custom" data-testid="period-form">
        <input type="hidden" name="period" value="custom" />
        <label>
          С<DateInput name="from" defaultValue={period.from} aria-label="Период: с" />
        </label>
        <label>
          По
          <DateInput
            name="to"
            rangeFromName="from"
            defaultValue={period.to}
            aria-label="Период: по"
          />
        </label>
        <Button type="submit" tone="secondary">
          Показать
        </Button>
      </form>
      <p className="period-caption" data-testid="period-caption">
        <strong>{periodCaption(period)}</strong>
        {period.to > today && <span> · включая будущие брони</span>}
      </p>
    </nav>
  );
}
