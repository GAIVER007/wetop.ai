import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { FreshnessService } from './freshness.module';

function service(opts: {
  webhookAt?: string | null;
  pullAt?: string | null;
  outbox?: { pending: number; failed: number; oldestPendingAt: string | null };
}) {
  const channels = {
    async lastEventAt(_p: string, via: string) {
      const at = via === 'WEBHOOK' ? opts.webhookAt : opts.pullAt;
      return at ? new Date(at) : null;
    },
    async outboxSummary() {
      return {
        pending: 0,
        failed: 0,
        sent: 10,
        lastSentAt: null,
        lastTaskId: null,
        oldestPendingAt: null,
        ...opts.outbox,
      };
    },
  };
  return new FreshnessService(channels as never);
}
const NOW = new Date('2026-09-13T18:30:00Z');

describe('FreshnessService — свежесть данных для шапки стойки', () => {
  it('последнее событие Channex из webhook или ленты, очередь ARI; строки Exely нет (ADR-073)', async () => {
    const s = await service({
      webhookAt: '2026-09-13T16:41:38Z',
      pullAt: '2026-09-13T17:02:00Z',
      outbox: { pending: 2, failed: 0, oldestPendingAt: '2026-09-13T18:29:00Z' },
    }).snapshot(NOW);
    expect(s).toEqual({
      checkedAt: '2026-09-13T18:30:00.000Z',
      channex: {
        lastEventAt: '2026-09-13T17:02:00.000Z',
        outboxPending: 2,
        outboxFailed: 0,
        oldestPendingAt: '2026-09-13T18:29:00Z',
      },
    });
  });

  it('событий ещё не было — null', async () => {
    expect((await service({}).snapshot(NOW)).channex.lastEventAt).toBeNull();
  });
});
