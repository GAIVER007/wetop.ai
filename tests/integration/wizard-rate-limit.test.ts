import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { isLocalDatabase } from '../tools/seed-local';
import { WizardService, WIZARD_LIMITS } from '../../apps/api/src/wizard/wizard.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

/**
 * Аудит слияния 26.09 (к функциям продавца из main): гостевой мастер публичен и не ограничен — скрипт мог открывать
 * сессии и писать в них без предела. Растёт база (строка сессии + черновик + событие на каждую), и раз включат
 * `WIZARD_ENABLED`, поток открытий с одного адреса и поток сохранений в одной сессии станут отказом в обслуживании.
 * Run only on explicit loopback PostgreSQL, never the hotel's working database.
 */
const local = isLocalDatabase(process.env.DATABASE_URL ?? '');
describe.skipIf(!local)('гостевой мастер: пределы по адресу и по сессии', () => {
  it(`после ${WIZARD_LIMITS.opensPerIpPerHour} открытий сессии с одного адреса — отказ, другой адрес открывает как прежде`, async () => {
    process.env.WIZARD_ENABLED = '1';
    process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    const db = createPrismaClient();
    const wizard = new WizardService({ db } as PrismaService);
    const ids: string[] = [];
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    try {
      for (let i = 0; i < WIZARD_LIMITS.opensPerIpPerHour; i += 1) {
        const opened = await wizard.open(undefined, 'test', ip);
        if ('guestSessionId' in opened) ids.push(opened.guestSessionId);
      }
      await expect(wizard.open(undefined, 'test', ip)).rejects.toThrow(/слишком много/);
      // сосед по адресу не пострадал
      const other = await wizard.open(undefined, 'test', '203.0.113.250');
      if ('guestSessionId' in other) ids.push(other.guestSessionId);
    } finally {
      if (ids.length) await db.wizardSession.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
      delete process.env.WIZARD_ENABLED;
      delete process.env.WIZARD_SESSION_TTL_SECONDS;
    }
  }, 30_000);

  it(`после ${WIZARD_LIMITS.savesPerSessionPerHour} сохранений в одной сессии — отказ`, async () => {
    process.env.WIZARD_ENABLED = '1';
    process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    const db = createPrismaClient();
    const wizard = new WizardService({ db } as PrismaService);
    let id: string | undefined;
    try {
      const opened = await wizard.open(undefined, `test-${randomUUID()}`);
      if (!('guestToken' in opened)) throw new Error('Missing new token');
      id = opened.guestSessionId;
      const token = opened.guestToken;
      for (let i = 0; i < WIZARD_LIMITS.savesPerSessionPerHour; i += 1) {
        await wizard.save(token, { revision: i, step: 'review', config: { niche: `n${i}` } });
      }
      await expect(
        wizard.save(token, {
          revision: WIZARD_LIMITS.savesPerSessionPerHour,
          step: 'review',
          config: { niche: 'over' },
        }),
      ).rejects.toThrow(/слишком много/);
    } finally {
      if (id) await db.wizardSession.delete({ where: { id } });
      await db.$disconnect();
      delete process.env.WIZARD_ENABLED;
      delete process.env.WIZARD_SESSION_TTL_SECONDS;
    }
  }, 30_000);
});
