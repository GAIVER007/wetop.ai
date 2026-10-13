import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { WizardService } from '../../apps/api/src/wizard/wizard.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

describe.skipIf(!isLocalDatabase(process.env.DATABASE_URL ?? ''))(
  'isolated generation queue',
  () => {
    let db: ReturnType<typeof createPrismaClient>;
    let service: WizardService;
    const ids: string[] = [];
    beforeAll(() => {
      db = createPrismaClient();
      service = new WizardService({ db } as PrismaService);
      process.env.WIZARD_ENABLED = '1';
      process.env.WIZARD_GENERATE_ENABLED = '1';
      process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    });
    afterAll(async () => {
      await db.wizardSession.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    });
    async function draft() {
      const opened = await service.open(undefined, 'generation-test');
      if (!('guestToken' in opened)) throw new Error('token');
      ids.push(opened.guestSessionId);
      await service.save(opened.guestToken, {
        revision: 0,
        step: 'generating',
        config: {
          businessName: 'Синтетический салон',
          niche: 'Салон красоты',
          description: 'Стрижки',
          botType: 'support',
        },
      });
      return opened.guestToken;
    }
    it('deduplicates parallel requests and caps generation at five revisions per session', async () => {
      const token = await draft();
      const same = await Promise.all(
        Array.from({ length: 4 }, () => service.generate(token, { revision: 1 }, 'a'.repeat(64))),
      );
      expect(new Set(same.map((r) => r.id)).size).toBe(1);
      for (let revision = 2; revision <= 6; revision++) {
        await service.save(token, {
          revision: revision - 1,
          step: 'generating',
          config: { goal: `Задача ${revision}` },
        });
        if (revision === 6)
          await expect(service.generate(token, { revision }, 'a'.repeat(64))).rejects.toThrow(
            'пять',
          );
        else await service.generate(token, { revision }, 'a'.repeat(64));
      }
      await expect(
        service.generate('wz_' + '0'.repeat(64), { revision: 1 }, 'a'.repeat(64)),
      ).rejects.toThrow();
      await db.wizardJob.deleteMany({ where: { draft: { guestSessionId: { in: ids } } } });
    });
    it('persists both outputs without changing the input revision; never returns stale output', async () => {
      const { WizardGenerateWorker } =
        await import('../../apps/api/src/wizard/wizard-generate-worker');
      const token = await draft();
      await service.generate(token, { revision: 1 }, 'a'.repeat(64));
      let calls = 0;
      const send = async (body: unknown) => {
        calls++;
        expect(body).toMatchObject({ config: { botType: 'support', niche: 'Салон красоты' } });
        return {
          status: 'ok',
          prompt: 'Проверенная инструкция поддержки',
          knowledge: [{ title: 'Услуги', content: 'Стрижки' }],
        };
      };
      await Promise.all([
        new WizardGenerateWorker({ db } as PrismaService).tick(send),
        new WizardGenerateWorker({ db } as PrismaService).tick(send),
      ]);
      expect(calls).toBe(1);
      const ready = await service.status(token);
      expect(ready.generation?.state).toBe('succeeded');
      expect(ready.draft.revision).toBe(1);
      expect(ready.draft.hasGenerated).toBe(true);
      expect(ready.generated?.knowledge).toEqual([{ title: 'Услуги', content: 'Стрижки' }]);
      await service.save(token, {
        revision: 1,
        step: 'review',
        config: { description: 'Новые данные' },
      });
      const stale = await service.status(token);
      expect(stale.generated).toBeNull();
      expect(stale.generation?.state).toBe('stale');
    });
    it('discards delayed generation after an edit; recovers a lease using the same request id', async () => {
      const { WizardGenerateWorker } =
        await import('../../apps/api/src/wizard/wizard-generate-worker');
      const token = await draft();
      const job = await service.generate(token, { revision: 1 }, 'a'.repeat(64));
      await db.wizardJob.update({
        where: { id: job.id },
        data: { state: 'running', attempt: 1, updatedAt: new Date(Date.now() - 180000) },
      });
      await new WizardGenerateWorker({ db } as PrismaService).tick(async (body) => {
        expect(body).toMatchObject({ requestId: job.id });
        await service.save(token, {
          revision: 1,
          step: 'review',
          config: { description: 'Правка во время сборки' },
        });
        return {
          status: 'ok',
          prompt: 'Поздняя инструкция поддержки',
          knowledge: [{ title: 'Услуги', content: 'Стрижки' }],
        };
      });
      expect((await service.status(token)).generated).toBeNull();
      expect((await service.status(token)).generation?.state).toBe('stale');
    });
  },
);
