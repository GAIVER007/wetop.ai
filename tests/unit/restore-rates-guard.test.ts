/**
 * `cli-restore-rates` (аудит 26.09, С-74): скрипт импортирует снимок цен Exely от 09.09 прямо в базу, снимает стоп-продажи
 * и ограничения, поставленные в WETOP, и выгружает всё в Channex. Раньше — с первого запуска, без вопросов и против
 * любого `APP_API_URL`. Теперь без явного подтверждения и не против локального API он не делает ни шага.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = 'scripts/reconciliation/src/cli-restore-rates.ts';

function run(args: string[], env: Record<string, string>) {
  const res = spawnSync('npx', ['tsx', CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    // порт 9 — никто не слушает: если скрипт всё же пойдёт в сеть, он упадёт, а не изменит данные
    env: { ...process.env, SERVICE_API_KEY: '', ...env },
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

describe('cli-restore-rates закрыт подтверждением', () => {
  it('без подтверждения — отказ до первого шага', () => {
    const r = run([], { APP_API_URL: 'http://127.0.0.1:9' });
    expect(r.code).not.toBe(0);
    expect(r.out).not.toContain('1/3');
    expect(r.out).toContain('--yes-restore-exely-snapshot');
  });

  it('с подтверждением, но против нелокального API — тоже отказ', () => {
    const r = run(['--yes-restore-exely-snapshot'], { APP_API_URL: 'https://api.wetop.ai' });
    expect(r.code).not.toBe(0);
    expect(r.out).not.toContain('1/3');
    expect(r.out).toMatch(/только локальн/);
  });
});
