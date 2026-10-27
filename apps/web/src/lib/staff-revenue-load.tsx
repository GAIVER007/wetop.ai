import { unstable_rethrow } from 'next/navigation';
import { ChipGroup, Chip } from '../components/chip';
import { getJsonPublic } from './api';
import { ApiError } from './api-error';
import { serverT } from '../i18n/server';
import { STAFF_REVENUE_PERIODS, periodHref, type StaffRevenue, type StaffRevenuePeriod } from './staff-revenue';

/**
 * Свод «сколько принёс» (docs/decisions/2026-10-20-personnel-revenue.md). Сумма дополняет список персонала и не
 * должна его ломать: без права на отчёты, без кассы филиала или при сбое API колонки нет (null), список открыт.
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
    if (!(error instanceof ApiError) || error.status !== 403)
      console.warn('staff revenue unavailable', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Период ссылками-чипами (DESIGN.md §8: отбор живёт в адресе), «Назад» в браузере работает */
export async function StaffRevenuePeriodNav({ path, period }: { path: string; period: StaffRevenuePeriod }) {
  const t = await serverT();
  return (
    <ChipGroup as="nav" label={t('Период для «Принёс»')} className="staff-revenue-period">
      {STAFF_REVENUE_PERIODS.map((p) => (
        <Chip key={p.value} size="sm" selected={p.value === period} href={periodHref(path, p.value)}>
          {t(p.label)}
        </Chip>
      ))}
    </ChipGroup>
  );
}
