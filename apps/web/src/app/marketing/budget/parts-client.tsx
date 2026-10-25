'use client';
import Link from 'next/link';
import { formatMoney } from '../../../lib/money';
import { Icon } from '../../../components/icon';
import { ShareBar } from '../../../components/share-bar';
import { Tabs } from '../../../components/tabs';
import { EmptyState } from '../../../components/ui';
import { useLocale, useT } from '../../../i18n/locale-provider';
import { byPlatform, type BudgetExpense } from './derive';
import { monthShift, monthTitle, platformLabel, type BudgetTab } from './parts';

/**
 * Общие куски трёх экранов бюджета на языке человека (KK3): их рисуют серверные страницы и клиентские панели,
 * а `useT` есть только у клиентского компонента. `parts.tsx` отдаёт их дальше, адреса импорта не менялись.
 */

/** Переключатель месяца: стрелки вокруг названия, адресом страницы (GET, как фильтры /market) */
export function MonthNav({ base, month }: { base: string; month: string }) {
  const t = useT();
  const locale = useLocale();
  return (
    <nav className="budget-month" aria-label={t('Месяц')}>
      <Link
        className="btn btn--secondary btn--sm"
        href={`${base}?month=${monthShift(month, -1)}`}
        aria-label={t('Прошлый месяц: {month}', { month: monthTitle(monthShift(month, -1), locale) })}
        data-testid="budget-month-prev"
      >
        <Icon name="back" width={16} aria-hidden="true" />
      </Link>
      <span className="budget-month__name" data-testid="budget-month-name">
        {monthTitle(month, locale)}
      </span>
      <Link
        className="btn btn--secondary btn--sm"
        href={`${base}?month=${monthShift(month, 1)}`}
        aria-label={t('Следующий месяц: {month}', { month: monthTitle(monthShift(month, 1), locale) })}
        data-testid="budget-month-next"
      >
        <Icon name="chevron" width={16} aria-hidden="true" />
      </Link>
    </nav>
  );
}

/** Вкладки раздела маршрутами, как у «Настроек объекта»: Сводка | План | Расходы | Аналитика */
export function BudgetTabs({ current, month }: { current: BudgetTab; month: string }) {
  const t = useT();
  const q = `?month=${month}`;
  const items = [
    { href: `/marketing/budget${q}`, label: t('Сводка'), current: current === 'summary' },
    { href: `/marketing/budget/plan${q}`, label: t('План'), current: current === 'plan' },
    { href: `/marketing/budget/expenses${q}`, label: t('Расходы'), current: current === 'expenses' },
    // воронка и календарь по дням живут на прежнем адресе «Аналитики маркетинга» (10.10.2026)
    { href: `/marketing/analytics${q}`, label: t('Аналитика'), current: current === 'analytics' },
  ];
  return <Tabs label={t('Разделы бюджета и аналитики')} items={items} className="budget-tabs" />;
}

/** Распределение по платформам: имя, полоса доли, сумма и процент (экраны 2 и 5 макета) */
export function PlatformShares({
  expenses,
  currency,
  testId,
}: {
  expenses: BudgetExpense[];
  currency: string;
  testId: string;
}) {
  const t = useT();
  const rows = byPlatform(expenses);
  if (rows.length === 0)
    return (
      <EmptyState title={t('Расходов ещё нет')}>
        {t('Добавьте первый расход, и распределение по каналам появится здесь.')}
      </EmptyState>
    );
  return (
    <ul className="budget-shares" data-testid={testId}>
      {rows.map((r) => (
        <li key={r.platform} className="budget-shares__row">
          <span className="budget-shares__name">{t(platformLabel(r.platform))}</span>
          <ShareBar label={t('Доля {platform}', { platform: t(platformLabel(r.platform)) })} value={r.share} />
          <span className="budget-shares__money">{formatMoney(r.base, currency)}</span>
          <span className="budget-shares__pct">{r.share} %</span>
        </li>
      ))}
    </ul>
  );
}

/** 409 «Выберите филиал»: объяснение вместо таблиц: бюджет ведётся по филиалу (изоляция ТЗ §8.2) */
export function ChooseLocation() {
  const t = useT();
  return (
    <EmptyState title={t('Выберите филиал')}>
      {t(
        'Бюджет маркетинга ведётся по филиалу. Выберите филиал в переключателе наверху, и здесь появятся план, расходы и аналитика.',
      )}
    </EmptyState>
  );
}
