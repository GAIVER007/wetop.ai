import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { FreshnessService } from './freshness.module';

function service(opts: {
  sync?: { createdAt: string; mode: string } | null;
  importSync?: string | null;
  webhookAt?: string | null;
  pullAt?: string | null;
  outbox?: { pending: number; failed: number; oldestPendingAt: string | null };
}) {
  const prisma = {
    db: {
      auditLog: {
        async findFirst({ where }: { where: { action: string } }) {
          if (where.action === 'exely.sync')
            return opts.sync
              ? { createdAt: new Date(opts.sync.createdAt), after: { mode: opts.sync.mode } }
              : null;
          return opts.importSync ? { createdAt: new Date(opts.importSync) } : null;
        },
      },
    },
  };
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
  return new FreshnessService(prisma as never, channels as never);
}
const NOW = new Date('2026-09-13T18:30:00Z');

describe('FreshnessService — свежесть данных для шапки стойки', () => {
  it('автосинхронизация Exely, последнее событие Channex из webhook или ленты, очередь ARI', async () => {
    const s = await service({
      sync: { createdAt: '2026-09-13T18:15:00Z', mode: 'auto' },
      importSync: '2026-09-13T08:59:58Z',
      webhookAt: '2026-09-13T16:41:38Z',
      pullAt: '2026-09-13T17:02:00Z',
      outbox: { pending: 2, failed: 0, oldestPendingAt: '2026-09-13T18:29:00Z' },
    }).snapshot(NOW);
    expect(s).toEqual({
      checkedAt: '2026-09-13T18:30:00.000Z',
      exely: { lastSyncAt: '2026-09-13T18:15:00.000Z', mode: 'auto' },
      channex: {
        lastEventAt: '2026-09-13T17:02:00.000Z',
        outboxPending: 2,
        outboxFailed: 0,
        oldestPendingAt: '2026-09-13T18:29:00Z',
      },
    });
  });

  it('до автосинхронизации время берётся из полной выгрузки после импорта; ничего не было — null', async () => {
    const legacy = await service({ importSync: '2026-09-13T08:59:58Z' }).snapshot(NOW);
    expect(legacy.exely).toEqual({ lastSyncAt: '2026-09-13T08:59:58.000Z', mode: 'manual' });
    const empty = await service({}).snapshot(NOW);
    expect(empty.exely).toEqual({ lastSyncAt: null, mode: null });
    expect(empty.channex.lastEventAt).toBeNull();
  });
});
