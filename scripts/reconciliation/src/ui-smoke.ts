/**
 * Обход экранов WETOP на живом API (план wetop-live-data, шаг 5): что по HTML страницы видно администратору.
 * Чистые функции — разбор страницы и итог; сеть и файлы — в cli-ui-smoke.ts.
 */

export type PageMarker = 'LOAD_FAILED' | 'NO_API' | 'API_ERROR' | 'SYNTHETIC' | 'NEXT_ERROR';

export interface PageCheck {
  route: string;
  status: number;
  ms: number;
  heading: string | null;
  markers: PageMarker[];
  apiErrors: string[];
}

const MARKERS: Array<[PageMarker, RegExp]> = [
  ['LOAD_FAILED', /Не удалось загрузить данные/],
  ['NO_API', /Нет связи с API/],
  ['SYNTHETIC', /Тестовый источник отключён/],
  ['NEXT_ERROR', /Internal Server Error|Application error|Unhandled Runtime Error|This page could not be found/],
];

/** Признаки сбоя в HTML страницы: экран ошибки, отказ API, синтетический источник, ошибка Next */
export function inspectPage(route: string, status: number, ms: number, html: string): PageCheck {
  const markers = MARKERS.filter(([, re]) => re.test(html)).map(([m]) => m);
  const apiErrors = [...new Set(html.match(/API \/[^:<"]{1,60}: HTTP [45]\d\d/g) ?? [])];
  if (apiErrors.length) markers.push('API_ERROR');
  const heading = /<h1[^>]*>([^<]{1,80})/.exec(html)?.[1]?.trim() ?? null;
  return { route, status, ms, heading, markers, apiErrors };
}

export const pageOk = (c: PageCheck) => c.status === 200 && c.markers.length === 0;

/** Отчёт для reports/: таблица экранов и строка RESULT, как у остальных сверок */
export function smokeReport(checks: PageCheck[], takenAt: Date, web: string): string {
  const failed = checks.filter((c) => !pageOk(c));
  const slowest = [...checks].sort((a, b) => b.ms - a.ms)[0];
  return [
    `# WETOP: экраны на живом API (${takenAt.toISOString().slice(0, 10)})`,
    '',
    `Снято ${takenAt.toISOString().slice(0, 16).replace('T', ' ')} UTC. Стойка ${web}, только чтение (GET).`,
    '',
    '| Показатель | Значение |',
    '|---|---:|',
    `| Экранов проверено | ${checks.length} |`,
    `| С ошибкой | ${failed.length} |`,
    `| Самый медленный | ${slowest ? `${slowest.route} — ${(slowest.ms / 1000).toFixed(1)} с` : '—'} |`,
    '',
    failed.length === 0
      ? '**RESULT: OK** — все экраны открываются с данными, без экранов ошибки.'
      : `**RESULT: FAIL** — экранов с ошибкой: ${failed.length}.`,
    '',
    '| Экран | HTTP | Время, с | Заголовок | Признаки |',
    '|---|---:|---:|---|---|',
    ...checks.map(
      (c) =>
        `| \`${c.route}\` | ${c.status} | ${(c.ms / 1000).toFixed(1)} | ${c.heading ?? '—'} | ${
          c.markers.length ? c.markers.join(', ') + (c.apiErrors.length ? `: ${c.apiErrors.join('; ')}` : '') : 'ок'
        } |`,
    ),
    '',
  ].join('\n');
}
