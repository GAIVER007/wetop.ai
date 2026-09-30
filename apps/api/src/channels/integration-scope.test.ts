import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaChannelsRepository } from './channels.repository';
import { forgetPropertyRef } from '../database/property-ref';
import type { PrismaService } from '../database/prisma.provider';

/**
 * SEC-1b, стадия B1.5 (Q-222, решение владельца 30.09.2026): запросы к данным интеграции идут служебной ролью, и фильтра по
 * провайдеру мало. Каждое чтение и правка очереди и журнала событий ограничены объектом, который выбирает сервер
 * (`propertyId`), а не пришедшим от клиента. Здесь — форма условия каждого запроса; настоящая база — в integration-тесте.
 */
const PROPERTY = 'prop-server-1';

function fakeDb() {
  const calls: Array<{ op: string; args: { where?: Record<string, unknown> } }> = [];
  const rec = (op: string, ret: unknown) =>
    vi.fn(async (args: { where?: Record<string, unknown> }) => {
      calls.push({ op, args });
      return ret;
    });
  const db = {
    property: {
      findFirst: async () => ({
        id: PROPERTY,
        name: 'Luxx Aparts',
        organizationId: null,
        timezone: 'Asia/Almaty',
      }),
    },
    channelOutbox: {
      findMany: rec('outbox.findMany', []),
      updateMany: rec('outbox.updateMany', { count: 0 }),
    },
    externalEvent: {
      findFirst: rec('event.findFirst', null),
    },
    systemIncident: {},
    $queryRaw: vi.fn(async () => []),
  };
  return { db, calls };
}

describe('данные интеграции: чтения и правки ограничены объектом сервера (B1.5)', () => {
  let f: ReturnType<typeof fakeDb>;
  let repo: PrismaChannelsRepository;
  beforeEach(() => {
    forgetPropertyRef();
    f = fakeDb();
    repo = new PrismaChannelsRepository({ db: f.db } as unknown as PrismaService);
  });
  const where = (op: string) => f.calls.find((c) => c.op === op)!.args.where!;

  it('pendingOutbox: провайдер, вид, статус И объект', async () => {
    await repo.pendingOutbox('channex', 'AVAILABILITY', new Date());
    expect(where('outbox.findMany')).toMatchObject({
      provider: 'channex',
      kind: 'AVAILABILITY',
      propertyId: PROPERTY,
    });
  });

  it('recentOutbox: провайдер И объект', async () => {
    await repo.recentOutbox('channex', 5);
    expect(where('outbox.findMany')).toMatchObject({ provider: 'channex', propertyId: PROPERTY });
  });

  it('lastEventAt: провайдер, канал И объект', async () => {
    await repo.lastEventAt('channex', 'WEBHOOK');
    expect(where('event.findFirst')).toMatchObject({
      provider: 'channex',
      receivedVia: 'WEBHOOK',
      propertyId: PROPERTY,
    });
  });

  it('markOutboxSent и markOutboxRetry: id сообщений И объект (чужой id не правится)', async () => {
    await repo.markOutboxSent(['a', 'b'], 't1');
    await repo.markOutboxRetry(['a'], 'ошибка', new Date(), false);
    const updates = f.calls.filter((c) => c.op === 'outbox.updateMany');
    expect(updates).toHaveLength(2);
    for (const u of updates)
      expect(u.args.where).toMatchObject({ propertyId: PROPERTY, id: { in: expect.any(Array) } });
  });
});
