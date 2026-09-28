import { notFound, redirect } from 'next/navigation';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';

/** Какие параметры периода переносятся на новый адрес: остальное старые экраны не читали */
const carry = (sp: Record<string, string | undefined>, keys: readonly string[]) => {
  const q = new URLSearchParams();
  for (const k of keys) if (sp[k]) q.set(k, sp[k]!);
  const s = q.toString();
  return s ? `?${s}` : '';
};

/**
 * Хаба «Управление» нет с 15.09.2026; старые адреса и закладки ведут в «Аналитику» (ADR-114).
 * «Статистика» — вкладка «Загрузка» с той же датой. «Показатели за период» (A1, ADR-105) — временный экран
 * до «Аналитики»: со среза AN2 он перенаправляет на «Обзор» с тем же периодом, двух экранов показателей
 * нет (поручение владельца 28.09). «Оплаты по способам» и «Получено оплат» живут в «Оплатах».
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
  const sp = normalizeSearchParams(await searchParams);
  if (section.length === 1 && section[0] === 'statistics')
    redirect(`/management/analytics/occupancy${carry(sp, ['date'])}`);
  if (section.length === 1 && section[0] === 'dashboard')
    redirect(`/management/analytics${carry(sp, ['period', 'from', 'to', 'date'])}`);
  notFound();
}
