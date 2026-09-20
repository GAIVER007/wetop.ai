import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Controller, HttpCode, Inject, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSessionToken, newSessionToken } from '@pms/domain';
import { AccountsModule } from '../../apps/api/src/accounts/accounts.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaGuestsRepository } from '../../apps/api/src/guests/guests.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
process.env.SESSION_SECRET ??= 'секрет-для-прогона';
const url = process.env.DATABASE_URL;

/**
 * Срез 13, этап 8: `audit_logs.user_id` получает автора действия (обещано ADR-023, сделано ADR-046).
 * Живая база: сессия лежит в `sessions`, middleware учётных записей находит её по `Bearer`, а
 * хранилище гостей пишет строку журнала тем же кодом, что и стойка. Без ключа автор — `null`.
 */
const PROBE_ACTION = 'integration.audit-author';

@Controller('__probe')
class ProbeController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Post('audit')
  @HttpCode(201)
  async audit(): Promise<{ guestId: string }> {
    const guestId = randomUUID();
    await new PrismaGuestsRepository(this.prisma).audit(guestId, PROBE_ACTION, ['probe']);
    return { guestId };
  }
}

describe.skipIf(!url)('audit author from session (integration, DATABASE_URL required)', () => {
  let db: Db;
  let app: INestApplication;
  let migrated = false;
  const orgId = randomUUID();
  const userId = randomUUID();
  const email = `author-${randomUUID().slice(0, 8)}@example.test`;
  const token = newSessionToken();
  const guestIds: string[] = [];

  beforeAll(async () => {
    db = createPrismaClient(url);
    const rows = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'token_hash'`;
    migrated = rows.length > 0;
    if (!migrated) {
      console.warn('миграция 20260916000014_session_token_hash не применена — проверки пропущены');
      return;
    }
    await db.$executeRaw`INSERT INTO organizations (id, name, status, trial_ends_at, created_at)
      VALUES (${orgId}::uuid, ${'Автор журнала (integration)'}, 'TRIAL', now() + interval '7 days', now())`;
    await db.$executeRaw`INSERT INTO users (id, email, status, created_at)
      VALUES (${userId}::uuid, ${email}, 'ACTIVE', now())`;
    await db.$executeRaw`INSERT INTO memberships (user_id, organization_id, created_at)
      VALUES (${userId}::uuid, ${orgId}::uuid, now())`;
    // ADR-053: действующие сессии пароля хранят SHA-256; прежний HMAC входа по коду снят.
    await db.$executeRaw`INSERT INTO sessions (id, token_hash, user_id, organization_id, issued_at, expires_at)
      VALUES (${randomUUID()}::uuid, ${hashSessionToken(token)}, ${userId}::uuid, ${orgId}::uuid, now(), now() + interval '12 hours')`;

    // ProbeController живёт в корневом тестовом модуле, а PrismaService — внутри AccountsModule, откуда
    // он не экспортируется: без своей регистрации Nest отвечает «can't resolve dependencies of the
    // ProbeController» (первый живой прогон 17.09.2026). Подмена ниже накрывает обе регистрации.
    const moduleRef = await Test.createTestingModule({
      imports: [AccountsModule],
      controllers: [ProbeController],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (migrated) {
      if (guestIds.length)
        await db.$executeRaw`DELETE FROM audit_logs WHERE action = ${PROBE_ACTION} AND entity_id = ANY(${guestIds})`;
      await db.$executeRaw`DELETE FROM sessions WHERE user_id = ${userId}::uuid`;
      await db.$executeRaw`DELETE FROM memberships WHERE user_id = ${userId}::uuid`;
      await db.$executeRaw`DELETE FROM users WHERE id = ${userId}::uuid`;
      await db.$executeRaw`DELETE FROM organizations WHERE id = ${orgId}::uuid`;
    }
    await db.$disconnect();
  });

  async function authorOf(guestId: string): Promise<string | null> {
    const rows = await db.$queryRaw<Array<{ user_id: string | null }>>`
      SELECT user_id FROM audit_logs WHERE action = ${PROBE_ACTION} AND entity_id = ${guestId}`;
    expect(rows).toHaveLength(1);
    return rows[0]!.user_id;
  }

  it('действие с ключом сессии подписано автором: user_id в audit_logs равен вошедшему', async (ctx) => {
    if (!migrated) return ctx.skip();
    const res = await request(app.getHttpServer())
      .post('/__probe/audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    guestIds.push(res.body.guestId);
    expect(await authorOf(res.body.guestId)).toBe(userId);
  });

  it('то же действие без ключа — автор пуст, как было до среза 13', async (ctx) => {
    if (!migrated) return ctx.skip();
    const res = await request(app.getHttpServer()).post('/__probe/audit').expect(201);
    guestIds.push(res.body.guestId);
    expect(await authorOf(res.body.guestId)).toBeNull();
  });

  it('отозванная сессия автора не даёт', async (ctx) => {
    if (!migrated) return ctx.skip();
    await db.$executeRaw`UPDATE sessions SET revoked_at = now() WHERE user_id = ${userId}::uuid`;
    const res = await request(app.getHttpServer())
      .post('/__probe/audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    guestIds.push(res.body.guestId);
    expect(await authorOf(res.body.guestId)).toBeNull();
  });
});
