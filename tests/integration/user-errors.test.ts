import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaUserErrorsRepository } from '../../apps/api/src/assistant/user-errors.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Журнал ошибок, которые видит человек (DATA_MODEL §14, миграция 20260924000018, ТЗ ред. 1, П3). Проверяется сама
 * база: выборка помощника отдаёт только ошибки этого человека в этой организации, новые сверху; код ответа вне
 * 400…599 и строка без времени не записываются; уборка удаляет только старое. Тест заводит своих вымышленных
 * человека и организации (ADR-010) и удаляет всё за собой.
 */
describe.skipIf(!url)('user_errors (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaUserErrorsRepository;
  const mark = Date.now().toString(36);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const t0 = new Date('2026-09-24T09:00:00.000Z');
  const row = (over: Partial<Parameters<PrismaUserErrorsRepository['record']>[0]> = {}) => ({
    at: t0,
    userId: userA,
    organizationId: orgA,
    method: 'POST',
    route: '/reservations',
    status: 400,
    message: 'adults — целое ≥ 1',
    requestId: randomUUID(),
    ...over,
  });

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaUserErrorsRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Тест журнала ошибок A ${mark}` },
        { id: orgB, name: `Тест журнала ошибок B ${mark}` },
      ],
    });
    await db.user.createMany({
      data: [
        { id: userA, email: `user-errors-a-${mark}@example.invalid` },
        { id: userB, email: `user-errors-b-${mark}@example.invalid` },
      ],
    });
  });

  afterAll(async () => {
    await db.userError.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('выборка помощника: только этот человек в этой организации, с даты, новые сверху', async () => {
    await repo.record(row({ at: new Date(t0.getTime() - 3_600_000), message: 'старая' }));
    await repo.record(row({ at: t0, message: 'первая' }));
    await repo.record(row({ at: new Date(t0.getTime() + 60_000), message: 'вторая', status: 409 }));
    await repo.record(row({ userId: userB, message: 'чужой человек' }));
    await repo.record(row({ organizationId: orgB, message: 'другая организация' }));

    const rows = await repo.list({
      userId: userA,
      organizationId: orgA,
      since: new Date(t0.getTime() - 60_000),
      limit: 10,
    });
    expect(rows.map((r) => r.message)).toEqual(['вторая', 'первая']);
    expect(rows[0]).toMatchObject({ status: 409, route: '/reservations', method: 'POST' });

    const limited = await repo.list({
      userId: userA,
      organizationId: orgA,
      since: new Date(0),
      limit: 1,
    });
    expect(limited.map((r) => r.message)).toEqual(['вторая']);
  });

  it('код ответа вне 400…599 база не принимает', async () => {
    await expect(repo.record(row({ status: 200 }))).rejects.toThrow(
      /user_errors_status_check|check constraint/i,
    );
  });

  it('времени строки база не ставит: без него строки нет', async () => {
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO user_errors (id, user_id, organization_id, method, route, status, message, request_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'GET', '/chessboard', 404, 'нет', $4::uuid)`,
        randomUUID(),
        userA,
        orgA,
        randomUUID(),
      ),
    ).rejects.toThrow(/null value|not-null/i);
  });

  it('уборка удаляет строки старше границы и не трогает свежие', async () => {
    const cutoff = new Date(t0.getTime() - 30 * 60_000);
    const before = await db.userError.count({ where: { userId: userA } });
    const deleted = await repo.deleteBefore(cutoff);
    expect(deleted).toBeGreaterThanOrEqual(1);
    const left = await db.userError.findMany({ where: { userId: userA } });
    expect(left).toHaveLength(before - 1);
    expect(left.every((r) => r.at.getTime() >= cutoff.getTime())).toBe(true);
  });
});
