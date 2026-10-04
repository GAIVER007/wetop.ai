import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { databaseTenant, withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import { InboundBookingsService } from '../../apps/api/src/channels/inbound.service';
import { PrismaUnitOfWork } from '../../apps/api/src/reservations/reservations.repository';
import { PrismaIncidentsRepository } from '../../apps/api/src/guard/incidents.repository';
import { PrismaDiagnosticsRepository } from '../../apps/api/src/assistant/diagnostics.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { enableLocalAppLogin } from '../tools/local-app-login';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const appUrl = url?.replace(/\/\/[^@/]*(@)/, '//wetop_app$1');

/**
 * SEC-1b, стадия B (Q-222): при запросе человека организации данные интеграции (`external_events`, `system_incidents`,
 * `channel_outbox`) читает и правит служебная роль, а роль `wetop_app` трогает из них только `INSERT` в очередь. Права базы
 * не отзываются (это мешало бы параллельным тестам); вместо этого перехватывается отправка SQL драйвером `pg` и отмечается,
 * какой ролью соединения она ушла. Это и есть условие, при котором будущий отзыв прав ничего не сломает.
 *
 * Вход роли `wetop_app` на локальной базе включается самим тестом (`tests/tools/local-app-login.ts`); на нелокальной базе не запускать.
 */
const TABLES = /(external_events|system_incidents|channel_outbox)/;
const APP_INSERT = /^\s*INSERT\s+INTO\s+"?(?:[a-z_]+"?\.")?"?channel_outbox/i;

describe.skipIf(!url)(
  'данные интеграции: под запросом организации — служебной ролью (integration)',
  () => {
    let admin: Db;
    let app: Db;
    let organizationId = '';
    const seen: Array<{ user: string; sql: string }> = [];
    const violations: string[] = [];
    let restore: (() => void) | undefined;

    beforeAll(async () => {
      // Роль без входа (миграция) на свежей локальной базе: как у `rls-isolation`, вход включается здесь; чужую базу не трогаем
      await enableLocalAppLogin(url!);
      admin = createPrismaClient(url);
      organizationId = (await admin.property.findFirstOrThrow({ select: { organizationId: true } }))
        .organizationId;
      app = createPrismaClient(url, undefined, { of: databaseTenant, appConnectionString: appUrl });
      const original = pg.Client.prototype.query as (...a: unknown[]) => unknown;
      const spy = vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (
        this: pg.Client,
        ...args: unknown[]
      ) {
        const first = args[0] as string | { text?: string } | undefined;
        const sql = typeof first === 'string' ? first : (first?.text ?? '');
        const user = (this as unknown as { user?: string }).user ?? '';
        if (TABLES.test(sql)) {
          seen.push({ user, sql: sql.slice(0, 80) });
          if (user === 'wetop_app' && !APP_INSERT.test(sql)) violations.push(sql.slice(0, 120));
        }
        return original.apply(this, args);
      } as never);
      restore = () => spy.mockRestore();
    });
    afterAll(async () => {
      restore?.();
      await app?.$disconnect();
      await admin?.$disconnect();
    });

    const asOrg = <T>(fn: () => Promise<T>) =>
      withSignedInUser({ userId: null, organizationId }, fn);
    const service = () => ({ db: app }) as unknown as PrismaService;

    it('контроль: прямое чтение очереди под организацией ловится (значит, перехват работает)', async () => {
      violations.length = 0;
      // После миграции B2 база отвечает отказом (42501) — запрос уходит от wetop_app и перехватывается до ответа; до неё — читает
      await asOrg(() => app.channelOutbox.findFirst({ where: { provider: 'контроль' } })).catch(
        (e: unknown) => expect(String(e)).toMatch(/permission denied|42501|denied access/i),
      );
      expect(violations.length).toBeGreaterThan(0);
      violations.length = 0;
    });

    it('канальный репозиторий: журнал, очередь, сводка, события — служебной ролью', async () => {
      violations.length = 0;
      const repo = new PrismaChannelsRepository(service());
      await asOrg(async () => {
        expect(databaseTenant()).toBe(organizationId);
        await repo.outboxSummary('channex');
        await repo.recentOutbox('channex', 5);
        await repo.outboxRows('channex', { limit: 5 });
        await repo.lastEventAt('channex', 'WEBHOOK');
        await repo.eventsPage('channex', { limit: 5, offset: 0 } as never);
        await repo.eventByRevision('channex', 'нет-такой');
        await repo.pendingOutbox('channex', 'AVAILABILITY', new Date());
        await repo.markOutboxSent([], null);
        await repo.markOutboxRetry([], 'x', new Date(), false);
      });
      expect(violations).toEqual([]);
    });

    it('сторож: инциденты (в том числе сырой INSERT) — служебной ролью', async () => {
      violations.length = 0;
      const repo = new PrismaIncidentsRepository(service());
      await asOrg(async () => {
        await repo.open();
        await repo.list({ status: 'all', limit: 5 });
        await repo.get(randomUUID());
        await repo.acknowledge(randomUUID(), new Date());
        await repo.purgeResolvedBefore(new Date(0));
      });
      expect(violations).toEqual([]);
    });

    it('диагностика помощника: события и очередь объекта организации — служебной ролью', async () => {
      violations.length = 0;
      const repo = new PrismaDiagnosticsRepository(service());
      await asOrg(() => repo.integrationFacts(organizationId));
      expect(violations).toEqual([]);
    });

    it('постановка в очередь остаётся на wetop_app и в транзакции команды: INSERT разрешён, откат убирает запись', async () => {
      seen.length = 0;
      violations.length = 0;
      const provider = `channex-test-role-${Date.now().toString(36)}`;
      let id = '';
      await expect(
        asOrg(() =>
          app.$transaction(async (tx) => {
            id = await new PrismaChannelsRepository({
              db: tx,
            } as unknown as PrismaService).enqueueOutbox(provider, 'AVAILABILITY', [{ a: 1 }]);
            throw new Error('откат команды');
          }),
        ),
      ).rejects.toThrow('откат команды');
      const inserts = seen.filter((s) => /INSERT/i.test(s.sql));
      expect(inserts.length).toBeGreaterThan(0);
      expect(inserts.every((s) => s.user === 'wetop_app')).toBe(true);
      expect(violations).toEqual([]);
      expect(id).toBeTruthy();
      expect(await admin.channelOutbox.count({ where: { id } })).toBe(0);
    });

    it('Q-225 (а*): разбор ленты и повтор ревизии из запроса организации — служебной ролью, wetop_app к трём таблицам не обращается', async () => {
      violations.length = 0;
      seen.length = 0;
      const property = await admin.property.findFirstOrThrow({ select: { id: true } });
      const revisionId = `role-q225-${Date.now().toString(36)}`;
      const providerPropertyId = `chx-role-test-${revisionId}`;
      const mapping = await admin.channelMapping.create({
        data: { propertyId: property.id, provider: 'channex', providerPropertyId },
        select: { id: true },
      });
      const rev = {
        type: 'booking_revision',
        id: revisionId,
        attributes: {
          id: revisionId,
          property_id: providerPropertyId,
          booking_id: 'bk-role-test',
          unique_id: `BDC-${revisionId}`,
          ota_reservation_code: 'role-test',
          ota_name: 'Booking.com',
          status: 'new',
          // комнаты без сопоставления: разбор упадёт после записи события, этого достаточно — и запись, и итог идут через external_events
          rooms: [
            {
              checkin_date: '2027-11-10',
              checkout_date: '2027-11-12',
              rate_plan_id: 'rp-none',
              room_type_id: 'rt-none',
              occupancy: { adults: 1, children: 0, infants: 0 },
              guests: [{ name: 'Guest', surname: 'Role' }],
              amount: '1000.00',
              days: { '2027-11-10': '500.00', '2027-11-11': '500.00' },
            },
          ],
          customer: { name: 'Guest', surname: 'Role', mail: 'guest@example.invalid', country: 'KZ' },
          occupancy: { adults: 1, children: 0, infants: 0 },
          arrival_date: '2027-11-10',
          departure_date: '2027-11-12',
          amount: '1000.00',
          currency: 'KZT',
          inserted_at: '2026-09-30T10:00:00.000000',
        },
      };
      const gateway = { bookingRevisionsFeed: async () => [rev], ackBookingRevision: async () => undefined };
      const publisher = {
        reservationChanged: async () => undefined,
        ratesChanged: async () => 0,
        deltaLost: async () => undefined,
      };
      const inbound = new InboundBookingsService(
        gateway as never,
        new PrismaUnitOfWork(service()),
        publisher as never,
        service(),
      );
      const before = process.env['INTEGRATION_PROPERTY_ID'];
      process.env['INTEGRATION_PROPERTY_ID'] = property.id;
      let events: Array<{ user: string; sql: string }>;
      try {
        await asOrg(async () => {
          expect(databaseTenant()).toBe(organizationId);
          await inbound.pull(undefined, 'MANUAL');
          await inbound.retryEvent(revisionId);
        });
        // срез до очистки: она идёт ролью владельца базы и в перехват тоже попадает
        events = seen.filter((s) => /external_events/.test(s.sql));
      } finally {
        if (before === undefined) delete process.env['INTEGRATION_PROPERTY_ID'];
        else process.env['INTEGRATION_PROPERTY_ID'] = before;
        await admin.externalEvent.deleteMany({ where: { externalEventId: revisionId } });
        await admin.channelMapping.delete({ where: { id: mapping.id } });
      }
      expect(events.length).toBeGreaterThan(0);
      // локально служебный пул подключается ролью владельца базы, на сервере — wetop_service; важно одно: не wetop_app
      expect(events.every((s) => s.user !== 'wetop_app')).toBe(true);
      expect(violations).toEqual([]);
    });
  },
);
