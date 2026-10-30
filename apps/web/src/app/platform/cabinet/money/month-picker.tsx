import { Icon } from '../../../../components/icon';
import { translator, type DeskLocale } from '../../../../i18n';
import { monthLabel, shiftMonth } from '../../../branches/month-picker';

/** Месяц денег компании: «‹ октябрь 2026 ›», стрелки ссылками с `?month=` */
export function MonthPicker({
  month,
  locale = 'ru',
  base = '/platform/cabinet/money',
}: {
  month: string;
  locale?: DeskLocale;
  base?: string;
}) {
  const t = translator(locale);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <nav className="cabinet__month" aria-label={t('Месяц отчёта')}>
      <a
        href={`${base}${base.includes('?') ? '&' : '?'}month=${previous}`}
        aria-label={t('Предыдущий месяц: {month}', { month: monthLabel(previous, locale) })}
      >
        <Icon name="back" />
      </a>
      <span className="cabinet__month-label" aria-current="date" data-testid="money-month">
        {monthLabel(month, locale)}
      </span>
      <a
        href={`${base}${base.includes('?') ? '&' : '?'}month=${next}`}
        aria-label={t('Следующий месяц: {month}', { month: monthLabel(next, locale) })}
      >
        <Icon name="arrow" />
      </a>
    </nav>
  );
}
