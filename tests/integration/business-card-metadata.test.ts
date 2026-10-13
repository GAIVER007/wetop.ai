import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createPrismaClient } from '@pms/database';
import { BusinessCardsService } from '../../apps/api/src/hotel/business-cards';
import { withSignedInUser, databaseTenant } from '../../apps/api/src/auth/request-context';
const db = createPrismaClient(undefined, undefined, {
  of: databaseTenant,
  appConnectionString: process.env.DATABASE_APP_URL,
});
const orgA = randomUUID(),
  orgB = randomUUID(),
  user = randomUUID(),
  businessA = randomUUID(),
  businessB = randomUUID();
const objects = new Map<string, Buffer>();
const storage = {
  put: async ({ key, body }: { key: string; body: Buffer }) => {
    objects.set(key, body);
  },
  delete: async (key: string) => {
    objects.delete(key);
  },
  signedGet: async () => 'https://assets.invalid/card.webp',
  exists: async (key: string) => objects.has(key),
};
const service = new BusinessCardsService({ db } as never, storage);
const owner = <T>(fn: () => Promise<T>) =>
  withSignedInUser({ userId: user, organizationId: orgA, role: 'OWNER' }, fn);
beforeAll(async () => {
  await db.user.create({
    data: { id: user, email: `card-owner-${user}@example.invalid`, name: 'Вымышленный владелец' },
  });
  await db.organization.createMany({
    data: [
      { id: orgA, name: 'Тестовая организация A', status: 'ACTIVE' },
      { id: orgB, name: 'Тестовая организация B', status: 'ACTIVE' },
    ],
  });
  await db.membership.create({ data: { organizationId: orgA, userId: user, role: 'OWNER' } });
  await db.business.createMany({
    data: [
      { id: businessA, organizationId: orgA, name: 'Тестовый бизнес A', vertical: 'HOSPITALITY' },
      { id: businessB, organizationId: orgB, name: 'Тестовый бизнес B', vertical: 'BEAUTY' },
    ],
  });
});
afterAll(async () => db.$disconnect());
describe('business card database persistence and tenant isolation', () => {
  it('shows owner projects without locations while excluding another organization', async () => {
    const cards = await owner(() => service.list([]));
    expect(cards.some((card) => card.id === businessA)).toBe(true);
    expect(cards.some((card) => card.id === businessB)).toBe(false);
  });
  it('edits a legacy business whose updated_at has PostgreSQL microseconds', async () => {
    const id = randomUUID();
    await db.business.create({
      data: {
        id,
        organizationId: orgA,
        name: 'Исторический тестовый бизнес',
        vertical: 'HOSPITALITY',
      },
    });
    await db.$executeRaw`UPDATE businesses SET updated_at='2026-10-13T01:02:03.123456Z'::timestamptz WHERE id=${id}::uuid`;
    const [card] = await owner(() => service.list([id]));
    const saved = await owner(() =>
      service.save(id, {
        name: card!.name,
        description: 'Описание старого бизнеса',
        expectedUpdatedAt: card!.updatedAt,
        removeCover: '0',
      }),
    );
    expect(saved.description).toBe('Описание старого бизнеса');
  });

  it('persists metadata, rolls back an audit failure, and rejects stale versions', async () => {
    const before = await owner(() => db.business.findUniqueOrThrow({ where: { id: businessA } }));
    const saved = await owner(() =>
      service.save(businessA, {
        name: 'Новое название',
        description: 'Сохранённое описание',
        expectedUpdatedAt: before.updatedAt.toISOString(),
        removeCover: '0',
      }),
    );
    const after = await owner(() => db.business.findUniqueOrThrow({ where: { id: businessA } }));
    expect(after.description).toBe('Сохранённое описание');
    expect(after.name).toBe('Новое название');
    const failing = new BusinessCardsService(
      {
        db: {
          $queryRaw: db.$queryRaw.bind(db),
          $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
            db.$transaction((tx) =>
              fn({
                $executeRaw: tx.$executeRaw.bind(tx),
                $queryRaw: tx.$queryRaw.bind(tx),
                auditLog: {
                  create: async () => {
                    throw new Error('audit unavailable');
                  },
                },
              }),
            ),
        },
      } as never,
      storage,
    );
    await expect(
      owner(() =>
        failing.save(businessA, {
          name: 'Не сохранять',
          description: 'Не сохранять',
          expectedUpdatedAt: saved.updatedAt,
          removeCover: '0',
        }),
      ),
    ).rejects.toThrow('audit unavailable');
    expect(
      (await owner(() => db.business.findUniqueOrThrow({ where: { id: businessA } }))).name,
    ).toBe('Новое название');
    await expect(
      owner(() =>
        service.save(businessA, {
          name: 'Устаревшая версия',
          description: '',
          expectedUpdatedAt: before.updatedAt.toISOString(),
          removeCover: '0',
        }),
      ),
    ).rejects.toThrow('изменилась');
    expect(
      await db.auditLog.count({ where: { entityId: businessA, action: 'business.card_updated' } }),
    ).toBe(1);
  });
  it('rejects foreign business metadata and raw foreign image references', async () => {
    const foreign = await db.business.findUniqueOrThrow({ where: { id: businessB } });
    await expect(
      owner(() =>
        service.save(businessB, {
          name: 'Нельзя',
          description: '',
          expectedUpdatedAt: foreign.updatedAt.toISOString(),
          removeCover: '0',
        }),
      ),
    ).rejects.toThrow('недоступен');
    expect(await owner(() => service.list([businessA, businessB]))).toHaveLength(1);
    const invalid = {
      storageRef: `business-cards/${orgB}/${businessB}/${randomUUID()}.webp`,
      mimeType: 'image/webp',
      byteSize: 10,
      width: 10,
      height: 10,
      sha256: 'a'.repeat(64),
    };
    await expect(
      db.business.update({ where: { id: businessA }, data: { coverImage: invalid } }),
    ).rejects.toThrow();
    if (process.env.DATABASE_APP_URL) {
      const rows = await owner(
        () =>
          db.$queryRaw<
            Array<{ id: string }>
          >`SELECT id FROM businesses WHERE id=${businessB}::uuid`,
      );
      expect(rows).toEqual([]);
    }
  });
  it('persists a sanitized cover and removes its reference without deleting unrelated objects', async () => {
    const image = await sharp({
      create: { width: 120, height: 80, channels: 3, background: { r: 40, g: 80, b: 120 } },
    })
      .png()
      .toBuffer();
    const row = await owner(() => db.business.findUniqueOrThrow({ where: { id: businessA } }));
    const [cardBefore] = await owner(() => service.list([businessA]));
    const saved = await owner(() =>
      service.save(
        businessA,
        {
          name: row.name,
          description: row.description,
          expectedUpdatedAt: cardBefore!.updatedAt,
          removeCover: '0',
        },
        { buffer: image },
      ),
    );
    const stored = await owner(() => db.business.findUniqueOrThrow({ where: { id: businessA } }));
    expect(stored.coverImage).toMatchObject({ mimeType: 'image/webp', width: 120, height: 80 });
    expect(objects.size).toBe(1);
    await owner(() =>
      service.save(businessA, {
        name: stored.name,
        description: stored.description,
        expectedUpdatedAt: saved.updatedAt,
        removeCover: '1',
      }),
    );
    expect(
      (await owner(() => db.business.findUniqueOrThrow({ where: { id: businessA } }))).coverImage,
    ).toBeNull();
    expect(objects.size).toBe(1);
    const audit = await db.auditLog.findMany({
      where: { entityId: businessA, action: 'business.card_updated' },
    });
    expect(JSON.stringify(audit)).not.toContain('storageRef');
    expect(JSON.stringify(audit)).not.toContain('card.webp');
  });
});
