import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STAFF_NOTIFY_TICK_MS, StaffNotifyWorker } from './staff-notify.worker';

/**
 * Отправщик уведомлений сотрудникам (STAFF-TG-20261020) без базы: без токена бота не запускается и в базу не ходит
 * (попытки не тратятся), с ботом тикает раз в 10 с; в тестах и с STAFF_NOTIFY_WORKER=off выключен. Повторы, 403 и права
 * при отправке: tests/integration/staff-telegram-flow.test.ts на настоящей базе.
 */
const db = () => ({ $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 0) });
const bot = { client: { sendMessage: vi.fn(), username: vi.fn() }, webhookSecret: null };

describe('отправщик уведомлений сотрудникам', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('без токена бота: таймера нет, проход очереди базу не трогает', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const prisma = { db: db() };
    const worker = new StaffNotifyWorker(prisma as never, null, null);
    const spy = vi.spyOn(globalThis, 'setInterval');
    worker.onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    expect(await worker.tick()).toEqual({ sent: 0, skipped: 0, retried: 0, failed: 0 });
    expect(prisma.db.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.db.$executeRaw).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('с ботом: проход раз в 10 секунд; в тестах и с STAFF_NOTIFY_WORKER=off выключен', () => {
    vi.useFakeTimers();
    const prisma = { db: db() };
    vi.stubEnv('NODE_ENV', 'production');
    const live = new StaffNotifyWorker(prisma as never, bot as never, null);
    const tick = vi.spyOn(live, 'tick').mockResolvedValue({ sent: 0, skipped: 0, retried: 0, failed: 0 });
    live.onModuleInit();
    vi.advanceTimersByTime(STAFF_NOTIFY_TICK_MS * 3);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(STAFF_NOTIFY_TICK_MS).toBe(10_000);
    live.onModuleDestroy();

    for (const env of [{ NODE_ENV: 'test' }, { NODE_ENV: 'production', STAFF_NOTIFY_WORKER: 'off' }]) {
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const off = new StaffNotifyWorker(prisma as never, bot as never, null);
      const offTick = vi.spyOn(off, 'tick');
      off.onModuleInit();
      vi.advanceTimersByTime(STAFF_NOTIFY_TICK_MS * 2);
      expect(offTick).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    }
  });
});
