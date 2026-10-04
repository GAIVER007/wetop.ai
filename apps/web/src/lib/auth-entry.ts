import type { MembershipRole } from '@pms/domain';

/**
 * Посадочная страница без явного `next` (ADR-146): владельцу Главная, управляющему и администратору
 * Календарь, так смена сразу видит заезды и размещение. Роль не пришла или незнакома, считаем
 * администратором (то же правило, что у подписи в `desk-person.ts`).
 */
export function defaultLandingFor(role: MembershipRole | string | null | undefined): string {
  return role === 'OWNER' ? '/today' : '/chessboard';
}

/**
 * Адрес после входа: явный `next` уважается как просили (`safeReturnPath`), пустой, `null` или
 * отсутствующий решает роль вошедшего (ADR-146). Недопустимый, но непустой `next` остаётся на
 * умолчании `safeReturnPath` (Главная), а не на роли: отличить «просили плохой адрес» от «не просили
 * ничего» незачем.
 */
export function landingPath(
  requested: unknown,
  role: MembershipRole | string | null | undefined,
): string {
  if (typeof requested !== 'string' || !requested) return defaultLandingFor(role);
  return safeReturnPath(requested);
}

/** Return addresses never leave this application or re-enter an authentication endpoint. */
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\s]|%5c|%2f/i.test(value) ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  )
    return '/today';
  try {
    const url = new URL(value, 'https://app.invalid');
    if (
      url.origin !== 'https://app.invalid' ||
      /^\/(?:login|register|invite|auth|api)(?:\/|$)/i.test(decodeURIComponent(url.pathname)) ||
      url.pathname === '/'
    )
      return '/today';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/today';
  }
}

export function publicAuthUrl(
  mode: 'login' | 'register' = 'login',
  next: unknown = '/today',
  env: Record<string, string | undefined> = process.env,
): string {
  const url = new URL(env.WETOP_SITE_URL || 'https://wetop.ai');
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
  ) {
    throw new Error('WETOP_SITE_URL: требуется HTTPS origin или локальный адрес главной');
  }
  url.searchParams.set('next', safeReturnPath(next));
  url.hash = mode;
  return url.toString();
}
