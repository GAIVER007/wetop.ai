import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaChannelsRepository } from './channels.repository';
import { forgetPropertyRef } from '../database/property-ref';
import type { PrismaService } from '../database/prisma.provider';

/**
 * SEC-1b, стадия B (Q-222, решение владельца 30.09.2026): у роли запросов организации `wetop_app` на `channel_outbox`
 * остаётся только `INSERT`. Prisma `create()` добавляет `RETURNING` и требует `SELECT`, поэтому постановка в очередь
 * идёт через `createMany()` (без `RETURNING`), а `id` создаётся в коде. Проверено на Postgres 16 (30.09.2026): `create()`
 * при `INSERT`-only падает с 42501, `createMany()` работает и откатывается вместе с транзакцией.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fakeDb() {
  const createMany = vi.fn(async (args: { data: unknown[] }) => ({ count: args.data.length }));
  const create = vi.fn(async () => {
    throw new Error('create() требует SELECT (RETURNING): при INSERT-only права его не хватит');
  });
  const db = {
    property: {
      findFirst: async () => ({
        id: 'prop-1',
        name: 'Luxx Aparts',
        organizationId: null,
        timezone: 'Asia/Almaty',
      }),
    },
    channelOutbox: { createMany, create },
  };
  return { db, createMany, create };
}

describe('очередь Channex: постановка сообщения без SELECT (Q-222, стадия B)', () => {
  beforeEach(() => forgetPropertyRef());

  it('используется createMany, а не create; id создан в коде и возвращён', async () => {
    const f = fakeDb();
    const repo = new PrismaChannelsRepository({ db: f.db } as unknown as PrismaService);
    const id = await repo.enqueueOutbox('channex', 'AVAILABILITY', [{ a: 1 }]);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.createMany).toHaveBeenCalledOnce();
    const args = f.createMany.mock.calls[0]![0] as { data: Array<Record<string, unknown>> };
    expect(args.data).toHaveLength(1);
    expect(args.data[0]).toMatchObject({
      id,
      provider: 'channex',
      kind: 'AVAILABILITY',
      propertyId: 'prop-1',
      payload: [{ a: 1 }],
    });
    expect(id).toMatch(UUID);
  });

  it('каждое сообщение получает свой id; payload копируется как JSON', async () => {
    const f = fakeDb();
    const repo = new PrismaChannelsRepository({ db: f.db } as unknown as PrismaService);
    const payload = [{ d: new Date('2026-10-01T00:00:00Z') }];
    const a = await repo.enqueueOutbox('channex', 'RESTRICTIONS', payload);
    const b = await repo.enqueueOutbox('channex', 'RESTRICTIONS', payload);
    expect(a).not.toBe(b);
    const first = (f.createMany.mock.calls[0]![0] as { data: Array<{ payload: unknown }> })
      .data[0]!;
    expect(first.payload).toEqual([{ d: '2026-10-01T00:00:00.000Z' }]);
  });
});
