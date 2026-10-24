import { ApiError, marketingBudgetApi, type MarketingResultsView } from '../../../../lib/api';
import { analyticsCsv, buildAnalyticsReport } from '../report';
import { currentMe } from '../../../../lib/desk-shell';
import { serverT } from '../../../../i18n/server';

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * «Аналитика маркетинга» в CSV (МКТ-В6, отчёты и экспорт): каналы и календарь по дням тем же расчётом, что экран.
 * Права и филиал проверяет API (`marketing`, 409 без филиала). Имён гостей в отчёте нет по построению.
 */
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get('month') ?? '';
  const t = await serverT();
  if (!/^\d{4}-\d{2}$/.test(month)) return text(400, t('Месяц: в виде ГГГГ-ММ.'));
  try {
    const view = await marketingBudgetApi.view(month);
    const results: MarketingResultsView | 'error' = await marketingBudgetApi.results(month).catch(() => 'error' as const);
    const vertical = (await currentMe().catch(() => null))?.context?.vertical ?? 'HOSPITALITY';
    return new Response(analyticsCsv(buildAnalyticsReport(view, results), vertical, t), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-marketing-${month}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
