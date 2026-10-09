import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { isLocalDatabase } from '../tools/seed-local';
import { WizardService } from '../../apps/api/src/wizard/wizard.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

/** Run only on explicit loopback PostgreSQL, never the hotel's working database. */
const local = isLocalDatabase(process.env.DATABASE_URL ?? '');
describe.skipIf(!local)('wizard persisted session boundary', () => {
  it('restores a draft, isolates tokens, rejects stale writes and expired sessions', async () => {
    process.env.WIZARD_ENABLED = '1';
    process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    const db = createPrismaClient();
    const wizard = new WizardService({ db } as PrismaService);
    let id: string | undefined;
    try {
      const first = await wizard.open(undefined, `test-${randomUUID()}`);
      id = first.guestSessionId;
      expect('guestToken' in first).toBe(true);
      if (!('guestToken' in first)) throw new Error('Missing new token');
      const token = first.guestToken;
      expect(token).toMatch(/^wz_[a-f0-9]{64}$/);
      await wizard.save(token, {
        revision: 0,
        step: 'review',
        config: { businessName: 'Тестовый объект', niche: 'Хостел', assistantName: 'Помощник' },
      });
      const reopened = await wizard.open(token, 'ignored');
      expect(reopened.guestSessionId).toBe(id);
      expect(reopened.draft.businessName).toBe('Тестовый объект');
      expect(reopened.draft.revision).toBe(1);
      expect('guestToken' in reopened).toBe(false);
      await expect(
        wizard.save(token, { revision: 0, step: 'review', config: { businessName: 'stale' } }),
      ).rejects.toThrow('Черновик изменился');
      await expect(wizard.status(`wz_${'0'.repeat(64)}`)).rejects.toThrow();
      const attempts = await Promise.allSettled([
        wizard.save(token, { revision: 1, step: 'review', config: { goal: 'Один' } }),
        wizard.save(token, { revision: 1, step: 'review', config: { goal: 'Два' } }),
      ]);
      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      expect(
        await db.wizardEvent.count({ where: { guestSessionId: id, eventType: 'wizard_started' } }),
      ).toBe(1);
      await db.wizardSession.update({
        where: { id },
        data: { createdAt: new Date(0), expiresAt: new Date(1) },
      });
      await expect(wizard.status(token)).rejects.toThrow('Сессия мастера истекла');
    } finally {
      if (id) await db.wizardSession.delete({ where: { id } });
      await db.$disconnect();
      delete process.env.WIZARD_ENABLED;
      delete process.env.WIZARD_SESSION_TTL_SECONDS;
    }
  });
});
