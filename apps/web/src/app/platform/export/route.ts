import { ApiError, platformApi } from '../../../lib/api';
import { isMonth } from '@pms/domain';
import { organizationsCsv } from '../organizations-csv';

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * «Экспорт» страницы «Организации»: организации и филиалы с цифрами за месяц в CSV. Только главный администратор:
 * браузер к API напрямую не ходит, права проверяет API (остальным 403).
 */
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get('month') ?? undefined;
  if (month !== undefined && !isMonth(month)) return text(400, 'Месяц: ожидается ГГГГ-ММ');
  try {
    const data = await platformApi.overview(month);
    return new Response(organizationsCsv(data), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-organizations-${data.period.month}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
