/**
 * Адрес, на котором слушает API.
 *
 * На Mac — только 127.0.0.1: наружу API выпускает туннель, и так с первого среза (plans/slice-1-inventory.md §7).
 * В Docker у каждой службы своя сеть, и 127.0.0.1 контейнера не виден ни стойке, ни туннелю — compose
 * ставит `API_HOST=0.0.0.0`. Порты при этом наружу не публикуются (`expose`, не `ports`): 0.0.0.0 внутри
 * контейнера означает «соседям по сети compose», а не «в интернет». Найдено 18.09.2026.
 */
const DEFAULT_HOST = '127.0.0.1';

export function listenHost(env: Record<string, string | undefined> = process.env): string {
  const raw = env['API_HOST']?.trim();
  return raw ? raw : DEFAULT_HOST;
}
