import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { getJsonPublic } from '../lib/api';
import { ApiError } from '../lib/api-error';
import {
  STAFF_REVENUE_PERIODS,
  periodHref,
  type StaffRevenue,
  type StaffRevenuePeriod,
} from '../lib/staff-revenue';

/**
 * Свод «сколько принёс» (docs/decisions/2026-10-20-personnel-revenue.md). Без права на отчёты (403) колонку не
 * показываем: null. Остальные ошибки видны границей ошибок страницы.
 */
export async function loadStaffRevenue(
  source: 'branch' | 'hotel',
  period: StaffRevenuePeriod,
): Promise<StaffRevenue | null> {
  const path = source === 'hotel' ? '/finance/staff-revenue' : '/food-service/staff-revenue';
  try {
    return await getJsonPublic<StaffRevenue>(`${path}?period=${period}`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}

/** Переключатель периода ссылками: адрес хранит выбор, «Назад» в браузере работает */
export function StaffRevenuePeriodNav({ path, period }: { path: string; period: StaffRevenuePeriod }) {
  return (
    <nav className="seg seg--sm staff-revenue-period" aria-label="Период для «Принёс»">
      {STAFF_REVENUE_PERIODS.map((p) => (
        <Link
          key={p.value}
          href={periodHref(path, p.value)}
          className={p.value === period ? 'is-on' : undefined}
          aria-current={p.value === period ? 'page' : undefined}
          scroll={false}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
