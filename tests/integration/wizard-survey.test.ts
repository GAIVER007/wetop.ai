import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { WizardService } from '../../apps/api/src/wizard/wizard.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/** Только loopback PostgreSQL, рабочую базу объекта не трогаем. Раньше условие было зашито на порт 55432,
 * и тест молча пропускался и на стенде CI (5432), и на любой другой локальной базе */
const local = isLocalDatabase(process.env.DATABASE_URL ?? '');
describe.skipIf(!local)('wizard: опрос и события воронки', () => {
  it('опрос заменяется при повторе, событие одно; браузерное событие не дублируется', async () => {
    process.env.WIZARD_ENABLED = '1';
    process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    const db = createPrismaClient();
    const wizard = new WizardService({ db } as PrismaService);
    let id: string | undefined;
    try {
      const first = await wizard.open(undefined, `test-${randomUUID()}`);
      id = first.guestSessionId;
      if (!('guestToken' in first)) throw new Error('Нет токена');
      const token = first.guestToken;

      await wizard.survey(token, { goal: 'Больше броней', leadsPerDay: '10-50' });
      await wizard.survey(token, { goal: 'Меньше рутины', source: 'Google' });
      const survey = await db.wizardSurvey.findUnique({ where: { guestSessionId: id } });
      expect(survey?.goal).toBe('Меньше рутины');
      expect(survey?.source).toBe('Google');
      expect(
        await db.wizardEvent.count({ where: { guestSessionId: id, eventType: 'survey_answered' } }),
      ).toBe(1);

      await wizard.event(token, { type: 'source_submitted' });
      await wizard.event(token, { type: 'source_submitted' });
      expect(
        await db.wizardEvent.count({ where: { guestSessionId: id, eventType: 'source_submitted' } }),
      ).toBe(1);
      await expect(wizard.event(token, { type: 'scan_completed' })).rejects.toThrow();
      await expect(wizard.survey(`wz_${'0'.repeat(64)}`, {})).rejects.toThrow();
    } finally {
      if (id) await db.wizardSession.delete({ where: { id } });
      await db.$disconnect();
      delete process.env.WIZARD_ENABLED;
      delete process.env.WIZARD_SESSION_TTL_SECONDS;
    }
  });
});
