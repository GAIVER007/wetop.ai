import { unstable_rethrow } from 'next/navigation';
import { ApiError, marketingBudgetApi, type MarketingBudgetView } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';

/**
 * Общий загрузчик трёх экранов бюджета: месяц из адреса (`?month=ГГГГ-ММ`), данные одним запросом.
 * 409 «Выберите филиал»: не ошибка, а состояние: бюджет ведётся по филиалу (ТЗ §8.2).
 */
export interface BudgetLoad {
  view: MarketingBudgetView | null;
  chooseLocation: boolean;
  error: ReturnType<typeof loadErrorProps> | null;
}

export async function loadBudget(searchParams: SearchParams): Promise<BudgetLoad> {
  const q = normalizeSearchParams(searchParams);
  const month = /^\d{4}-\d{2}$/.test(q['month'] ?? '') ? q['month'] : undefined;
  try {
    return { view: await marketingBudgetApi.view(month), chooseLocation: false, error: null };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 409)
      return { view: null, chooseLocation: true, error: null };
    return { view: null, chooseLocation: false, error: loadErrorProps(e) };
  }
}
