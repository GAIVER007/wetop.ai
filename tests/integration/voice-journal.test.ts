import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import {
  PrismaMarketingVoiceRepository,
  type ReadScope,
} from '../../apps/api/src/marketing-voice/marketing-voice.repository';
import { parseVoiceEvent } from '../../apps/api/src/marketing-voice/voice-events';
import { PrismaVoiceIngestRepository } from '../../apps/api/src/marketing-voice/voice-ingest.repository';
import { VoiceIngestService } from '../../apps/api/src/marketing-voice/voice-ingest.service';
import { isLocalDatabase } from '../tools/seed-local';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

/**
 * Голосовой агент, срез 2, на настоящей базе (DATA_MODEL VOICE-OWNER-APPROVAL-20261022, миграция 142): приём событий
 * идемпотентен и не ломается от гонки, состояние идёт вперёд, чтение и закрытие просьб видят только свой филиал.
 * Организации, агенты и телефоны вымышленные (ADR-010); после себя всё убирается.
 */
describe.skipIf(!url)(
  'голосовой агент: журнал звонков (integration, DATABASE_URL required)',
  () => {
    let sql: pg.Client;
    let db: Db;
    let ingest: VoiceIngestService;
    let reads: PrismaMarketingVoiceRepository;
    const [orgA, orgB] = [randomUUID(), randomUUID()];
    const [bizA, bizB] = [randomUUID(), randomUUID()];
    const [locA, locB] = [randomUUID(), randomUUID()];
    const [agentA, agentB, agentNoLoc] = [randomUUID(), randomUUID(), randomUUID()];
    const user = randomUUID();
    const mark = Date.now().toString(36);
    const scopeA: ReadScope = { organizationId: orgA, locationId: locA, timezone: 'Asia/Almaty' };
    const scopeB: ReadScope = { organizationId: orgB, locationId: locB, timezone: 'Asia/Almaty' };
    const start = new Date(Date.now() - 3_600_000);
    const end = new Date(Date.now() + 3_600_000);
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const event = (over: Record<string, unknown>) => ({
      agentId: agentA,
      externalCallId: `room-${mark}-1`,
      state: 'RECEIVED',
      occurredAt: at(10),
      ...over,
    });
    const count = async (table: string, where = 'true') =>
      Number((await sql.query(`SELECT count(*) FROM ${table} WHERE ${where}`)).rows[0].count);

    beforeAll(async () => {
      if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
      sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
      await sql.connect();
      db = createPrismaClient(url);
      const prisma = { db } as PrismaService;
      ingest = new VoiceIngestService(new PrismaVoiceIngestRepository(prisma));
      reads = new PrismaMarketingVoiceRepository(prisma);
      await sql.query(
        `INSERT INTO organizations (id, name) VALUES ($1, 'Голос A (synthetic)'), ($2, 'Голос B (synthetic)')`,
        [orgA, orgB],
      );
      await sql.query(
        `INSERT INTO businesses (id, organization_id, name, vertical, updated_at)
       VALUES ($1, $2, 'Салон A', 'BEAUTY', now()), ($3, $4, 'Салон B', 'BEAUTY', now())`,
        [bizA, orgA, bizB, orgB],
      );
      for (const [id, business] of [
        [locA, bizA],
        [locB, bizB],
      ] as const)
        await sql.query(
          `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Филиал', 'Asia/Almaty', 'KZT', now())`,
          [id, business],
        );
      await sql.query(
        `INSERT INTO users (id, email, status, created_at) VALUES ($1, $2, 'ACTIVE', now())`,
        [user, `voice-${mark}@example.invalid`],
      );
      for (const [id, org, loc] of [
        [agentA, orgA, locA],
        [agentB, orgB, locB],
        [agentNoLoc, orgA, null],
      ] as const)
        await sql.query(
          `INSERT INTO seller_agents (id, created_by, organization_id, name, location_id, updated_at) VALUES ($1, $2, $3, 'Голос', $4, now())`,
          [id, user, org, loc],
        );
    });

    afterAll(async () => {
      if (!sql) return;
      const orgs = [orgA, orgB];
      await sql.query(`DELETE FROM voice_callbacks WHERE organization_id = ANY($1::uuid[])`, [
        orgs,
      ]);
      await sql.query(`DELETE FROM voice_calls WHERE organization_id = ANY($1::uuid[])`, [orgs]);
      await sql.query(`DELETE FROM seller_agents WHERE organization_id = ANY($1::uuid[])`, [orgs]);
      await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA, locB]]);
      await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[bizA, bizB]]);
      await sql.query(`DELETE FROM users WHERE id = $1`, [user]);
      await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [orgs]);
      await sql.end();
      await db.$disconnect();
    });

    it('первое событие создаёт звонок; повтор не плодит строк и не меняет ответ по существу', async () => {
      const e = event({ callerMasked: '***2233', dialedNumber: '+77009990000' });
      const first = await ingest.ingest(e);
      expect(first).toMatchObject({ ok: true, state: 'RECEIVED', duplicate: false });
      const again = await ingest.ingest(e);
      expect(again).toMatchObject({ callId: first.callId, duplicate: true });
      expect(
        await count(
          'voice_calls',
          `agent_id = '${agentA}' AND external_call_id = 'room-${mark}-1'`,
        ),
      ).toBe(1);
    });

    it('RECEIVED, ANSWERED, ENDED: длительность считает сервер; запоздалое событие не откатывает состояние', async () => {
      const id = `room-${mark}-flow`;
      await ingest.ingest(event({ externalCallId: id, state: 'RECEIVED', occurredAt: at(20) }));
      await ingest.ingest(event({ externalCallId: id, state: 'ANSWERED', occurredAt: at(19) }));
      await ingest.ingest(
        event({ externalCallId: id, state: 'ENDED', occurredAt: at(17), endReason: 'hangup' }),
      );
      const late = await ingest.ingest(
        event({ externalCallId: id, state: 'ANSWERED', occurredAt: at(19) }),
      );
      expect(late).toMatchObject({ state: 'ENDED', duplicate: true });
      const row = (
        await sql.query(
          `SELECT state, duration_seconds, end_reason FROM voice_calls WHERE external_call_id = $1`,
          [id],
        )
      ).rows[0];
      expect(row.state).toBe('ENDED');
      expect(row.end_reason).toBe('hangup');
      expect(row.duration_seconds).toBeGreaterThanOrEqual(119);
      expect(row.duration_seconds).toBeLessThanOrEqual(121);
    });

    it('одновременные события одного звонка: одна строка, ошибок нет, просьба одна', async () => {
      const id = `room-${mark}-race`;
      const cb = { phone: '8 700 111 22 33', name: 'Айдана', note: 'окрашивание' };
      const events = [
        event({ externalCallId: id, state: 'RECEIVED', occurredAt: at(8) }),
        event({ externalCallId: id, state: 'ANSWERED', occurredAt: at(7), callback: cb }),
        event({ externalCallId: id, state: 'ANSWERED', occurredAt: at(7), callback: cb }),
        event({ externalCallId: id, state: 'ENDED', occurredAt: at(6) }),
        event({ externalCallId: id, state: 'RECEIVED', occurredAt: at(8) }),
      ];
      const results = await Promise.allSettled(events.map((e) => ingest.ingest(e)));
      expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
      expect(await count('voice_calls', `external_call_id = '${id}'`)).toBe(1);
      expect(
        await count(
          'voice_callbacks',
          `phone = '+77001112233' AND voice_call_id IN (SELECT id FROM voice_calls WHERE external_call_id = '${id}')`,
        ),
      ).toBe(1);
      expect(
        (await sql.query(`SELECT state FROM voice_calls WHERE external_call_id = $1`, [id])).rows[0]
          .state,
      ).toBe('ENDED');
    });

    it('агент: неизвестный 404, без филиала 422; организацию и бизнес берёт сервер', async () => {
      await expect(ingest.ingest(event({ agentId: randomUUID() }))).rejects.toMatchObject({
        status: 404,
      });
      await expect(ingest.ingest(event({ agentId: agentNoLoc }))).rejects.toMatchObject({
        status: 422,
      });
      await ingest.ingest(event({ agentId: agentB, externalCallId: `room-${mark}-b` }));
      const row = (
        await sql.query(
          `SELECT organization_id, business_id, location_id FROM voice_calls WHERE external_call_id = $1`,
          [`room-${mark}-b`],
        )
      ).rows[0];
      expect(row).toEqual({ organization_id: orgB, business_id: bizB, location_id: locB });
    });

    it('чтение: филиал видит только свои звонки и просьбы; чужой не видит ничего', async () => {
      const a = await reads.calls(scopeA, start, end, 50, 0);
      const b = await reads.calls(scopeB, start, end, 50, 0);
      expect(a.total).toBeGreaterThanOrEqual(3);
      expect(b.rows.map((r) => r.id)).not.toEqual(expect.arrayContaining(a.rows.map((r) => r.id)));
      expect(b.total).toBe(1);
      const summary = await reads.summary(scopeA, start, end);
      expect(summary.total).toBe(a.total);
      expect(summary.byState.ENDED).toBeGreaterThanOrEqual(2);
      expect(summary.withCallback).toBeGreaterThanOrEqual(1);
      expect(summary.durationCount).toBeGreaterThanOrEqual(1);
      const cbA = await reads.callbacks(scopeA, 'NEW', 100);
      expect(cbA.length).toBeGreaterThanOrEqual(1);
      expect(cbA[0]).toMatchObject({ phone: '+77001112233', name: 'Айдана', status: 'NEW' });
      expect(await reads.callbacks(scopeB, null, 100)).toEqual([]);
    });

    it('закрытие просьбы: чужой филиал получает null; свой закрывает; повтор возвращает то же', async () => {
      const [cb] = await reads.callbacks(scopeA, 'NEW', 100);
      expect(await reads.closeCallback(scopeB, cb!.id, user)).toBeNull();
      const done = await reads.closeCallback(scopeA, cb!.id, user);
      expect(done).toMatchObject({ id: cb!.id, status: 'DONE' });
      expect(done!.doneAt).toBeInstanceOf(Date);
      const again = await reads.closeCallback(scopeA, cb!.id, user);
      expect(again!.doneAt!.getTime()).toBe(done!.doneAt!.getTime());
      expect(
        (await sql.query(`SELECT done_by_id FROM voice_callbacks WHERE id = $1`, [cb!.id])).rows[0]
          .done_by_id,
      ).toBe(user);
    });

    it('два человека закрывают одну просьбу одновременно: отметка первого не переписывается', async () => {
    const id = `room-${mark}-close`;
    await ingest.ingest(event({ externalCallId: id, state: 'ANSWERED', callback: { phone: '+77005550000', name: 'Б', note: '' } }));
    const [cb] = (await reads.callbacks(scopeA, 'NEW', 100)).filter((c) => c.phone === '+77005550000');
    const other = randomUUID();
    await sql.query(`INSERT INTO users (id, email, status, created_at) VALUES ($1, $2, 'ACTIVE', now())`, [other, `voice2-${mark}@example.invalid`]);
    try {
      const [one, two] = await Promise.all([reads.closeCallback(scopeA, cb!.id, user), reads.closeCallback(scopeA, cb!.id, other)]);
      expect(one!.doneAt!.getTime()).toBe(two!.doneAt!.getTime());
      const row = (await sql.query(`SELECT done_by_id FROM voice_callbacks WHERE id = $1`, [cb!.id])).rows[0];
      expect([user, other]).toContain(row.done_by_id);
      expect(await reads.closeCallback(scopeA, cb!.id, other === row.done_by_id ? user : other)).toMatchObject({ status: 'DONE' });
      expect((await sql.query(`SELECT done_by_id FROM voice_callbacks WHERE id = $1`, [cb!.id])).rows[0].done_by_id).toBe(row.done_by_id);
    } finally {
      await sql.query(`UPDATE voice_callbacks SET done_by_id = NULL WHERE id = $1`, [cb!.id]);
      await sql.query(`DELETE FROM users WHERE id = $1`, [other]);
    }
  });

  it('профиль: отдаётся только активному агенту; черновик, пауза и архив получают 404', async () => {
    const profileRepo = new PrismaVoiceIngestRepository({ db } as PrismaService);
    await sql.query(`UPDATE seller_agents SET lifecycle = 'draft' WHERE id = $1`, [agentA]);
    expect(await profileRepo.profile(agentA)).toBeNull();
    await sql.query(`UPDATE seller_agents SET lifecycle = 'active' WHERE id = $1`, [agentA]);
    await sql.query(
      `INSERT INTO voice_profiles (agent_id, organization_id, business_id, greeting_tail, voice_name, handoff_phone)
       VALUES ($1, $2, $3, 'Работаем до 20 часов.', 'Puck', '+77009990000')`,
      [agentA, orgA, bizA],
    );
    expect(await profileRepo.profile(agentA)).toEqual({
      agentId: agentA,
      organizationId: orgA,
      vertical: 'BEAUTY',
      objectName: 'Салон A',
      greetingTail: 'Работаем до 20 часов.',
      voiceName: 'Puck',
      handoffPhone: '+77009990000',
    });
    await sql.query(`UPDATE seller_agents SET lifecycle = 'active' WHERE id = $1`, [agentB]);
    expect(await profileRepo.profile(agentB)).toMatchObject({ voiceName: 'Leda', handoffPhone: null, greetingTail: '', vertical: 'BEAUTY' });
    await sql.query(`UPDATE seller_agents SET lifecycle = 'paused' WHERE id = $1`, [agentB]);
    expect(await profileRepo.profile(agentB)).toBeNull();
    expect(await profileRepo.profile(agentNoLoc)).toBeNull();
    await sql.query(`DELETE FROM voice_profiles WHERE agent_id = $1`, [agentA]);
  });

  it('агент в архиве событий не принимает', async () => {
    await sql.query(`UPDATE seller_agents SET lifecycle = 'archived' WHERE id = $1`, [agentNoLoc]);
    await expect(ingest.ingest(event({ agentId: agentNoLoc }))).rejects.toMatchObject({ status: 404 });
  });

  it('разбор события тот же, что в сервисе: плохое тело не доходит до базы', async () => {
      expect(() => parseVoiceEvent({ agentId: agentA })).toThrow();
      await expect(ingest.ingest({ agentId: agentA })).rejects.toMatchObject({ status: 400 });
    });
  },
);
