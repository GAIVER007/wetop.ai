import { redirect } from 'next/navigation';

/**
 * «Расходы» живут вкладкой в «Деньгах WETOP» (вариант Б, владелец 01.11.2026): старые ссылки и закладки ведут туда же,
 * с тем же месяцем и статьёй.
 */
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const month = typeof q['month'] === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(q['month']) ? `&month=${q['month']}` : '';
  const category = typeof q['category'] === 'string' && /^[A-Z_]{1,40}$/.test(q['category']) ? `&category=${q['category']}` : '';
  redirect(`/platform/cabinet/money?tab=out${month}${category}`);
}
