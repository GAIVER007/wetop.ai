import { describe, expect, it } from 'vitest';
import {
  E2E_NOTE,
  INTEGRATION_SITE_NAME,
  blocksToDelete,
  reservationsToCancel,
  sitesToDelete,
  type CleanupBlock,
  type CleanupReservation,
  type CleanupSite,
} from './e2e-cleanup-rules';

/**
 * Уборка автотестов запускается после каждого прогона Playwright. В репозитории одновременно работают
 * две сессии на одной dev-БД: уборка, закончившая прогон одной сессии, отменяла бронь и удаляла сайт
 * счётчика, которые в эту минуту использует тест другой сессии. Отсюда плавающие падения
 * web-analytics.test.ts в общем прогоне (12–13.09.2026): сайт исчезал вместе с сессиями посреди теста.
 * Правило: уборка трогает только то, что создано давно — дольше любого теста.
 */
const now = new Date('2026-09-13T10:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const res = (over: Partial<CleanupReservation>): CleanupReservation => ({
  confirmationNumber: '20260913-ABC123',
  notes: `${E2E_NOTE}: бронь теста`,
  createdAt: minutesAgo(120),
  ...over,
});
const site = (over: Partial<CleanupSite>): CleanupSite => ({
  name: `${E2E_NOTE} сайт`,
  publicKey: 'pms_0123456789ab',
  createdAt: minutesAgo(120),
  ...over,
});

describe('reservationsToCancel', () => {
  it('бронь автотеста, созданная давно, отменяется', () => {
    expect(reservationsToCancel([res({})], now)).toHaveLength(1);
  });
  it('свежую бронь не трогает: её, возможно, прямо сейчас использует тест другой сессии', () => {
    expect(reservationsToCancel([res({ createdAt: minutesAgo(1) })], now)).toHaveLength(0);
  });
  it('бронь из Exely с настоящим номером не трогает ни в каком возрасте', () => {
    expect(
      reservationsToCancel(
        [res({ confirmationNumber: '20260913-513903-1263592109', notes: null })],
        now,
      ),
    ).toHaveLength(0);
  });
});

describe('blocksToDelete', () => {
  const block = (over: Partial<CleanupBlock>): CleanupBlock => ({
    reason: `${E2E_NOTE}: блокировка койки`,
    createdAt: minutesAgo(120),
    ...over,
  });
  it('давнюю блокировку автотеста снимает — сорванный прогон не должен навсегда закрыть койку', () => {
    expect(blocksToDelete([block({})], now)).toHaveLength(1);
  });
  it('свежую не снимает: спек блокировок другой сессии как раз проверяет, что койка закрыта', () => {
    expect(blocksToDelete([block({ createdAt: minutesAgo(1) })], now)).toHaveLength(0);
  });
  it('блокировку администратора без метки не трогает', () => {
    expect(
      blocksToDelete([block({ reason: 'ремонт' }), block({ reason: null })], now),
    ).toHaveLength(0);
  });
});

describe('sitesToDelete', () => {
  it('давний сайт e2e и давний сайт интеграционного теста удаляются', () => {
    expect(
      sitesToDelete([site({}), site({ name: `${INTEGRATION_SITE_NAME} a1b2c3` })], now),
    ).toHaveLength(2);
  });
  it('свежий сайт автотеста не удаляет — посреди теста это ломает счётчики сессий', () => {
    expect(
      sitesToDelete(
        [
          site({ createdAt: minutesAgo(2) }),
          site({ name: `${INTEGRATION_SITE_NAME} a1b2c3`, createdAt: minutesAgo(2) }),
        ],
        now,
      ),
    ).toHaveLength(0);
  });
  it('настоящий сайт владельца не трогает', () => {
    expect(sitesToDelete([site({ name: 'Luxx Aparts' })], now)).toHaveLength(0);
  });
});
