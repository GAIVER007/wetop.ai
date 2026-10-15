import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaTasksRepository } from '../../apps/api/src/tasks/tasks.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Задачи стойки (DATA_MODEL §22) на настоящей схеме: создание и правка, закрытие и повтор, счётчик открытых,
 * ограничения базы (длина названия, формат времени), задача по несуществующей брони остаётся без связи.
 * Данные вымышленные (ADR-010), после прогона удаляются.
 */
describe.skipIf(!url)('задачи стойки (integration, DATA_MODEL §22)', () => {
  let db: Db;
  let repo: PrismaTasksRepository;
  const cleanup = () => db.deskTask.deleteMany({});

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaTasksRepository({ db } as unknown as PrismaService);
    expect(await db.property.findFirst({ where: { name: LUXX_APARTS_PROPERTY.name } }), 'в тестовой базе нужен объект').toBeTruthy();
    await cleanup();
  });
  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('создаёт, правит, закрывает и открывает снова; открытые считаются по сроку', async () => {
    const a = await repo.create({ title: 'Позвонить гостю', dueDate: '2031-06-01', dueTime: '09:30', priority: 'HIGH' });
    const b = await repo.create({ title: 'Заказать воду', dueDate: '2031-06-05', priority: 'NORMAL' });
    expect(a).toMatchObject({ dueDate: '2031-06-01', dueTime: '09:30', priority: 'HIGH', doneAt: null });
    expect(await repo.openDueCount('2031-06-01')).toBe(1);
    expect(await repo.openDueCount('2031-06-30')).toBe(2);

    const done = await repo.update(a.id, { done: true });
    expect(done?.doneAt).not.toBeNull();
    expect(await repo.openDueCount('2031-06-30')).toBe(1);
    expect((await repo.update(a.id, { done: false }))?.doneAt).toBeNull();

    expect((await repo.update(b.id, { title: 'Заказать воду и чай', dueTime: null }))?.title).toBe('Заказать воду и чай');
    const list = await repo.list();
    expect(list.map((t) => t.title)).toEqual(['Позвонить гостю', 'Заказать воду и чай']);
    expect(await repo.update('00000000-0000-4000-8000-0000000000ff', { title: 'x' })).toBeNull();
  });

  it('база сама отклоняет длинное название и неверное время', async () => {
    const property = (await db.property.findFirst({ where: { name: LUXX_APARTS_PROPERTY.name }, select: { id: true } }))!;
    const base = { propertyId: property.id, dueDate: new Date('2031-06-01T00:00:00Z') };
    await expect(db.deskTask.create({ data: { ...base, title: 'я'.repeat(201) } })).rejects.toThrow();
    await expect(db.deskTask.create({ data: { ...base, title: 'x', dueTime: '25:00' } })).rejects.toThrow();
    await expect(db.deskTask.create({ data: { ...base, title: '' } })).rejects.toThrow();
  });

  it('связь с несуществующей бронью не ставится, задача создаётся без неё', async () => {
    const t = await repo.create({ title: 'Проверить бронь', dueDate: '2031-06-02', reservationNumber: 'NO-SUCH-1' });
    expect(t.reservationNumber).toBeNull();
  });
});
