import { unstable_rethrow } from 'next/navigation';
import { requireVertical } from '../../lib/vertical-guard';
import { marketingBudgetApi } from '../../lib/api';
import { summarize } from './budget/derive';
import { MarketingHub, type HubSpend } from './hub';

/** Хаб читает одно: бюджет филиала за текущий месяц. Нет филиала или ошибка: «Нет данных», хаб не падает. */
async function loadSpend(): Promise<HubSpend | null> {
  try {
    const view = await marketingBudgetApi.view();
    return {
      month: view.month,
      spentMinor: summarize(view).spent.toString(),
      planMinor: view.plan,
      currency: view.reportingCurrency,
    };
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

export default async function MarketingPage() {
  const me = await requireVertical(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']);
  return <MarketingHub vertical={me.context?.vertical ?? 'HOSPITALITY'} spend={await loadSpend()} />;
}
