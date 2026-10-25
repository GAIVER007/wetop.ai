import { NextResponse } from 'next/server';
import { msg } from '../../../../../i18n';
import { ApiError, metaConnectionApi } from '../../../../../lib/api';
import { META_ACCOUNTS_COOKIE, META_CHOICE_MAX_AGE_S, META_PENDING_COOKIE } from '../../meta-cookies';

/**
 * Адрес возврата из окна входа Facebook (DATA_MODEL §55, ADR-MKT-META): код и state уходят в API стойки, которое
 * проверяет state (тот же человек и филиал, не старше 10 минут), меняет код на ключ и читает кабинеты, отмеченные в окне.
 * Один кабинет подключается сразу; несколько: шифрованная заготовка и список уходят в закрытые cookie, «Реклама»
 * показывает выбор. Код в адресе страницы не остаётся: ответ уводит на «Рекламу» с итогом словами.
 *
 * Переход относительный: за прокси и в разработке сервер видит свой адрес (localhost), а браузер другой; абсолютный
 * адрес увёл бы браузер на чужой хост, и закрытые cookie выбора кабинета туда не дошли бы.
 */
function back(params: Record<string, string>): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/marketing/ads?${new URLSearchParams(params).toString()}` },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // человек отказался в окне Facebook или вернулся без кода
  if (!code || !state) return back({ meta: 'cancelled' });
  try {
    const r = await metaConnectionApi.complete(code, state);
    if (r.connected) return back({ meta: 'connected' });
    const res = back({ meta: 'choose' });
    const cookie = {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || url.protocol === 'https:',
      sameSite: 'lax' as const,
      path: '/marketing/ads',
      maxAge: META_CHOICE_MAX_AGE_S,
    };
    res.cookies.set(META_PENDING_COOKIE, r.pending, cookie);
    res.cookies.set(META_ACCOUNTS_COOKIE, JSON.stringify(r.accounts.slice(0, 50)), cookie);
    return res;
  } catch (e) {
    return back({
      meta: 'failed',
      reason: e instanceof ApiError ? e.message.slice(0, 300) : msg('Не удалось подключить кабинет'),
    });
  }
}
