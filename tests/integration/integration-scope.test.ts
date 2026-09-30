import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import { NestGuardProbes } from '../../apps/api/src/guard/guard.adapters';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SEC-1b, стадия B1.5 (Q-222, решение владельца 30.09.2026): запросы к очереди и журналу событий Channex ограничены объектом,
 * который выбирает сервер, а не только провайдером. Строка без объекта (`property_id IS NULL`, наследие до миграции
 * 20260927000026) под такой запрос НЕ попадает и не привязывается по догадке: что с ней делать, решает владелец по отчёту
 * `scripts/ops/integration-tables-scope-report.sql`. Пишутся только свои строки с меткой, они удаляются за собой.
 */
describe.skipIf(!url)(
  'данные интеграции: строки без объекта под запрос объекта не попадают (integration)',
  () => {
    let db: Db;
    let repo: PrismaChannelsRepository;
    let probes: NestGuardProbes;
    let propertyId = '';
    const mark = `scope-${Date.now().toString(36)}`;
    const provider = `channex-test-${mark}`;
    const ids = { ownOutbox: randomUUID(), nullOutbox: randomUUID() };

    beforeAll(async () => {
      db = createPrismaClient(url);
      repo = new PrismaChannelsRepository({ db } as unknown as PrismaService);
      propertyId = (
        await db.property.findFirstOrThrow({
          where: { name: LUXX_APARTS_PROPERTY.name },
          select: { id: true },
        })
      ).id;
      await db.channelOutbox.createMany({
        data: [
          { id: ids.ownOutbox, provider, kind: 'AVAILABILITY', payload: [], propertyId },
          { id: ids.nullOutbox, provider, kind: 'AVAILABILITY', payload: [], propertyId: null },
        ],
      });
      // сторож читает только провайдера Channex: свои события метятся в external_event_id
      await db.externalEvent.createMany({
        data: [
          {
            id: randomUUID(),
            provider,
            externalEventId: `${mark}-own`,
            type: 'booking_new',
            payloadHash: 'h',
            payload: {},
            status: 'FAILED',
            receivedVia: 'WEBHOOK',
            propertyId,
            receivedAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            id: randomUUID(),
            provider,
            externalEventId: `${mark}-null`,
            type: 'booking_new',
            payloadHash: 'h',
            payload: {},
            status: 'FAILED',
            receivedVia: 'WEBHOOK',
            propertyId: null,
            receivedAt: new Date('2026-06-01T00:00:00Z'),
          },
          {
            id: randomUUID(),
            provider: 'channex',
            externalEventId: `${mark}-g-own`,
            type: 'booking_new',
            payloadHash: 'h',
            payload: {},
            status: 'FAILED',
            receivedVia: 'WEBHOOK',
            propertyId,
          },
          {
            id: randomUUID(),
            provider: 'channex',
            externalEventId: `${mark}-g-null`,
            type: 'booking_new',
            payloadHash: 'h',
            payload: {},
            status: 'FAILED',
            receivedVia: 'WEBHOOK',
            propertyId: null,
          },
        ],
      });
      // сторож без остальных зависимостей: нужны только клиент базы и канальный репозиторий
      probes = Object.assign(Object.create(NestGuardProbes.prototype), {
        prisma: { db },
        channels: repo,
      }) as NestGuardProbes;
    });
    afterAll(async () => {
      await db.channelOutbox.deleteMany({ where: { provider } });
      await db.externalEvent.deleteMany({ where: { externalEventId: { startsWith: mark } } });
      await db?.$disconnect();
    });

    it('pendingOutbox и recentOutbox: видна только строка объекта, строка без объекта — нет', async () => {
      const pending = await repo.pendingOutbox(
        provider,
        'AVAILABILITY',
        new Date(Date.now() + 86_400_000),
      );
      expect(pending.map((r) => r.id)).toEqual([ids.ownOutbox]);
      const recent = await repo.recentOutbox(provider, 10);
      expect(recent.map((r) => r.id)).toEqual([ids.ownOutbox]);
    });

    it('lastEventAt: более новое событие без объекта не учитывается', async () => {
      const at = await repo.lastEventAt(provider, 'WEBHOOK');
      expect(at?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('markOutboxSent: отметка ставится только строке объекта; строка без объекта остаётся PENDING', async () => {
      await repo.markOutboxSent([ids.ownOutbox, ids.nullOutbox], 'task-1');
      const rows = await db.channelOutbox.findMany({
        where: { provider },
        select: { id: true, status: true },
      });
      expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({
        [ids.ownOutbox]: 'SENT',
        [ids.nullOutbox]: 'PENDING',
      });
    });

    it('сторож: упавшие события — только объекта, без строки без объекта', async () => {
      const failed = (await probes.failedEvents()).map((e) => e.externalEventId);
      expect(failed).toContain(`${mark}-g-own`);
      expect(failed).not.toContain(`${mark}-g-null`);
    });
  },
);
