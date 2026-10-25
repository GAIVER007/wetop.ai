import { unstable_rethrow } from 'next/navigation';
import { requireFeature } from '../../lib/vertical-guard';
import { marketingBudgetApi, marketingSiteApi, type SiteBuilderState } from '../../lib/api';
import { summarize } from './budget/derive';
import { currentLocale } from '../../i18n/server';
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

/** Лицензия конструктора сайта филиала: значок «Сайт и SEO» не обещает «Доступно», когда конструктор выключен */
async function loadBuilder(): Promise<SiteBuilderState | null> {
  try {
    return (await marketingSiteApi.current()).builder ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

export default async function MarketingPage() {
  const me = await requireFeature('/marketing');
  const [spend, builder, locale] = await Promise.all([loadSpend(), loadBuilder(), currentLocale()]);
  return <MarketingHub vertical={me.context?.vertical ?? 'HOSPITALITY'} spend={spend} builder={builder} locale={locale} />;
}
