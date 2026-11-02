import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseNbkRates } from '@pms/domain';
import { ExchangeRatesService } from './exchange-rates';
import type { PrismaService } from '../database/prisma.provider';

/**
 * Загрузка курсов Нацбанка РК (владелец 01.11.2026, миграция 180): сохранённый настоящий ответ за 31.10.2026 и
 * загрузчик на подставной базе. Сеть в тесте не используется.
 */
const real = readFileSync(new URL('./__fixtures__/nbk-2026-10-31.xml', import.meta.url), 'utf8');

describe('ответ Нацбанка РК', () => {
  it('настоящий ответ за 31.10.2026: доллар 453,87, дирхам 123,59, риал Катара 124,52', () => {
    const r = parseNbkRates(real);
    expect(r.date).toBe('2026-10-31');
    const by = new Map(r.rates.map((x) => [x.currency, x.kztPerUnitMicro]));
    expect(by.get('USD')).toBe(453_870_000n);
    expect(by.get('AED')).toBe(123_590_000n);
    expect(by.get('QAR')).toBe(124_520_000n);
    expect(r.rates.length).toBeGreaterThan(20);
  });
});

describe('загрузчик курсов', () => {
  const fakeDb = (have: string[]) => {
    const written: Array<{ rateDate: Date; currency: string; kztPerUnitMicro: bigint }> = [];
    const db = {
      $queryRaw: async () => have.map((d) => ({ d: new Date(`${d}T00:00:00Z`) })),
      exchangeRate: {
        createMany: async ({ data }: { data: typeof written }) => {
          written.push(...data);
          return { count: data.length };
        },
      },
    };
    return { prisma: { db } as unknown as PrismaService, written };
  };
  it('догружает только недостающие дни, начиная с сегодня; чужая дата в ответе не пишется', async () => {
    const asked: string[] = [];
    const { prisma, written } = fakeDb(['2026-10-30']);
    const svc = new ExchangeRatesService(prisma, async (day) => {
      asked.push(day);
      if (day === '2026-10-31') return real;
      if (day === '2026-10-29') return real; // Нацбанк вернул не тот день: пропуск
      throw new Error('сеть');
    });
    const r = await svc.sync(new Date('2026-10-31T10:00:00Z'));
    expect(asked[0]).toBe('2026-10-31');
    expect(asked).not.toContain('2026-10-30');
    expect(asked.length).toBe(40);
    expect(r.days).toBe(1);
    expect(r.failed).toBe(39);
    expect(new Set(written.map((w) => w.rateDate.toISOString().slice(0, 10)))).toEqual(new Set(['2026-10-31']));
    expect(written.find((w) => w.currency === 'USD')!.kztPerUnitMicro).toBe(453_870_000n);
    expect(written.some((w) => w.currency === 'KZT')).toBe(false);
  });
});
