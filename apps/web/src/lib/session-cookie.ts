/**
 * Кука сессии стойки без обращения к `next/headers`: эти же значения нужны посреднику (middleware),
 * который работает не в серверном запросе Node и `next/headers` там нет.
 */
export const SESSION_COOKIE = 'wetop_session';
/** Срок сессии по коду на почту — 30 суток, как в API (`SESSION_TTL_MS`). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `Secure` только по https: по http кука с этим признаком не доедет (Safari на 127.0.0.1 её
 * отбросит, и вход зациклится). Правило одно на стойку и API (`cookie.ts` в API).
 */
export function cookieSecure(env: Record<string, string | undefined>): boolean {
  return env.APP_URL?.trim().startsWith('https://') ?? false;
}
