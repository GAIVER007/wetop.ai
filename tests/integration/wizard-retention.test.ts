import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { WizardRetentionService } from '../../apps/api/src/wizard/wizard-retention.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

/**
 * Проверка слияния 26.09: истёкшая гостевая сессия мастера раньше не удалялась никогда — публичная форма без
 * входа растила бы базу без предела. `purgeExpired` снимает только истёкшие; черновик и события уходят каскадом.
 * Run only on explicit loopback PostgreSQL, never the hotel's working database.
 */
const local = process.env.DATABASE_URL?.includes('@127.0.0.1:55432/');
describe.skipIf(!local)('уборка сессий мастера', () => {
  it('снимает истёкшую сессию вместе с черновиком и событием, живую не трогает', async () => {
    const db = createPrismaClient();
    const retention = new WizardRetentionService({ db } as PrismaService);
    const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');
    const expiredHash = hashOf(randomUUID());
    const liveHash = hashOf(randomUUID());
    // истёкшая — создаётся годной (expires_at > created_at — ограничение базы), потом сдвигается в прошлое
    const expired = await db.wizardSession.create({
      data: {
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() + 3_600_000),
        draft: { create: {} },
        events: { create: { eventType: 'wizard_started', deduplicationKey: `t:${expiredHash}` } },
      },
    });
    await db.wizardSession.update({
      where: { id: expired.id },
      data: { createdAt: new Date(0), expiresAt: new Date(1) },
    });
    const live = await db.wizardSession.create({
      data: {
        tokenHash: liveHash,
        expiresAt: new Date(Date.now() + 3_600_000),
        draft: { create: {} },
      },
    });
    try {
      const deleted = await retention.purgeExpired();
      expect(deleted).toBeGreaterThanOrEqual(1);
      expect(await db.wizardSession.findUnique({ where: { id: expired.id } })).toBeNull();
      expect(await db.wizardDraft.findUnique({ where: { guestSessionId: expired.id } })).toBeNull();
      expect(
        await db.wizardEvent.count({ where: { guestSessionId: expired.id } }),
      ).toBe(0);
      expect(await db.wizardSession.findUnique({ where: { id: live.id } })).not.toBeNull();
    } finally {
      await db.wizardSession.deleteMany({ where: { id: { in: [expired.id, live.id] } } });
      await db.$disconnect();
    }
  });
});
