import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { WizardService } from '../../apps/api/src/wizard/wizard.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

describe.skipIf(!isLocalDatabase(process.env.DATABASE_URL ?? ''))(
  'guest chat quota and delivery',
  () => {
    let db: ReturnType<typeof createPrismaClient>;
    let service: WizardService;
    const ids: string[] = [];
    beforeAll(() => {
      db = createPrismaClient();
      service = new WizardService({ db } as PrismaService);
      process.env.WIZARD_ENABLED = '1';
      process.env.WIZARD_CHAT_ENABLED = '1';
      process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    });
    afterAll(async () => {
      await db.wizardSession.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    });
    async function draft(used = 0) {
      const open = await service.open(undefined, 'synthetic-chat');
      if (!('guestToken' in open)) throw new Error('token');
      ids.push(open.guestSessionId);
      await db.wizardDraft.update({
        where: { guestSessionId: open.guestSessionId },
        data: {
          config: { botType: 'support' },
          generatedRevision: 0,
          generatedPrompt: 'Помоги выбрать услугу',
          generatedKnowledge: [{ title: 'Услуги', content: 'Стрижки' }],
          testMessagesUsed: used,
        },
      });
      return open;
    }
    const input = (requestId: string) => ({ requestId, text: 'Какие услуги?', revision: 0 });
    it('last slot has one winner; replay costs nothing and changed text conflicts', async () => {
      const d = await draft(4);
      const results = await Promise.allSettled(
        ['one', 'two'].map((id) => service.message(d.guestToken, input(id), 'a'.repeat(64))),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const refused = results.find((r) => r.status === 'rejected');
      if (refused?.status === 'rejected') expect(refused.reason.getStatus()).toBe(402);
      const win = results.find((r) => r.status === 'fulfilled');
      if (win?.status !== 'fulfilled') throw new Error('winner');
      await service.message(d.guestToken, input(win.value.requestId), 'a'.repeat(64));
      expect((await service.quota(d.guestToken)).usedCount).toBe(5);
      await expect(
        service.message(
          d.guestToken,
          { ...input(win.value.requestId), text: 'Другое' },
          'a'.repeat(64),
        ),
      ).rejects.toThrow('изменён');
      await db.wizardSession.delete({ where: { id: d.guestSessionId } });
    });
    it('workers deduplicate, persist history and release a technical failure exactly once', async () => {
      const { WizardChatWorker } = await import('../../apps/api/src/wizard/wizard-chat-worker');
      const d = await draft();
      const send = async () => ({ status: 'ok', answer: 'Доступны стрижки.', sources: ['Услуги'] });
      await service.message(d.guestToken, input('one'), 'a'.repeat(64));
      let calls = 0;
      await Promise.all(
        [1, 2].map(() =>
          new WizardChatWorker({ db } as PrismaService).tick(async () => {
            calls++;
            return send();
          }),
        ),
      );
      expect(calls).toBe(1);
      const history = (await service.status(d.guestToken)).chat;
      expect(history?.messages).toHaveLength(2);
      expect(history?.messages[1]).toMatchObject({
        text: 'Доступны стрижки.',
        sources: ['Услуги'],
      });
      await service.message(d.guestToken, input('two'), 'a'.repeat(64));
      await new WizardChatWorker({ db } as PrismaService).tick(async () => ({ status: 'error' }));
      expect((await service.quota(d.guestToken)).usedCount).toBe(1);
      await service.message(d.guestToken, input('two'), 'a'.repeat(64));
      await new WizardChatWorker({ db } as PrismaService).tick(async () => {
        throw new Error('must not retry terminal');
      });
      expect((await service.quota(d.guestToken)).usedCount).toBe(1);
    });
    it('orders concurrent queued turns as question-answer pairs in history and model context', async () => {
      const { WizardChatWorker } = await import('../../apps/api/src/wizard/wizard-chat-worker');
      const d = await draft();
      await service.message(d.guestToken, input('first'), 'a'.repeat(64));
      await service.message(d.guestToken, input('second'), 'a'.repeat(64));
      const worker = new WizardChatWorker({ db } as PrismaService);
      await worker.tick(async () => ({ status: 'ok', answer: 'Первый ответ', sources: [] }));
      await worker.tick(async (body) => {
        expect(body.history.map((m) => m.role)).toEqual(['user', 'assistant']);
        return { status: 'ok', answer: 'Второй ответ', sources: [] };
      });
      expect((await service.status(d.guestToken)).chat.messages.map((m) => m.role)).toEqual([
        'user',
        'assistant',
        'user',
        'assistant',
      ]);
    });
    it('reserves only five concurrent requests and refuses a forged system role', async () => {
      const d = await draft();
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          service.message(d.guestToken, input(`parallel${i}`), 'a'.repeat(64)),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
      expect((await service.quota(d.guestToken)).usedCount).toBe(5);
      await expect(
        service.message(d.guestToken, { ...input('forged'), role: 'system' }, 'a'.repeat(64)),
      ).rejects.toThrow('Проверьте');
      await db.wizardSession.delete({ where: { id: d.guestSessionId } });
    });
    it('recovers an abandoned lease with the original immutable paid context', async () => {
      const { WizardChatWorker } = await import('../../apps/api/src/wizard/wizard-chat-worker');
      const d = await draft();
      await service.message(d.guestToken, input('recover'), 'a'.repeat(64));
      const event = await db.wizardEvent.findUniqueOrThrow({
        where: { deduplicationKey: `chat:${d.guestSessionId}:recover` },
      });
      const original = {
        requestId: 'recover',
        sessionId: d.guestSessionId,
        ipHash: 'a'.repeat(64),
        prompt: 'Неизменяемая инструкция',
        knowledge: [{ title: 'Услуги', content: 'Стрижки' }],
        botType: 'support',
        history: [],
        text: 'Какие услуги?',
      };
      await db.wizardEvent.update({
        where: { id: event.id },
        data: {
          payload: {
            ...(event.payload as Record<string, string>),
            state: 'running',
            attempt: 1,
            leaseUntil: Date.now() - 1,
            context: original,
          },
        },
      });
      let calls = 0;
      await new WizardChatWorker({ db } as PrismaService).tick(async (body) => {
        calls++;
        expect(body).toEqual(original);
        return { status: 'ok', answer: 'Стрижки.', sources: ['Услуги'] };
      });
      expect(calls).toBe(1);
      expect((await service.quota(d.guestToken)).usedCount).toBe(1);
      expect((await service.status(d.guestToken)).chat.messages).toHaveLength(2);
    });
    it('rejects stale generation and discards a late response after editing', async () => {
      const { WizardChatWorker } = await import('../../apps/api/src/wizard/wizard-chat-worker');
      const d = await draft();
      await service.message(d.guestToken, input('late'), 'a'.repeat(64));
      await new WizardChatWorker({ db } as PrismaService).tick(async () => {
        await service.save(d.guestToken, {
          revision: 0,
          step: 'review',
          config: { description: 'Правка' },
        });
        return { status: 'ok', answer: 'Поздний ответ', sources: [] };
      });
      expect((await service.quota(d.guestToken)).usedCount).toBe(0);
      expect((await service.status(d.guestToken)).chat?.messages).toEqual([]);
      await expect(
        service.message(d.guestToken, { ...input('new'), revision: 1 }, 'a'.repeat(64)),
      ).rejects.toThrow('Сначала');
    });
  },
);
