import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { publishAfterCommit, type AriPublisher } from './ari-publisher';

/**
 * Сбой постановки дельты остатков после записи команды (Б6). Команду не роняем — запись уже в базе, а 500
 * заставил бы администратора повторить и создать дубль. Но молчать тоже нельзя: очередь пуста, значит ни
 * «упавшая отправка», ни «застряла очередь» сбоя не увидят, и канал продаёт по старому остатку до ночной
 * выгрузки. Поэтому сбой пишется в журнал — оттуда его берёт сторож (ADR-028).
 */
const CHANGE = { categoryCodes: ['MALE'], from: '2026-09-20', toExclusive: '2026-09-22' };

describe('дельта доступности после коммита', () => {
  it('сбой постановки: команда не падает, сторожу оставлен след в журнале', async () => {
    const lost: Array<{ change: unknown; error: string }> = [];
    const publisher: AriPublisher = {
      reservationChanged: async () => {
        throw new Error('Connection terminated');
      },
      ratesChanged: async () => 0,
      deltaLost: async (change, error) => {
        lost.push({ change, error });
      },
    };

    await expect(publishAfterCommit(publisher, CHANGE)).resolves.toBeUndefined();
    expect(lost).toHaveLength(1);
    expect(lost[0]!.change).toEqual(CHANGE);
    expect(lost[0]!.error).toContain('Connection terminated');
  });

  it('дельта встала в очередь — в журнал ничего не пишем', async () => {
    let lost = 0;
    const publisher: AriPublisher = {
      reservationChanged: async () => {},
      ratesChanged: async () => 0,
      deltaLost: async () => {
        lost += 1;
      },
    };
    await publishAfterCommit(publisher, CHANGE);
    expect(lost).toBe(0);
  });

  it('и сама запись следа не прошла — команда всё равно не падает', async () => {
    const publisher: AriPublisher = {
      reservationChanged: async () => {
        throw new Error('очередь недоступна');
      },
      ratesChanged: async () => 0,
      deltaLost: async () => {
        throw new Error('и журнал недоступен');
      },
    };
    await expect(publishAfterCommit(publisher, CHANGE)).resolves.toBeUndefined();
  });
});
