import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { acquireRunLock, type RunLock } from '../tools/run-lock';

/**
 * 15.09.2026: в одном дереве одновременно шли два прогона e2e — свой в один воркер и чужой в два.
 * Playwright чистит test-results/ в начале прогона, поэтому второй снёс трассы живого первого
 * (`browserContext.close: ENOENT … .playwright-artifacts-N/traces/…`), а его воркеры заняли койку
 * в чужом окне дат. Три спека упали не по коду; поодиночке все зелёные.
 */
let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pms-run-lock-'));
});

describe('замок прогона: два набора на общей dev-БД не идут одновременно', () => {
  it('свободно — замок берётся и пишет, кто его держит', () => {
    const lock = acquireRunLock(dir, 'e2e');
    expect(lock.ok).toBe(true);
    expect(readFileSync(join(dir, 'e2e.lock'), 'utf8')).toContain(String(process.pid));
    (lock as RunLock & { ok: true }).release();
  });

  it('держит живой процесс — отказ с его pid и временем начала', () => {
    const first = acquireRunLock(dir, 'e2e');
    expect(first.ok).toBe(true);
    const second = acquireRunLock(dir, 'e2e');
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.holder.pid).toBe(process.pid);
      expect(second.holder.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('замок от умершего прогона перехватывается, а не блокирует навсегда', () => {
    // pid, которого заведомо нет: прежний прогон убит, файл остался
    writeFileSync(
      join(dir, 'e2e.lock'),
      JSON.stringify({ pid: 2147483646, startedAt: new Date().toISOString(), suite: 'e2e' }),
    );
    expect(acquireRunLock(dir, 'e2e').ok).toBe(true);
  });

  it('разные наборы друг другу не мешают', () => {
    expect(acquireRunLock(dir, 'e2e').ok).toBe(true);
    expect(acquireRunLock(dir, 'integration').ok).toBe(true);
  });

  it('после release замок свободен', () => {
    const first = acquireRunLock(dir, 'e2e');
    if (first.ok) first.release();
    expect(acquireRunLock(dir, 'e2e').ok).toBe(true);
  });
});
