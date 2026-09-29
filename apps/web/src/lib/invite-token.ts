/**
 * Ключ приглашения из адреса `/invite/<ключ>`. Битое %-кодирование (`%E0%A4%A`) бросает `URIError` — раньше страница
 * падала с 500 до вызова API. Теперь такой адрес даёт `null`, и страница показывает обычную «мёртвую» ссылку.
 */
export function decodeInviteToken(raw: string): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return null;
  }
}
