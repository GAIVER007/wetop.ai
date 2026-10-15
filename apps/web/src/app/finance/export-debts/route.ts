import { financeApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';
import { validDate } from '../../../lib/hotel-api';
import { debtsCsv } from '../debts-csv';

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * Выгрузка «Брони с остатком к сбору» за период в CSV (REP1): те же строки, что на вкладке «Долги».
 * Браузер к API напрямую не ходит — стойка берёт ответ с сессией вошедшего и отдаёт файл.
 * `/finance/debts` отдаёт не больше 500 строк — обрезанный список не выгружается, а просит укоротить период.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  if (!validDate(from) || !validDate(to) || from > to)
    return text(400, 'Проверьте даты: окончание периода должно быть не раньше начала.');
  try {
    const debts = await financeApi.debts(from, to);
    if (debts.truncated)
      return text(
        422,
        `Долгов за период больше ${debts.rows.length} — укоротите период и выгрузите по частям.`,
      );
    return new Response(debtsCsv(debts.rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-debts-${from}_${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
