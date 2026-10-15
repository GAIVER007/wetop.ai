import { WizardScanWorker } from '../../apps/api/src/wizard/wizard-scan-worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { WizardService } from '../../apps/api/src/wizard/wizard.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

import { isLocalDatabase } from '../tools/seed-local';
describe.skipIf(!isLocalDatabase(process.env.DATABASE_URL ?? ''))('isolated scan queue', () => {
  let db: ReturnType<typeof createPrismaClient>;
  let service: WizardService;
  const ids: string[] = [];
  beforeAll(() => {
    db = createPrismaClient();
    service = new WizardService({ db } as PrismaService);
    process.env.WIZARD_ENABLED = '1';
    process.env.WIZARD_SCAN_ENABLED = '1';
    process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
  });
  afterAll(async () => {
    await db.wizardSession.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it('enqueues one scan for concurrent requests at the same revision', async () => {
    const opened = await service.open(undefined, 'scan-test');
    if (!('guestToken' in opened)) throw new Error('token');
    ids.push(opened.guestSessionId);
    await service.save(opened.guestToken, {
      revision: 0,
      step: 'source',
      config: { siteUrl: 'https://example.test' },
    });
    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () => service.scan(opened.guestToken, { revision: 1 })),
    );
    expect(new Set(outcomes.map((r) => r.id)).size).toBe(1);
    expect(
      await db.wizardJob.count({ where: { draft: { guestSessionId: opened.guestSessionId } } }),
    ).toBe(1);
    await expect(service.scan('wz_' + '0'.repeat(64), { revision: 1 })).rejects.toThrow();
    await expect(service.scan(opened.guestToken, { revision: 0 })).rejects.toThrow(
      'Черновик изменился',
    );
  });

  const worker = () => new WizardScanWorker({ db } as PrismaService);
  const fields = {
    businessName: 'Синтетический ресторан',
    niche: 'Ресторан',
    description: 'Обеды',
    faq: [{ question: 'Что есть?', answer: 'Обеды' }],
  };
  async function queued() {
    const opened = await service.open(undefined, 'scan-test');
    if (!('guestToken' in opened)) throw new Error('token');
    ids.push(opened.guestSessionId);
    await service.save(opened.guestToken, {
      revision: 0,
      step: 'review',
      config: { siteUrl: 'https://example.test' },
    });
    const job = await service.scan(opened.guestToken, { revision: 1 });
    return { token: opened.guestToken, job };
  }
  it('persists fields and FAQ after worker restart; concurrent workers claim only once', async () => {
    await db.wizardJob.deleteMany({ where: { draft: { guestSessionId: { in: ids } } } });
    const { token, job } = await queued();
    let calls = 0;
    const send = async () => {
      calls++;
      return { status: 'ok', fields };
    };
    await Promise.all([worker().tick(send), worker().tick(send)]);
    expect(calls).toBe(1);
    const state = await service.scanStatus(token);
    expect(state.scan?.state).toBe('succeeded');
    expect(state.draft.niche).toBe('Ресторан');
    expect(state.draft.revision).toBe(2);
    expect(state.draft.wizardData).toMatchObject({ foundFields: 'businessName,niche,description' });
    const stored = await db.wizardJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { draft: true },
    });
    expect(stored.draft.sources).toEqual([
      { kind: 'site', url: 'https://example.test', faq: fields.faq },
    ]);
  });
  it('does not overwrite a manual edit while a scan is running', async () => {
    const { token } = await queued();
    await worker().tick(async () => {
      await service.save(token, {
        revision: 1,
        step: 'review',
        config: { businessName: 'Моя правка' },
      });
      expect((await service.scanStatus(token)).scan?.state).toBe('stale');
      return { status: 'ok', fields };
    });
    const state = await service.scanStatus(token);
    expect(state.draft.businessName).toBe('Моя правка');
    expect(state.scan?.state).toBe('stale');
  });
  it('stops queued paid work while scan rollout is off', async () => {
    const { token } = await queued();
    process.env.WIZARD_SCAN_ENABLED = '0';
    let calls = 0;
    try {
      await worker().tick(async () => {
        calls++;
        return { status: 'ok', fields };
      });
    } finally {
      process.env.WIZARD_SCAN_ENABLED = '1';
    }
    expect(calls).toBe(0);
    expect((await service.scanStatus(token)).scan?.state).toBe('queued');
    await worker().tick(async () => ({ status: 'ok', fields }));
  });
  it('recovers abandoned lease with the same paid request id', async () => {
    const { token, job } = await queued();
    await db.wizardJob.update({
      where: { id: job.id },
      data: { state: 'running', attempt: 1, updatedAt: new Date(Date.now() - 180000) },
    });
    await worker().tick(async (body) => {
      expect(body).toMatchObject({ requestId: job.id });
      return { status: 'error', errorCode: 'RESULT_UNKNOWN' };
    });
    expect((await service.scanStatus(token)).scan?.state).toBe('failed');
    expect((await service.scanStatus(token)).draft.businessName).toBe('');
  });
  it('reads job and draft from one snapshot when the worker commits during status polling', async () => {
    const { token, job } = await queued();
    let fired = false;
    const hooked = db.$extends({
      query: {
        wizardSession: {
          async findUnique({ args, query }) {
            const value = await query(args);
            if (!fired) {
              fired = true;
              const stored = await db.wizardJob.findUniqueOrThrow({ where: { id: job.id } });
              await db.$transaction([
                db.wizardJob.update({ where: { id: job.id }, data: { state: 'succeeded' } }),
                db.wizardDraft.update({
                  where: { id: stored.draftId },
                  data: { revision: { increment: 1 }, businessName: fields.businessName },
                }),
              ]);
            }
            return value;
          },
        },
      },
    });
    const state = await new WizardService({ db: hooked } as unknown as PrismaService).scanStatus(
      token,
    );
    expect(fired).toBe(true);
    expect(state.scan?.state).toBe('queued');
    expect(state.draft.revision).toBe(1);
    expect((await service.scanStatus(token)).scan?.state).toBe('succeeded');
  });
});
