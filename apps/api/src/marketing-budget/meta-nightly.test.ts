import { describe, expect, it, vi } from 'vitest';
import { MarketingMetaNightly } from './meta-connection';

describe('ночная сверка кабинетов: раз в сутки UTC', () => {
  it('одна сверка на день UTC, новый день снова', async () => {
    const syncAll = vi.fn(async () => ({ connections: 0, failed: 0 }));
    const nightly = new MarketingMetaNightly({ syncAll } as never);
    await nightly.tick(new Date('2026-10-16T00:10:00Z'));
    await nightly.tick(new Date('2026-10-16T23:50:00Z'));
    expect(syncAll).toHaveBeenCalledTimes(1);
    await nightly.tick(new Date('2026-10-17T00:01:00Z'));
    expect(syncAll).toHaveBeenCalledTimes(2);
  });
});
