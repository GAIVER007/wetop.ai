/**
 * Стенд стойки перед прогоном e2e: устаревшая сборка останавливает прогон, чужие 500 — только называются.
 * 16.09.2026: четыре красных спека оказались одной неисправностью стенда — `next start` держал в памяти
 * манифест сборки, которую пересобрали под ним (`tests/runs/logs/2026-09-16T08-11-35Z-e2e-bdb4.log`).
 */
import { describe, expect, it } from 'vitest';
import { assertDeskReady, serverErrors, staleBuild } from '../tools/desk-health';

/** Страница, как её отдал сломанный стенд в том прогоне */
const STALE_BODY = `Error: Cannot find module '/Users/urijzapojnov/Documents/ChatGPT/WETOP/apps/web/.next/server/chunks/ssr/_1-p2ima._.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1234:15)`;

describe('стенд стойки перед e2e', () => {
  it('пропавший чанк сборки виден по любой странице, не только по первой', () => {
    const found = staleBuild([
      { path: '/inventory', status: 200, body: '<h1>Фонд</h1>' },
      { path: '/today', status: 500, body: STALE_BODY },
    ]);
    expect(found?.path).toBe('/today');
    expect(found?.chunk).toContain('.next/server/chunks/ssr/_1-p2ima._.js');
  });

  it('здоровый стенд признаком не считается', () => {
    expect(
      staleBuild([
        { path: '/today', status: 200, body: '<h1>Главная</h1>' },
        { path: '/chessboard', status: 200, body: '<h1>Календарь</h1>' },
      ]),
    ).toBeUndefined();
  });

  it('прогон останавливается с указанием страницы, чанка и как починить', () => {
    expect(() =>
      assertDeskReady([{ path: '/today', status: 500, body: STALE_BODY }], 3100),
    ).toThrowError(/устаревшей сборке[\s\S]*\/today[\s\S]*_1-p2ima[\s\S]*build -w apps\/web/);
  });

  it('здоровый стенд прогон не останавливает', () => {
    expect(() => assertDeskReady([{ path: '/today', status: 200, body: 'ok' }], 3100)).not.toThrow();
  });

  it('пятисотка не от сборки прогон не останавливает, но называется', () => {
    const probes = [{ path: '/finance', status: 500, body: 'Internal Server Error' }];
    expect(() => assertDeskReady(probes, 3100)).not.toThrow();
    expect(serverErrors(probes).map((p) => p.path)).toEqual(['/finance']);
  });
});
