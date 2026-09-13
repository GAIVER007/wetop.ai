import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { channelsApi } from './api';

/**
 * Кнопка «Полная выгрузка (500 дней)» на /channels. 13.09.2026 глубина API стала 500 дней (сертификация Channex §1),
 * подпись кнопки поменяли, а клиент стойки продолжал явно слать `?days=365` — кнопка обещала 500, выгружала 365.
 * Сквозного теста на эту кнопку нет, поэтому сторож здесь: глубину решает API, стойка её не задаёт.
 */
afterEach(() => vi.unstubAllGlobals());

describe('полная выгрузка со стойки', () => {
  it('без явной глубины запрос идёт без ?days — API берёт свои 500 дней', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ from: '2026-09-13', to: '2028-01-25', tasks: [] }), { status: 200 });
    });
    await channelsApi.sync();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/channels\/channex\/sync$/);
  });

  it('кнопка стойки не передаёт свою глубину', () => {
    const src = readFileSync(resolve(import.meta.dirname, '../app/channels/actions.ts'), 'utf8');
    expect(src).toMatch(/channelsApi\.sync\(\)/);
    expect(src).not.toMatch(/channelsApi\.sync\(\s*\d/);
  });
});
