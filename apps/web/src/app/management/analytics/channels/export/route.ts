import { dashboardApi } from '../../../../../lib/api';
import { ApiError } from '../../../../../lib/api-error';
import { hotelToday } from '../../../../../lib/hotel-api';
import { channelsCsv, parseChannelsQuery } from '../query';

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * «Эффективность каналов» в CSV (ADR-141): те же строки и итог, что на экране, с тем же отбором. Файл
 * открывается в Excel (разделитель «;», UTF-8 с BOM). Имён гостей в отчёте нет по построению.
 */
export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const q = parseChannelsQuery(sp, await hotelToday());
  if (q.error) return text(400, `${q.error}.`);
  try {
    const r = await dashboardApi.channels({
      from: q.from,
      to: q.to,
      channel: q.channel || undefined,
      sort: q.sort,
      empty: q.empty,
    });
    return new Response(channelsCsv(r.current), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-channels-${q.from}_${q.to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
