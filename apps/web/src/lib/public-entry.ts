/**
 * Экраны без сессии: вход, регистрация, ссылки из писем, приглашения и оценка гостя по QR-коду (§40).
 * Защищённая оболочка стойки их не оборачивает, иначе гость без входа уходит на `/login`.
 */
export function isPublicEntryPath(path: string): boolean {
  return [
    '/create',
    '/login',
    '/register',
    '/start',
    // кабинет партнёра WETOP живёт вне стойки (DATA_MODEL §63.3): вход проверяет сама страница
    '/partner',
    '/invite',
    '/rate',
    '/reviews',
    '/auth/fallback',
    '/status',
    '/specialists',
  ].some((entry) => path === entry || path.startsWith(`${entry}/`));
}
