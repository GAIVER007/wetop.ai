import { describe, expect, it } from 'vitest';
import { inspectPage, pageOk, smokeReport } from './ui-smoke';

describe('ui-smoke: что видно администратору на экране', () => {
  it('страница с данными — ок, заголовок из h1', () => {
    const c = inspectPage('/today', 200, 1200, '<main><h1 class="t">Обзор дня</h1><p>Проживают 52</p></main>');
    expect(c).toMatchObject({ heading: 'Обзор дня', markers: [], apiErrors: [] });
    expect(pageOk(c)).toBe(true);
  });

  it('экран ошибки, отказ API и HTTP-ошибка API — не ок, даже при HTTP 200 от стойки', () => {
    const html =
      '<h1>Не удалось загрузить данные</h1><p>Нет связи с API. Проверьте подключение.</p>' +
      '<pre>API /hotel/settings: HTTP 404</pre><pre>API /hotel/settings: HTTP 404</pre>';
    const c = inspectPage('/hotel-settings', 200, 900, html);
    expect(c.markers).toEqual(['LOAD_FAILED', 'NO_API', 'API_ERROR']);
    expect(c.apiErrors).toEqual(['API /hotel/settings: HTTP 404']);
    expect(pageOk(c)).toBe(false);
  });

  it('отчёт: RESULT OK только когда все экраны ок; самый медленный назван', () => {
    const ok = inspectPage('/today', 200, 1500, '<h1>Обзор дня</h1>');
    const slow = inspectPage('/inventory', 200, 3200, '<h1>Номерной фонд</h1>');
    const at = new Date('2026-09-13T18:40:00Z');
    expect(smokeReport([ok, slow], at, 'http://127.0.0.1:3000')).toContain('**RESULT: OK**');
    const md = smokeReport([ok, inspectPage('/x', 500, 10, '')], at, 'http://127.0.0.1:3000');
    expect(md).toContain('**RESULT: FAIL** — экранов с ошибкой: 1.');
    expect(smokeReport([ok, slow], at, 'w')).toContain('/inventory — 3.2 с');
  });
});
