import { financeApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';
import { validDate } from '../../../lib/hotel-api';
import { operationsCsv } from '../operations-csv';
import { operationFilter } from '../operation-filter';

/** Предел API: больше строк за один запрос не отдаётся — тогда отказ словами, а не обрезанный файл */
const MAX_ROWS = 20_000;

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * Выгрузка «Оплаты и возвраты» за период в CSV (ADR-113, F2): те же операции и те же отборы, что на экране. Браузер к
 * API напрямую не ходит — стойка берёт ответ с сессией вошедшего и отдаёт файл.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  if (!validDate(from) || !validDate(to) || from > to)
    return text(400, 'Проверьте даты: окончание периода должно быть не раньше начала.');
  const { type, method, source } = operationFilter(q.get('op'), q.get('method'), q.get('src'));
  try {
    const ops = await financeApi.operations(from, to, { type, method, source, limit: MAX_ROWS });
    if (ops.truncated)
      return text(
        422,
        `Операций за период больше ${MAX_ROWS.toLocaleString('ru-RU')} — укоротите период и выгрузите по частям.`,
      );
    return new Response(operationsCsv(ops.rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-operations-${from}_${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
