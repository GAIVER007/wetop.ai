import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaExtensionsRepository } from '../../apps/api/src/platform/extensions.repository';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * «Платформа → Организации» и расширение «ИИ-продавец» (DATA_MODEL §16.3, миграция 20260925000020, ADR-083). Проверяется
 * сама база: изменение расширения и строка журнала пишутся одной транзакцией — отказ базы не оставляет записи «изменено»
 * без изменения; в списке организаций — только название, сроки, число людей, почты владельцев и расширение. Всё
 * вымышленное (ADR-010), убирается за собой.
 */
describe.skipIf(!url)('расширения организаций (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaExtensionsRepository;
  const mark = Date.now().toString(36);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const owner = randomUUID();
  const staff = randomUUID();
  const now = new Date('2026-09-25T09:00:00.000Z');
  const until = new Date('2026-10-02T18:59:59.999Z');

  const journal = () =>
    db.auditLog.findMany({
      where: { entityType: 'organization', entityId: orgA, action: 'extension.updated' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, before: true, after: true },
    });

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaExtensionsRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Тест расширений ${mark}` },
        { id: orgB, name: `Тест расширений, пустая ${mark}` },
      ],
    });
    await db.user.createMany({
      data: [
        { id: owner, email: `ext-owner-${mark}@example.invalid` },
        { id: staff, email: `ext-staff-${mark}@example.invalid` },
      ],
    });
    await db.membership.createMany({
      data: [
        { userId: owner, organizationId: orgA, role: 'OWNER' },
        { userId: staff, organizationId: orgA, role: 'STAFF' },
      ],
    });
  });

  afterAll(async () => {
    if (!db) return;
    await purgeAuditRows(db, { entityType: 'organization', entityId: { in: [orgA, orgB] } });
    await db.organizationExtension.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.user.deleteMany({ where: { id: { in: [owner, staff] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('изменение и журнал — одной транзакцией: было, стало, кто', async () => {
    expect(await repo.aiSeller(orgA)).toBeNull();

    await repo.saveAiSeller({
      organizationId: orgA,
      change: { status: 'TRIAL', activeUntil: until, note: 'пробный на неделю' },
      by: owner,
      now,
    });
    expect(await repo.aiSeller(orgA)).toMatchObject({ status: 'TRIAL', activeUntil: until, note: 'пробный на неделю' });

    await repo.saveAiSeller({
      organizationId: orgA,
      change: { status: 'ACTIVE', activeUntil: null, note: 'счёт 17' },
      by: owner,
      now: new Date(now.getTime() + 60_000),
    });

    const rows = await journal();
    expect(rows).toHaveLength(2);
    // строки не было — «было» пусто, а не выдуманное «выключен»
    expect(rows[0]?.before).toBeNull();
    expect(rows[0]?.after).toEqual({
      extension: 'AI_SELLER',
      status: 'TRIAL',
      activeUntil: until.toISOString(),
      note: 'пробный на неделю',
    });
    expect(rows[1]?.before).toMatchObject({ status: 'TRIAL' });
    expect(rows[1]?.after).toMatchObject({ status: 'ACTIVE', activeUntil: null, note: 'счёт 17' });
    expect(rows.every((r) => r.userId === owner)).toBe(true);
  });

  it('отказ базы — ни изменения, ни записи в журнале', async () => {
    // пробный без срока запрещает CHECK `organization_extensions_trial_until_check`
    await expect(
      repo.saveAiSeller({
        organizationId: orgA,
        change: { status: 'TRIAL', activeUntil: null, note: null },
        by: owner,
        now,
      }),
    ).rejects.toThrow();
    expect(await repo.aiSeller(orgA)).toMatchObject({ status: 'ACTIVE', note: 'счёт 17' });
    expect(await journal()).toHaveLength(2);
  });

  it('список организаций: люди, почты владельцев и расширение — без броней и гостей', async () => {
    const list = await repo.organizations();
    const a = list.find((o) => o.id === orgA);
    const b = list.find((o) => o.id === orgB);
    expect(a).toMatchObject({
      name: `Тест расширений ${mark}`,
      members: 2,
      owners: [`ext-owner-${mark}@example.invalid`],
      aiSeller: { status: 'ACTIVE', activeUntil: null },
    });
    expect(b).toMatchObject({ members: 0, owners: [], aiSeller: null, businesses: 0, locations: 0 });
    // ровно эти поля и ничего лишнего: броней, гостей, счетов нет; структура партнёра — только счётчики (Platform P3)
    expect(Object.keys(a ?? {}).sort()).toEqual(
      ['aiSeller', 'businesses', 'createdAt', 'id', 'locations', 'members', 'name', 'owners', 'status', 'trialEndsAt'].sort(),
    );
    expect(await repo.organization(orgB)).toMatchObject({ id: orgB, aiSeller: null });
    expect(await repo.organization(randomUUID())).toBeNull();
  });
});
