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
