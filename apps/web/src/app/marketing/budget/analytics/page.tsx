import { redirect } from 'next/navigation';
import { normalizeSearchParams, type SearchParams } from '../../../../lib/search-params';

/**
 * Аналитика бюджета выросла в «Аналитику маркетинга» (поручение владельца 10.10.2026): один раздел
 * эффективности источников на весь маркетинг. Прежний адрес живёт перенаправлением, месяц сохраняется.
 */
export default async function BudgetAnalyticsMoved({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const month = normalizeSearchParams(await searchParams)['month'];
  redirect(month ? `/marketing/analytics?month=${encodeURIComponent(month)}` : '/marketing/analytics');
}
