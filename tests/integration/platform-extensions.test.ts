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
  const orgC = randomUUID();
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
        { id: orgC, name: `Тест архива ${mark}`, status: 'ACTIVE' },
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
    await purgeAuditRows(db, { entityType: 'organization', entityId: { in: [orgA, orgB, orgC] } });
    await db.organizationExtension.deleteMany({ where: { organizationId: { in: [orgA, orgB, orgC] } } });
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB, orgC] } } });
    await db.user.deleteMany({ where: { id: { in: [owner, staff] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB, orgC] } } });
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
    expect(b).toMatchObject({ members: 0, owners: [], aiSeller: null });
    expect(Object.keys(a ?? {}).sort()).toEqual(
      ['aiSeller', 'createdAt', 'id', 'members', 'name', 'owners', 'status', 'trialEndsAt'].sort(),
    );
    expect(await repo.organization(orgB)).toMatchObject({ id: orgB, aiSeller: null });
    expect(await repo.organization(randomUUID())).toBeNull();
  });

  const trace = (id: string, action: string) =>
    db.auditLog.findMany({
      where: { entityType: 'organization', entityId: id, action },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, before: true, after: true },
    });

  it('название: меняется и пишется в журнал, было и стало', async () => {
    await repo.rename({ organizationId: orgC, name: `Тест архива, новое ${mark}`, by: owner, now });
    expect(await repo.organization(orgC)).toMatchObject({ name: `Тест архива, новое ${mark}` });
    const rows = await trace(orgC, 'organization.renamed');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: owner,
      before: { name: `Тест архива ${mark}` },
      after: { name: `Тест архива, новое ${mark}` },
    });
  });

  it('архив: статус SUSPENDED и журнал с прежним статусом; данные организации на месте', async () => {
    await repo.archive({ organizationId: orgC, by: owner, now });
    expect(await repo.organization(orgC)).toMatchObject({ status: 'SUSPENDED' });
    const rows = await trace(orgC, 'organization.archived');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: owner, before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' } });
    // в архиве ничего не удалено: организация и всё прежнее название в списке
    expect((await repo.organizations()).some((o) => o.id === orgC)).toBe(true);
  });

  it('возврат из архива: прежний статус и строка журнала', async () => {
    await repo.restore({ organizationId: orgC, by: owner, now: new Date(now.getTime() + 60_000) });
    expect(await repo.organization(orgC)).toMatchObject({ status: 'ACTIVE' });
    const rows = await trace(orgC, 'organization.restored');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: owner, before: { status: 'SUSPENDED' }, after: { status: 'ACTIVE' } });
  });

  it('второй архив и возврат берут статус из последней записи, а не из первой', async () => {
    await repo.saveStatus({ organizationId: orgC, status: 'READ_ONLY', note: null, by: owner, now });
    await repo.archive({ organizationId: orgC, by: owner, now: new Date(now.getTime() + 120_000) });
    await repo.restore({ organizationId: orgC, by: owner, now: new Date(now.getTime() + 180_000) });
    expect(await repo.organization(orgC)).toMatchObject({ status: 'READ_ONLY' });
  });

  it('записи об архиве нет: возврат в «только чтение», платный доступ сам не появляется', async () => {
    await db.organization.update({ where: { id: orgB }, data: { status: 'SUSPENDED' } });
    await repo.restore({ organizationId: orgB, by: owner, now });
    expect(await repo.organization(orgB)).toMatchObject({ status: 'READ_ONLY' });
  });
});
