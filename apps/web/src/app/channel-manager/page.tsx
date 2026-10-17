import { requireFeature } from '../../lib/vertical-guard';
import { redirect } from 'next/navigation';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';

/**
 * «Менеджер каналов» слит в модуль «Каналы продаж» (ADR-112): отчёт по источникам живёт на «Обзоре»
 * `/channels`. Старые ссылки с периодом и статусом продолжают работать — параметры переносятся.
 */
export default async function ChannelManagerRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // раздел направления по реестру функций (У1): по прямой ссылке чужое направление уходит на свою стартовую
  await requireFeature('/channel-manager');
  const sp = normalizeSearchParams(await searchParams);
  const u = new URLSearchParams();
  for (const key of ['from', 'to', 'status'] as const) if (sp[key]) u.set(key, sp[key]);
  const s = u.toString();
  redirect(s ? `/channels?${s}` : '/channels');
}
