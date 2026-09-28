import Link from 'next/link';
import { previousPeriod } from '@pms/domain';
import { Button, cx } from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { Icon } from '../../../components/icon';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { ANALYTICS_PRESETS, FUND_LABELS, analyticsHref, type AnalyticsQuery } from './params';

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** «1 сент. — 30 сент., 30 дней»; один день — полностью, с заглавной буквы */
export function rangeCaption(from: string, to: string): string {
  const text =
    from === to
      ? displayDate(from, 'full')
      : `${displayDate(from)} — ${displayDate(to)}, ${pluralRu(days(from, to), ['день', 'дня', 'дней'])}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Полоса «Обзора» (ТЗ §4, §18): готовые отрезки и тип фонда — ссылки, применяются сразу; свой период —
 * родной `<details>` с двумя датами и «Применить» (без JavaScript); сравнение — переключатель-ссылка.
 * Большой кнопки «Показать» нет.
 */
export function AnalyticsToolbar({ query, today }: { query: AnalyticsQuery; today: string }) {
  const { period, fund, compare } = query;
  const prev = previousPeriod(period.from, period.to);
  const custom = period.preset === 'custom';
  return (
    <section className="pa-toolbar" aria-label="Период и отбор" data-testid="pa-toolbar">
      <p className="pa-toolbar__caption" data-testid="pa-period">
        <strong>{rangeCaption(period.from, period.to)}</strong>
        {period.to > today && <span>, будущие дни — по броням</span>}
      </p>
      <div className="pa-toolbar__row">
        <nav className="seg period-presets" aria-label="Период">
          {ANALYTICS_PRESETS.map((p) => (
            <Link
              key={p.id}
              href={analyticsHref(query, {
                period: { preset: p.id, from: period.from, to: period.to },
              })}
              className={cx(period.preset === p.id && 'is-on')}
              aria-current={period.preset === p.id ? 'page' : undefined}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <details className="pa-range">
          <summary className={cx('btn btn--secondary', custom && 'is-on')}>
            <Icon name="today" width={16} height={16} />
            Период
          </summary>
          <form method="get" className="pa-range__form" data-testid="pa-range-form">
            <input type="hidden" name="period" value="custom" />
            {fund !== 'all' && <input type="hidden" name="fund" value={fund} />}
            {!compare && <input type="hidden" name="compare" value="0" />}
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
              Применить
            </Button>
          </form>
        </details>
        <nav className="seg pa-fund" aria-label="Тип фонда" data-testid="pa-fund">
          {(['all', 'rooms', 'beds'] as const).map((f) => (
            <Link
              key={f}
              href={analyticsHref(query, { fund: f })}
              className={cx(fund === f && 'is-on')}
              aria-current={fund === f ? 'page' : undefined}
            >
              {FUND_LABELS[f]}
            </Link>
          ))}
        </nav>
        <Link
          href={analyticsHref(query, { compare: !compare })}
          className={cx('pa-compare', compare && 'is-on')}
          data-testid="pa-compare-toggle"
        >
          <span className="pa-compare__box" aria-hidden="true">
            {compare && <Icon name="check" width={14} height={14} />}
          </span>
          Сравнить с {displayDate(prev.from)}
          {prev.from !== prev.to && ` — ${displayDate(prev.to)}`}
          <span className="sr-only">
            {compare ? ' — включено, выключить' : ' — выключено, включить'}
          </span>
        </Link>
      </div>
    </section>
  );
}
