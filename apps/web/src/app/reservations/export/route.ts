import { ApiError } from '../../../lib/api-error';
import { reservationDirectory, type ReservationListRow } from '../../../lib/hotel-api';
import { reservationsCsv } from '../reservations-csv';

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

const PAGE = 200;
const MAX_ROWS = 5000;

/**
 * Выгрузка списка броней в CSV (H11, ADR-144): тот же отбор, что в адресе экрана «Брони» (период, статус, поиск,
 * источник, оплата и прочие условия), страницами по 200. Больше 5 000 броней не выгружается: просим укоротить период.
 * Браузер к API напрямую не ходит: стойка берёт ответ с сессией вошедшего, права проверяет API.
 */
export async function GET(request: Request) {
  const q = Object.fromEntries(new URL(request.url).searchParams);
  delete q['page'];
  delete q['pageSize'];
  try {
    const rows: ReservationListRow[] = [];
    for (let page = 1; ; page++) {
      const r = await reservationDirectory({ ...q, page: String(page), pageSize: String(PAGE) });
      if (r.total > MAX_ROWS)
        return text(
          422,
          `Броней по отбору ${r.total}, больше ${MAX_ROWS}: укоротите период и выгрузите по частям.`,
        );
      rows.push(...r.rows);
      if (r.rows.length < PAGE || rows.length >= r.total) break;
    }
    const from = q['from'] ?? '';
    const to = q['to'] ?? '';
    return new Response(reservationsCsv(rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-reservations-${from}_${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
