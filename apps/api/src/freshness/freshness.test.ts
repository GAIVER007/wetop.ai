import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { FreshnessController, FreshnessService } from './freshness.module';

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
  it('последнее событие Channex из webhook или ленты, очередь ARI; строки Legacy нет (ADR-073)', async () => {
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
    expect((await service({}).snapshot(NOW)).channex!.lastEventAt).toBeNull();
  });
});

/**
 * План tenant-isolation-2026-09-26 п. 5: состояние Channex — только гостинице с подключёнными каналами и главному
 * администратору. Меню опрашивает строку раз в минуту на каждом экране, поэтому другим гостиницам — не 403 (журнал
 * ошибок человека получал бы запись каждую минуту), а «каналов нет».
 */
describe('FreshnessController — состояние каналов только своей гостинице', () => {
  const snapshot = {
    checkedAt: 'now',
    channex: { lastEventAt: null, outboxPending: 3, outboxFailed: 0, oldestPendingAt: null },
  };
  const controller = (integrationOrg: string | null) =>
    new FreshnessController(
      { snapshot: async () => snapshot } as never,
      {
        db: { property: { findFirst: async () => ({ organizationId: integrationOrg }) } },
      } as never,
    );
  const req = (user?: { organizationId: string; platformAdmin?: boolean }) => ({ user }) as never;

  it('своя гостиница и служебный ключ видят очередь', async () => {
    expect(await controller('org-luxx').freshness(req({ organizationId: 'org-luxx' }))).toEqual(
      snapshot,
    );
    expect(await controller('org-luxx').freshness(req(undefined))).toEqual(snapshot);
  });

  it('другая гостиница — каналов нет, без отказа', async () => {
    const r = await controller('org-luxx').freshness(req({ organizationId: 'org-b' }));
    expect(r.channex).toBeNull();
  });
});
