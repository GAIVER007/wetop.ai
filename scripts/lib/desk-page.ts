import { resolve } from 'node:path';

/**
 * Экраны стойки для скриптов сверки (живой круг Channex, обход экранов).
 *
 * С 19.09.2026 стойка стоит за собственным замком (ADR-053): без сессии любой адрес уводит на `/login`
 * и отвечает 200 страницей входа. Простой fetch этого не различает и раньше показывал красное там,
 * где стойка просто не пустила. Здесь три правила:
 *  - сессию скрипту можно дать через `WEB_SESSION_COOKIE` (значение заголовка Cookie) — тогда проверка
 *    настоящая;
 *  - без сессии переброс на `/login` — это «пропущено (замок)», отдельный исход, не FAIL и не ок;
 *  - отчёт пишется в `REPORTS_DIR`, если задан (в образе папка проекта только для чтения), иначе в
 *    `reports/` проекта.
 */
export type DeskPage = { status: number; url: string; html: string };
export type DeskVerdict = { verdict: 'ok' | 'fail' | 'locked'; detail: string };

export function judgeDeskPage(page: DeskPage, expected: (html: string) => boolean): DeskVerdict {
  // Без начального значения: eslint (no-useless-assignment) справедливо считает присваивание,
  // которое сразу же перезаписывается в обеих ветках, лишним — а вместе с ним теряется и подсказка,
  // что путь обязан быть заполнен.
  let path: string;
  try {
    path = new URL(page.url).pathname;
  } catch {
    path = page.url;
  }
  if (path === '/login' || path.startsWith('/login/')) {
    return { verdict: 'locked', detail: 'стойка за замком: нет сессии, проверка пропущена' };
  }
  const ok = page.status === 200 && expected(page.html);
  return { verdict: ok ? 'ok' : 'fail', detail: `HTTP ${page.status}` };
}

export function deskHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const cookie = env['WEB_SESSION_COOKIE']?.trim();
  return cookie ? { cookie } : {};
}

export function reportTarget(root: string, env: NodeJS.ProcessEnv, file: string): string {
  const dir = env['REPORTS_DIR']?.trim();
  return dir ? resolve(dir, file) : resolve(root, 'reports', file);
}
