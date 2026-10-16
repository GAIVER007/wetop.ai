import { NextResponse } from 'next/server';
import { ApiError, metaConnectionApi } from '../../../../../lib/api';

/**
 * Адрес возврата из окна входа Facebook (DATA_MODEL §55, ADR-MKT-META): код и state уходят в API стойки, которое
 * проверяет state (тот же человек и филиал, не старше 10 минут), меняет код на ключ и подключает кабинет. Код в адресе
 * страницы не остаётся: ответ уводит на «Рекламу» с итогом словами.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL('/marketing/ads', url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    // человек отказался в окне Facebook или вернулся без кода
    back.searchParams.set('meta', 'cancelled');
    return NextResponse.redirect(back);
  }
  try {
    await metaConnectionApi.complete(code, state);
    back.searchParams.set('meta', 'connected');
  } catch (e) {
    back.searchParams.set('meta', 'failed');
    back.searchParams.set('reason', e instanceof ApiError ? e.message.slice(0, 300) : 'Не удалось подключить кабинет');
  }
  return NextResponse.redirect(back);
}
