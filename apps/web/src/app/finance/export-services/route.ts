import { financeApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';
import { validDate } from '../../../lib/hotel-api';
import { servicesCsv } from '../services-csv';

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * Выгрузка отчёта по услугам за период в CSV (REP2): те же строки, что на вкладке «Услуги».
 * Браузер к API напрямую не ходит — стойка берёт ответ с сессией вошедшего и отдаёт файл.
 * Обрезки нет: строк столько, сколько услуг в справочнике, плюс одна «вручную».
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  if (!validDate(from) || !validDate(to) || from > to)
    return text(400, 'Проверьте даты: окончание периода должно быть не раньше начала.');
  try {
    const report = await financeApi.servicesReport(from, to);
    return new Response(servicesCsv(report.rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-services-${from}_${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
