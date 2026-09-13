import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaIncidentsRepository } from '../../apps/api/src/guard/incidents.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Одно место для неисправностей (DATA_MODEL §12, миграция 20260913000012). Проверяется сама база:
 * повтор открытой неисправности не создаёт строку (частичный уникальный индекс, INSERT … ON CONFLICT),
 * закрытая и снова возникшая — новая строка, закрытая обязана знать когда и кем, секреты не доезжают до строки.
 * Тест пишет только свои строки с меткой в отпечатке и удаляет их за собой.
 */
describe.skipIf(!url)('system_incidents (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaIncidentsRepository;
  const mark = `api.error:INTEGRATION-TEST ${Date.now().toString(36)}`;
  const route = mark.slice('api.error:'.length);
  const obs = () => ({
    kind: 'api.error' as const,
    title: `Ошибка программы на ${route}`,
    subjectType: 'route',
    subjectId: route,
    fingerprint: mark,
    details: { error: 'boom postgresql://app:pw-not-real@db.example.com/pms' },
  });

  beforeAll(() => {
    db = createPrismaClient(url);
    repo = new PrismaIncidentsRepository({ db } as PrismaService);
  });
  afterAll(async () => {
    await db.systemIncident.deleteMany({ where: { fingerprint: mark } });
    await db.$disconnect();
  });

  it('повтор открытой неисправности — та же строка, счётчик растёт; закрытая и снова возникшая — новая строка', async () => {
    const t0 = new Date('2026-09-13T21:00:00Z');
    const a = await repo.record(obs(), t0);
    const b = await repo.record(obs(), new Date(t0.getTime() + 60_000));
    expect(b.id).toBe(a.id);
    expect(b.occurrences).toBe(2);
    expect(b.lastSeenAt.getTime()).toBe(t0.getTime() + 60_000);
    expect(b.class).toBe('C');

    await repo.resolve([a.id], 'GUARD', new Date(t0.getTime() + 120_000));
    const c = await repo.record(obs(), new Date(t0.getTime() + 180_000));
    expect(c.id).not.toBe(a.id);
    expect(c.occurrences).toBe(1);
    expect(await db.systemIncident.count({ where: { fingerprint: mark } })).toBe(2);
  });

  it('пароль из текста ошибки в строку не попадает', async () => {
    const rows = await db.systemIncident.findMany({ where: { fingerprint: mark } });
    expect(JSON.stringify(rows.map((r) => r.details))).not.toContain('pw-not-real');
  });

  it('база не даёт закрыть неисправность без времени и того, кто закрыл', async () => {
    const open = await db.systemIncident.findFirstOrThrow({
      where: { fingerprint: mark, status: { not: 'RESOLVED' } },
    });
    await expect(
      db.systemIncident.update({ where: { id: open.id }, data: { status: 'RESOLVED' } }),
    ).rejects.toThrow(/system_incidents_resolved_consistent|check constraint/i);
  });
});
