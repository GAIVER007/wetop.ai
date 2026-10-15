import { NextResponse, type NextRequest } from 'next/server';
import { securityHeaders } from './lib/security-headers';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './lib/session-cookie';

/**
 * Продление сессии при активности (DATA_MODEL §13.5) со стороны браузера. API двигает срок в базе
 * на каждом обращении вошедшего, но кука живёт ровно столько, сколько ей назначили при входе:
 * без этого человек, работающий каждый день, всё равно вылетал бы на тридцатые сутки посреди смены.
 * Пока кука есть, она выписывается заново тем же значением и с теми же признаками.
 *
 * Признак `Secure` берётся из адреса самого запроса, а не из `APP_URL`: переменные окружения сервера
 * посреднику не видны, а выписать куку без `Secure` поверх https — понизить защиту.
 *
 * Смену по паролю (ADR-049, 12 часов) это не продлевает: годность решает API, а не кука.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Путь запроса — в заголовке, чтобы серверный layout знал, где он, и решал про гейт онбординга
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-wetop-path', request.nextUrl.pathname);
  requestHeaders.set('x-wetop-return', request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Заголовки безопасности (аудит 29.09.2026, SEC-4): запрет фрейма, nosniff, referrer; полная CSP — report-only
  for (const [name, value] of Object.entries(
    securityHeaders({ assistantUrl: process.env.ASSISTANT_URL }),
  ))
    response.headers.set(name, value);
  if (token)
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  return response;
}

export const config = {
  // статика и картинки посредника не касаются: там куки не нужны, а работы он добавляет
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
