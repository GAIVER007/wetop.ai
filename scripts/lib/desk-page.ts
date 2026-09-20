import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

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
/** `status: 0` и `unreachable` — до стойки не достучались вовсе (нет службы по этому адресу). */
export type DeskPage = { status: number; url: string; html: string; unreachable?: string };
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
  // Стойки по этому адресу нет вовсе (прогон изнутри контейнера API, другая машина, служба лежит).
  // Это пропуск, а не отказ: цикл проверяет путь брони, а не доступность стойки отсюда.
  if (page.status === 0) {
    return {
      verdict: 'locked',
      detail: `стойка недоступна отсюда: ${page.unreachable ?? page.url}`,
    };
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

/**
 * Записать отчёт, не роняя прогон из-за места записи (20.09.2026: внутри образа папка проекта
 * только для чтения, и `mkdir /app/reports` убил цикл уже ПОСЛЕ того, как всё было проверено,
 * а идентификаторы для сертификации — напечатаны). Отчёт — это след работы, а не сама работа:
 * если писать некуда, уходим во временную папку и говорим об этом вслух.
 */
export function writeReport(target: string, text: string): string {
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    return target;
  } catch (e) {
    const fallback = resolve(tmpdir(), target.split('/').pop() ?? 'report.md');
    writeFileSync(fallback, text);
    console.warn(
      `отчёт в ${target} записать не вышло (${(e as Error).message}); положил в ${fallback}`,
    );
    return fallback;
  }
}
