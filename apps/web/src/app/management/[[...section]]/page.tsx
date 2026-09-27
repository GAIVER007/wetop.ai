import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { notFound, redirect } from 'next/navigation';

/**
 * Хаба «Управление» нет с 15.09.2026. «Статистика» стала вкладкой «Загрузка» модуля «Аналитика»
 * (ADR-108): старые адреса и закладки ведут туда с той же датой.
 */
export default async function ManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { section = [] } = await params;
  if (!section.length) redirect('/management/analytics');
  if (section.length === 1 && section[0] === 'statistics') {
    const { date } = normalizeSearchParams(await searchParams);
    redirect(`/management/analytics/occupancy${date ? `?${new URLSearchParams({ date })}` : ''}`);
  }
  notFound();
}
