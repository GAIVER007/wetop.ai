import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

/**
 * Учения сторожа с полной выгрузкой ARI разрешены только на staging (SECURITY.md §9). Проверка читала
 * `CHANNEX_BASE_URL`, которую никто не задаёт, — адрес Channex живёт в `CHANNEX_API_BASE_URL`, и запрет
 * не срабатывал никогда (проверка по SECURITY.md, 24.09.2026). Отказ должен случиться до обращения к API.
 */
it('guard-drill outbox refuses a production Channex address before touching the API', () => {
  const env = { ...process.env };
  delete env.CHANNEX_BASE_URL;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', resolve('scripts/ops/guard-drill.ts'), 'outbox'],
    {
      encoding: 'utf8',
      timeout: 20_000,
      env: {
        ...env,
        CHANNEX_API_BASE_URL: 'https://app.channex.io/api/v1',
        // если проверка не сработает, учения пойдут сюда и упадут иначе, чем кодом 2
        API_URL: 'http://127.0.0.1:9',
      },
    },
  );
  expect(result.status, result.stdout + result.stderr).toBe(2);
  expect(result.stderr).toMatch(/не staging/);
}, 30_000);
