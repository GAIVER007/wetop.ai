import Link from 'next/link';
import { MARKETING_PLATFORM_LABELS } from '@pms/domain';
import type { MarketingBudgetView } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Icon } from '../../../components/icon';
import { ShareBar } from '../../../components/share-bar';
import { Tabs } from '../../../components/tabs';
import { EmptyState } from '../../../components/ui';
import { byPlatform, type BudgetExpense } from './derive';

/** Подписи каналов (ТЗ §4): словами, как на макете */
export const PLATFORM_LABELS: Record<string, string> = MARKETING_PLATFORM_LABELS;
export const platformLabel = (p: string): string => PLATFORM_LABELS[p] ?? p;

/** Статьи-подсказки формы: свободный текст, список не ограничивает (DATA_MODEL §41.1) */
export const CATEGORY_HINTS = ['Реклама', 'Креативы', 'Инфлюенсеры', 'Подписки и сервисы', 'Прочее'];

const MONTH_NAME = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

/** «Октябрь 2026» из «2026-10» */
export function monthTitle(month: string): string {
  const text = MONTH_NAME.format(new Date(`${month}-01T00:00:00Z`));
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(/\s*г\.$/, '');
}

export function monthShift(month: string, shift: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + shift;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Переключатель месяца: стрелки вокруг названия, адресом страницы (GET, как фильтры /market) */
export function MonthNav({ base, month }: { base: string; month: string }) {
  return (
    <nav className="budget-month" aria-label="Месяц">
      <Link
        className="btn btn--secondary btn--sm"
        href={`${base}?month=${monthShift(month, -1)}`}
        aria-label={`Прошлый месяц: ${monthTitle(monthShift(month, -1))}`}
        data-testid="budget-month-prev"
      >
        <Icon name="back" width={16} aria-hidden="true" />
      </Link>
      <span className="budget-month__name" data-testid="budget-month-name">
        {monthTitle(month)}
      </span>
      <Link
        className="btn btn--secondary btn--sm"
        href={`${base}?month=${monthShift(month, 1)}`}
        aria-label={`Следующий месяц: ${monthTitle(monthShift(month, 1))}`}
        data-testid="budget-month-next"
      >
        <Icon name="chevron" width={16} aria-hidden="true" />
      </Link>
    </nav>
  );
}

/** Заголовок раздела на всех вкладках: один пункт меню «Бюджет и аналитика» (решение владельца 20.10.2026) */
export const BUDGET_TITLE = 'Бюджет и аналитика';

export type BudgetTab = 'summary' | 'plan' | 'expenses' | 'analytics';

/** Вкладки раздела маршрутами, как у «Настроек объекта»: Сводка | План | Расходы | Аналитика */
export function BudgetTabs({ current, month }: { current: BudgetTab; month: string }) {
  const q = `?month=${month}`;
  const items = [
    { href: `/marketing/budget${q}`, label: 'Сводка', current: current === 'summary' },
    { href: `/marketing/budget/plan${q}`, label: 'План', current: current === 'plan' },
    { href: `/marketing/budget/expenses${q}`, label: 'Расходы', current: current === 'expenses' },
    // воронка и календарь по дням живут на прежнем адресе «Аналитики маркетинга» (10.10.2026)
    { href: `/marketing/analytics${q}`, label: 'Аналитика', current: current === 'analytics' },
  ];
  return <Tabs label="Разделы бюджета и аналитики" items={items} className="budget-tabs" />;
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
  const rows = byPlatform(expenses);
  if (rows.length === 0)
    return (
      <EmptyState title="Расходов ещё нет">
        Добавьте первый расход, и распределение по каналам появится здесь.
      </EmptyState>
    );
  return (
    <ul className="budget-shares" data-testid={testId}>
      {rows.map((r) => (
        <li key={r.platform} className="budget-shares__row">
          <span className="budget-shares__name">{platformLabel(r.platform)}</span>
          <ShareBar label={`Доля ${platformLabel(r.platform)}`} value={r.share} />
          <span className="budget-shares__money">{formatMoney(r.base, currency)}</span>
          <span className="budget-shares__pct">{r.share} %</span>
        </li>
      ))}
    </ul>
  );
}

/** 409 «Выберите филиал»: объяснение вместо таблиц: бюджет ведётся по филиалу (изоляция ТЗ §8.2) */
export function ChooseLocation() {
  return (
    <EmptyState title="Выберите филиал">
      Бюджет маркетинга ведётся по филиалу. Выберите филиал в переключателе наверху, и здесь
      появятся план, расходы и аналитика.
    </EmptyState>
  );
}

export type { MarketingBudgetView };
