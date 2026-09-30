import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SEC-1b, стадия B (Q-222): постановка в очередь идёт через `createMany` с id из кода — без `RETURNING`, то есть без права
 * `SELECT`, которого у `wetop_app` на `channel_outbox` не будет. Здесь — что это сохраняет прежнее поведение на настоящей базе:
 * строка появляется с возвращённым id и объектом, а откат транзакции команды убирает и запись очереди (окна между правкой
 * цен и очередью нет, вариант (в) отвергнут).
 *
 * Пишутся только свои строки с меткой в провайдере, они удаляются за собой.
 */
describe.skipIf(!url)('очередь Channex: enqueueOutbox на настоящей базе (integration)', () => {
  let db: Db;
  const provider = `channex-test-enqueue-${Date.now().toString(36)}`;

  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.channelOutbox.deleteMany({ where: { provider } });
    await db?.$disconnect();
  });

  it('строка есть, id совпадает с возвращённым, объект проставлен, вид и payload сохранены', async () => {
    const repo = new PrismaChannelsRepository({ db } as unknown as PrismaService);
    const id = await repo.enqueueOutbox(provider, 'AVAILABILITY', [{ a: 1 }]);
    const row = await db.channelOutbox.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ provider, kind: 'AVAILABILITY', status: 'PENDING' });
    expect(row.propertyId).toBeTruthy();
    expect(row.payload).toEqual([{ a: 1 }]);
  });

  it('в транзакции команды: коммит оставляет запись, откат — убирает', async () => {
    const kept = await db.$transaction(async (tx) =>
      new PrismaChannelsRepository({ db: tx } as unknown as PrismaService).enqueueOutbox(
        provider,
        'RESTRICTIONS',
        [{ kept: true }],
      ),
    );
    expect(await db.channelOutbox.count({ where: { id: kept } })).toBe(1);

    let rolledBackId = '';
    await expect(
      db.$transaction(async (tx) => {
        rolledBackId = await new PrismaChannelsRepository({
          db: tx,
        } as unknown as PrismaService).enqueueOutbox(provider, 'RESTRICTIONS', [{ kept: false }]);
        throw new Error('откат команды');
      }),
    ).rejects.toThrow('откат команды');
    expect(rolledBackId).toBeTruthy();
    expect(await db.channelOutbox.count({ where: { id: rolledBackId } })).toBe(0);
  });
});
