/**
 * Адрес, на котором API слушает (plans/server-kz-2026-09-18.md, шаг 2).
 *
 * По умолчанию `127.0.0.1` — так было с первого дня и так остаётся на машине владельца: снаружи
 * API недоступен, наружу смотрит только туннель. В контейнере это умолчание означает «никто не
 * достучится, даже стойка из соседнего контейнера», поэтому compose задаёт `API_HOST=0.0.0.0`
 * при сети, закрытой наружу (порты не публикуются).
 *
 * Значение из окружения не «доверяется»: пустая строка и пробелы — это не адрес, а недосмотр.
 */
export const DEFAULT_API_HOST = '127.0.0.1';

export function listenHost(env: NodeJS.ProcessEnv = process.env): string {
  const value = env['API_HOST']?.trim();
  return value ? value : DEFAULT_API_HOST;
}

export function listenPort(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env['API_PORT']);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : 3001;
}
