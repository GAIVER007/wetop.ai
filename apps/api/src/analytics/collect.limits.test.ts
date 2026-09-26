import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { AnalyticsRepository } from './analytics.repository';
import { COLLECT_LIMITS, CollectService } from './collect.service';

/**
 * Аудит 26.09, С-34: приёмник счётчика искал в базе сайт для любого ключа правильного вида и навсегда оставлял ответ в
 * памяти. Поток случайных ключей занимал общий пул базы (5 соединений на весь API) и растил память без предела.
 */
describe('приёмник счётчика и случайные ключи', () => {
  it('поисков неизвестных ключей в базе — не больше предела в минуту, память кэша ограничена', async () => {
    let lookups = 0;
    const repo = {
      async siteByKey() {
        lookups += 1;
        return null;
      },
      async allSites() {
        return [];
      },
    } as unknown as AnalyticsRepository;
    const collect = new CollectService(repo);
    const now = new Date('2026-09-26T10:00:00Z');
    for (let i = 0; i < 3_000; i += 1) {
      const key = `pms_${i.toString(16).padStart(12, '0')}`;
      await collect.accept(
        JSON.stringify({
          k: key,
          v: 'visitor-0001',
          s: 'session-0001',
          t: 'pageview',
          u: 'http://x.local/',
        }),
        { origin: 'http://x.local' },
        now,
      );
    }
    expect(lookups).toBeLessThanOrEqual(COLLECT_LIMITS.unknownLookupsPerMinute);
    expect(
      (collect as unknown as { siteCache: Map<string, unknown> }).siteCache.size,
    ).toBeLessThanOrEqual(COLLECT_LIMITS.siteCacheSize);
  });

  // Проверка исправлений 26.09: предел поисков был общий, и пять запросов в секунду со случайными ключами выключали сбор
  // для всех сайтов — после каждого перезапуска кэш пуст, и настоящий сайт получал «unknown site».
  it('поток случайных ключей не выключает сбор настоящему сайту, которого ещё нет в кэше', async () => {
    const real = {
      id: 'site-1',
      name: 'Сайт',
      hosts: ['x.local'],
      publicKey: 'pms_0123456789ab',
      status: 'ACTIVE',
    };
    const repo = {
      async siteByKey(key: string) {
        return key === real.publicKey ? real : null;
      },
      async allSites() {
        return [real];
      },
      async record() {},
    } as unknown as AnalyticsRepository;
    const collect = new CollectService(repo);
    const now = new Date('2026-09-26T10:00:00Z');
    const hit = (k: string) =>
      collect.accept(
        JSON.stringify({ k, v: 'visitor-0001', s: 'session-0001', t: 'pageview', u: 'http://x.local/' }),
        { origin: 'http://x.local' },
        now,
      );
    for (let i = 0; i < 1_000; i += 1) await hit(`pms_${i.toString(16).padStart(12, 'f')}`);
    expect(await hit(real.publicKey)).toBe('queued');
    await collect.onModuleDestroy();
  });
});

