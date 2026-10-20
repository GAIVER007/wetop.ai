import { unstable_rethrow } from 'next/navigation';
import { ChipGroup, Chip } from '../components/chip';
import { getJsonPublic } from './api';
import { ApiError } from './api-error';
import { STAFF_REVENUE_PERIODS, periodHref, type StaffRevenue, type StaffRevenuePeriod } from './staff-revenue';

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

/** Период ссылками-чипами (DESIGN.md §8: отбор живёт в адресе), «Назад» в браузере работает */
export function StaffRevenuePeriodNav({ path, period }: { path: string; period: StaffRevenuePeriod }) {
  return (
    <ChipGroup as="nav" label="Период для «Принёс»" className="staff-revenue-period">
      {STAFF_REVENUE_PERIODS.map((p) => (
        <Chip key={p.value} size="sm" selected={p.value === period} href={periodHref(path, p.value)}>
          {p.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
