import Link from 'next/link';
import { Icon } from '../../../../components/icon';
import { monthLabel } from '../../../branches/month-picker';
import type { DeskLocale, Translate } from '../../../../i18n';

/**
 * Переключатель месяца «Аналитики» (владелец 26.10.2026): «‹ октябрь 2026 ›» крупными кнопками-ссылками, без полей
 * дат и готовых отрезков. Вперёд дальше текущего месяца нельзя.
 */
export function AnalyticsMonthNav({
  month,
  previous,
  next,
  href,
  locale,
  t,
}: {
  month: string;
  previous: string;
  next: string | null;
  href: (month: string) => string;
  locale: DeskLocale;
  t: Translate;
}) {
  return (
    <nav className="analytics-month" aria-label={t('Месяц отчёта')} data-testid="analytics-month">
      <Link
        className="analytics-month__step"
        href={href(previous)}
        aria-label={t('Предыдущий месяц: {month}', { month: monthLabel(previous, locale) })}
        data-testid="analytics-month-prev"
      >
        <Icon name="back" />
      </Link>
      <span className="analytics-month__label" aria-current="date" data-testid="analytics-month-label">
        {monthLabel(month, locale)}
      </span>
      {next ? (
        <Link
          className="analytics-month__step"
          href={href(next)}
          aria-label={t('Следующий месяц: {month}', { month: monthLabel(next, locale) })}
          data-testid="analytics-month-next"
        >
          <Icon name="arrow" />
        </Link>
      ) : (
        <span className="analytics-month__step is-disabled" aria-hidden="true">
          <Icon name="arrow" />
        </span>
      )}
    </nav>
  );
}
