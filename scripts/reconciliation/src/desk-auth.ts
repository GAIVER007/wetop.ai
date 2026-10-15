/**
 * Вход в стойку для скриптов, которые ходят по экранам браузером (ADR-053: с 20.09.2026 вход только
 * по почте и паролю, `APP_AUTH_REQUIRED=1`). До этого обход открывал экраны без входа; теперь без
 * учётных данных он видит один экран входа и не проверяет ничего.
 *
 * Пароль скрипту не придумывается и не заводится: его вписывает владелец в `.env` рядом с прочими
 * ключами (`SECURITY.md` §3). Нет данных — обход честно говорит, что экраны не проверены, и не
 * выдаёт замок за поломку.
 */
export interface DeskCredentials {
  email: string;
  password: string;
}

/** `WALKTHROUGH_EMAIL` и `WALKTHROUGH_PASSWORD`; пусто или половина — считаем, что их нет. */
export function deskCredentials(env: Record<string, string | undefined>): DeskCredentials | null {
  const email = env['WALKTHROUGH_EMAIL']?.trim() ?? '';
  const password = env['WALKTHROUGH_PASSWORD'] ?? '';
  return email && password ? { email, password } : null;
}

/** Замок ли это: стойка уводит на `/login` любой экран, пока сессии нет. */
export function locked(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname === '/login' ||
      parsed.pathname === '/auth/fallback' ||
      (parsed.pathname === '/' && parsed.hash === '#login')
    );
  } catch {
    return false;
  }
}

/** Одна строка в отчёт вместо потока FAIL: замок — это не поломка экрана. */
export const LOCKED_DETAIL =
  'стойка просит войти (ADR-053). Экраны не проверены: задайте WALKTHROUGH_EMAIL и WALKTHROUGH_PASSWORD';

/** Что сказать, если вход был, но не удался: это уже неисправность, а не пропуск. */
export const SIGN_IN_FAILED = 'вход не прошёл: проверьте WALKTHROUGH_EMAIL и WALKTHROUGH_PASSWORD';
