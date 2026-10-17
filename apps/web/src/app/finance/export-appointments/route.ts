import { beautyApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';
import { validDate } from '../../../lib/hotel-api';
import { appointmentsCsv } from '../appointments-csv';

/** Не длиннее месяца: день салона это отдельный запрос, длинный период выгружают частями */
const MAX_DAYS = 31;

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

const plusDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Выгрузка записей салона за период в CSV (Q-BS-6): дни филиала по одному, те же данные, что в журнале. Браузер к
 * API напрямую не ходит: стойка берёт ответ с сессией вошедшего и отдаёт файл.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  if (!validDate(from) || !validDate(to) || from > to)
    return text(400, 'Проверьте даты: окончание периода должно быть не раньше начала.');
  const dates: string[] = [];
  for (let d = from; d <= to; d = plusDay(d)) {
    dates.push(d);
    if (dates.length > MAX_DAYS) return text(422, `Период длиннее ${MAX_DAYS} дней: выгрузите по частям.`);
  }
  try {
    const days = await Promise.all(dates.map((d) => beautyApi.day(d)));
    return new Response(appointmentsCsv(days), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-appointments-${from}_${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
