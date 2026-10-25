import { Buffer } from 'node:buffer';
import { ApiError, beautyApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { filterBeautyCustomers, type BeautyCustomerSegmentFilter } from '../customer-filter';
import { exportBeautyCustomersXlsx } from '../xlsx';
import { serverT } from '../../../i18n/server';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SEGMENTS = new Set<BeautyCustomerSegmentFilter>(['all', 'new', 'regular', 'vip', 'archived']);

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/** Адрес выгрузки, открытый обычной ссылкой (аудит 21.10.2026 п.6): файл отдаёт только POST кнопки, ссылка ведёт к списку */
// Относительный адрес: за прокси `request.url` бывает внутренним хостом
export function GET() {
  return new Response(null, { status: 303, headers: { location: '/customers' } });
}

export async function POST(request: Request) {
  const t = await serverT();
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) return text(413, t('Слишком большой запрос'));
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return text(400, t('Неверные параметры выгрузки'));
  }
  if (!raw || typeof raw !== 'object') return text(400, t('Неверные параметры выгрузки'));
  const body = raw as Record<string, unknown>;
  const scopeKey = typeof body.scopeKey === 'string' ? body.scopeKey : '';
  const query = typeof body.query === 'string' ? body.query : '';
  const segment = typeof body.segment === 'string' && SEGMENTS.has(body.segment as BeautyCustomerSegmentFilter)
    ? body.segment as BeautyCustomerSegmentFilter
    : null;
  if (!scopeKey || query.length > 120 || !segment) return text(400, t('Неверные параметры выгрузки'));

  const shell = await deskShell();
  if (!shell.scopeKey || shell.scopeKey !== scopeKey) {
    return text(409, t('Филиал изменился. Обновите страницу и повторите выгрузку.'));
  }
  try {
    const { items } = await beautyApi.customers();
    const selected = filterBeautyCustomers(items, { query, segment });
    const bytes = exportBeautyCustomersXlsx(selected, t);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(Buffer.from(bytes), {
      headers: {
        'content-type': MIME,
        'content-disposition': `attachment; filename="wetop-customers-${date}.xlsx"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return text(error.status >= 500 ? 502 : error.status, error.message);
    throw error;
  }
}
