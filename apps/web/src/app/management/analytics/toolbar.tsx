import Link from 'next/link';
import { previousPeriod } from '@pms/domain';
import { Button, cx } from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { Icon } from '../../../components/icon';
import { displayDate } from '../../../lib/display-date';
import { countLabel, intlLocale, msg, translator, type DeskLocale, type Translate } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
import { analyticsMonth } from './vertical/month';
import { AnalyticsMonthNav } from './vertical/month-nav';
import {
  ANALYTICS_PRESETS,
  FUND_LABELS,
  analyticsHref,
  analyticsMonthHref,
  dayPeriod,
  type AnalyticsQuery,
} from './params';

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** «1 сент. — 30 сент., 30 дней»; один день — полностью, с заглавной буквы */
export function rangeCaption(
  from: string,
  to: string,
  locale: DeskLocale = 'ru',
  t: Translate = translator('ru'),
): string {
  const lang = intlLocale(locale);
  const text =
    from === to
      ? displayDate(from, 'full', lang)
      : `${displayDate(from, 'short', lang)} — ${displayDate(to, 'short', lang)}, ${countLabel(locale, t, days(from, to), [msg('день'), 'дня', msg('дней')])}`; // kk-allow: форма склонения
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Полоса вкладок «Обзор» и «Загрузка» (ТЗ §4, §18): готовые отрезки и тип фонда — ссылки, применяются сразу;
 * свой период — родной `<details>` с двумя датами и «Применить» (без JavaScript); сравнение —
 * переключатель-ссылка. У одного дня — стрелки на соседние дни (AN2: «Статистика» смотрела день за днём).
 * Большой кнопки «Показать» нет.
 */
export async function AnalyticsToolbar({
  query,
  today,
  noCompare = false,
  noFund = false,
  monthOnly = false,
}: {
  query: AnalyticsQuery;
  today: string;
  /** «По номерам» (REP3) не считает прошлый отрезок — переключателя сравнения у неё нет */
  noCompare?: boolean;
  /** «Финансы» (RPT2.4a): деньги по объекту не делятся на номера и койки, выбора фонда нет */
  noFund?: boolean;
  /** только месяц «‹ октябрь 2026 ›» (владелец 26.10.2026): без готовых отрезков и своего периода */
  monthOnly?: boolean;
}) {
  const { period, fund, compare } = query;
  const prev = previousPeriod(period.from, period.to);
  const custom = period.preset === 'custom';
  const single = period.from === period.to;
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const lang = intlLocale(locale);
  if (monthOnly) {
    const m = analyticsMonth({ month: period.from.slice(0, 7) }, today);
    return (
      <section className="pa-toolbar" aria-label={t('Период и отбор')} data-testid="pa-toolbar">
        <div className="pa-toolbar__row">
          <AnalyticsMonthNav
            month={m.month}
            previous={m.previousMonth}
            next={m.next}
            href={(month) => analyticsMonthHref(query, month)}
            locale={locale}
            t={t}
          />
          {!noFund && (
            <nav className="seg pa-fund" aria-label={t('Тип фонда')} data-testid="pa-fund">
              {(['all', 'rooms', 'beds'] as const).map((f) => (
                <Link
                  key={f}
                  href={analyticsMonthHref({ ...query, fund: f }, m.month)}
                  className={cx(fund === f && 'is-on')}
                  aria-current={fund === f ? 'page' : undefined}
                >
                  {t(FUND_LABELS[f])}
                </Link>
              ))}
            </nav>
          )}
          {!noCompare && (
            <Link
              href={analyticsMonthHref({ ...query, compare: !compare }, m.month)}
              className={cx('pa-compare', compare && 'is-on')}
              data-testid="pa-compare-toggle"
            >
              <span className="pa-compare__box" aria-hidden="true">
                {compare && <Icon name="check" width={14} height={14} />}
              </span>
              {t('Сравнить с {range}', {
                range:
                  displayDate(prev.from, 'short', lang) +
                  (prev.from !== prev.to ? ` — ${displayDate(prev.to, 'short', lang)}` : ''),
              })}
            </Link>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className="pa-toolbar" aria-label={t('Период и отбор')} data-testid="pa-toolbar">
      <div className="pa-toolbar__head">
        {single && (
          <Link
            href={analyticsHref(query, { period: dayPeriod(period.from, -1, today) })}
            className="btn btn--secondary btn--sm pa-day-step pa-day-step--prev"
            aria-label={t('Предыдущий день')}
            data-testid="pa-day-prev"
          >
            <Icon name="chevron" width={16} height={16} />
          </Link>
        )}
        <p className="pa-toolbar__caption" data-testid="pa-period">
          <strong>{rangeCaption(period.from, period.to, locale, t)}</strong>
          {period.to > today && (
            <span>{single ? t(', по броням') : t(', будущие дни — по броням')}</span>
          )}
        </p>
        {single && (
          <Link
            href={analyticsHref(query, { period: dayPeriod(period.from, 1, today) })}
            className="btn btn--secondary btn--sm pa-day-step"
            aria-label={t('Следующий день')}
            data-testid="pa-day-next"
          >
            <Icon name="chevron" width={16} height={16} />
          </Link>
        )}
      </div>
      <div className="pa-toolbar__row">
        <nav className="seg period-presets" aria-label={t('Период')}>
          {ANALYTICS_PRESETS.map((p) => (
            <Link
              key={p.id}
              href={analyticsHref(query, {
                period: { preset: p.id, from: period.from, to: period.to },
              })}
              className={cx(period.preset === p.id && 'is-on')}
              aria-current={period.preset === p.id ? 'page' : undefined}
            >
              {t(p.label)}
            </Link>
          ))}
        </nav>
        <details className="pa-range">
          <summary className={cx('btn btn--secondary', custom && 'is-on')}>
            <Icon name="today" width={16} height={16} />
            {t('Период')}
          </summary>
          <form method="get" className="pa-range__form" data-testid="pa-range-form">
            <input type="hidden" name="period" value="custom" />
            {fund !== 'all' && <input type="hidden" name="fund" value={fund} />}
            {!compare && <input type="hidden" name="compare" value="0" />}
            <label>
              {t('С')}
              <DateInput name="from" defaultValue={period.from} aria-label={t('Период: с')} />
            </label>
            <label>
              {t('По')}
              <DateInput
                name="to"
                rangeFromName="from"
                defaultValue={period.to}
                aria-label={t('Период: по')}
              />
            </label>
            <Button type="submit" tone="secondary">
              {t('Применить')}
            </Button>
          </form>
        </details>
        {!noFund && (
          <nav className="seg pa-fund" aria-label={t('Тип фонда')} data-testid="pa-fund">
            {(['all', 'rooms', 'beds'] as const).map((f) => (
              <Link
                key={f}
                href={analyticsHref(query, { fund: f })}
                className={cx(fund === f && 'is-on')}
                aria-current={fund === f ? 'page' : undefined}
              >
                {t(FUND_LABELS[f])}
              </Link>
            ))}
          </nav>
        )}
        {!noCompare && (
          <Link
            href={analyticsHref(query, { compare: !compare })}
            className={cx('pa-compare', compare && 'is-on')}
            data-testid="pa-compare-toggle"
          >
            <span className="pa-compare__box" aria-hidden="true">
              {compare && <Icon name="check" width={14} height={14} />}
            </span>
            {t('Сравнить с {range}', {
              range:
                displayDate(prev.from, 'short', lang) +
                (prev.from !== prev.to ? ` — ${displayDate(prev.to, 'short', lang)}` : ''),
            })}
            <span className="sr-only">
              {compare ? t(' — включено, выключить') : t(' — выключено, включить')}
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
