import { describe, expect, it } from 'vitest';
import {
  SELLER_FACTS_DAYS,
  SELLER_FACTS_DOCUMENT,
  buildSellerFacts,
  sellerCategoryPrices,
  sellerFactsHash,
  sellerFactsWindow,
  type SellerFactsSource,
} from './facts';

/**
 * Факты объекта для ИИ-продавца (ТЗ ред. 1 П8, Б7; ADR-080): адрес, заезд и выезд, категории и цены по тарифу сайта —
 * из платформы, а не перепечаткой. Тело — ровно модель бота `ObjectFacts` (`src/knowledge/facts.py`, `extra='forbid'`):
 * одна цена за ночь на категорию, целыми тиынами (ADR-008). Цена уходит, только если за 60 дней она не меняется, —
 * иначе бот говорит «уточнит администратор»: названная им цена становится обещанием гостю (Q-179).
 */

const days = (from: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

const source = (over: Partial<SellerFactsSource> = {}): SellerFactsSource => ({
  property: {
    name: 'Тестовый хостел',
    address: 'Алматы, ул. Вымышленная, 1',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  },
  categories: [
    { code: 'DORM', name: 'Место в общем номере', kind: 'DORM_BED', capacityAdults: 1, units: 18 },
    { code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 4 },
    { code: 'APT', name: 'Апартаменты', kind: 'APARTMENT', capacityAdults: 4, units: 1 },
  ],
  ratePlan: { code: 'BASE', name: 'Базовый тариф', currency: 'KZT' },
  rates: [
    // «Двухместная»: цена на 1 и на 2 гостей, на двоих — одна и та же весь срок
    ...days('2026-09-24', 60).flatMap((date) => [
      { categoryCode: 'DBL', date, occupancy: 1, priceMinor: 1_250_000n },
      { categoryCode: 'DBL', date, occupancy: 2, priceMinor: 1_500_000n },
    ]),
    // место в общем: в выходные дороже — цена меняется
    { categoryCode: 'DORM', date: '2026-09-24', occupancy: 1, priceMinor: 450_000n },
    { categoryCode: 'DORM', date: '2026-09-26', occupancy: 1, priceMinor: 520_000n },
  ],
  window: { from: '2026-09-24', to: '2026-11-22' },
  ...over,
});

describe('sellerFactsWindow — окно цен от сегодняшнего дня объекта', () => {
  it(`${SELLER_FACTS_DAYS} дней, день — по поясу объекта`, () => {
    expect(SELLER_FACTS_DAYS).toBe(60);
    // 20:30 UTC 24.09 — уже 25.09 в Алматы
    expect(sellerFactsWindow(new Date('2026-09-24T20:30:00Z'), 'Asia/Almaty')).toEqual({
      from: '2026-09-25',
      to: '2026-11-23',
    });
  });
});

describe('sellerCategoryPrices — какая цена уходит продавцу (ADR-080, Q-179)', () => {
  it('одинаковая весь срок — уходит; на наибольшее число гостей с ценой: у «Двухместной» — за двоих', () => {
    // по коду: APT, DBL, DORM — порядок выборки на тело не влияет
    const [apt, dbl, dorm] = sellerCategoryPrices(source());
    expect(dbl).toMatchObject({
      code: 'DBL',
      occupancy: 2,
      priceMinor: '1500000',
      reason: 'same',
      min: '1500000',
      max: '1500000',
      days: 60,
    });
    expect(dorm).toMatchObject({
      code: 'DORM',
      occupancy: 1,
      priceMinor: null,
      reason: 'varies',
      min: '450000',
      max: '520000',
      days: 2,
    });
    expect(apt).toMatchObject({ code: 'APT', priceMinor: null, reason: 'none', days: 0 });
  });

  it('цена от числа гостей не зависит (одна строка на дату) — берётся она, а не «нет цены на полную вместимость»', () => {
    const [apt] = sellerCategoryPrices(
      source({
        rates: days('2026-09-24', 3).map((date) => ({
          categoryCode: 'APT',
          date,
          occupancy: 1,
          priceMinor: 3_000_000n,
        })),
      }),
    );
    expect(apt).toMatchObject({ occupancy: 1, priceMinor: '3000000', reason: 'same' });
  });

  it('тариф сайта не выбран — цен нет ни у одной категории', () => {
    const prices = sellerCategoryPrices(source({ ratePlan: null }));
    expect(prices.map((p) => p.reason)).toEqual(['none', 'none', 'none']);
    expect(prices.every((p) => p.priceMinor === null)).toBe(true);
  });
});

describe('buildSellerFacts — тело PUT /seller/facts по модели бота ObjectFacts (Б7)', () => {
  it('ровно поля бота: объект, адрес, пояс, заезд и выезд, валюта, категории с одной ценой', () => {
    expect(buildSellerFacts(source())).toEqual({
      object_name: 'Тестовый хостел',
      address: 'Алматы, ул. Вымышленная, 1',
      timezone: 'Asia/Almaty',
      check_in: '14:00',
      check_out: '12:00',
      currency: 'KZT',
      categories: [
        { name: 'Апартаменты', kind: 'room', capacity: 4, price_minor: null },
        { name: 'Двухместная', kind: 'room', capacity: 2, price_minor: 1_500_000 },
        { name: 'Место в общем номере', kind: 'bed', capacity: 1, price_minor: null },
      ],
    });
  });

  it('деньги — целым числом тиынов (ADR-008), не строкой и не float', () => {
    const dbl = buildSellerFacts(source()).categories.find((c) => c.name === 'Двухместная')!;
    expect(Number.isInteger(dbl.price_minor)).toBe(true);
  });

  it('валюта — тарифа сайта: цены в его единицах', () => {
    const body = buildSellerFacts(
      source({ ratePlan: { code: 'OTA-USD', name: 'ОТА в USD', currency: 'USD' } }),
    );
    expect(body.currency).toBe('USD');
    expect(buildSellerFacts(source({ ratePlan: null })).currency).toBe('KZT');
  });

  it('адреса нет — пустая строка, а не null: у бота поле строкой; длиннее 300 знаков — не шлётся, а не режется', () => {
    const noAddress = source();
    noAddress.property.address = null;
    expect(buildSellerFacts(noAddress).address).toBe('');
    const long = source();
    long.property.address = 'Алматы, '.repeat(50);
    expect(buildSellerFacts(long).address).toBe('');
  });

  it('заезд и выезд — ЧЧ:ММ, как требует бот, даже если в карточке с секундами', () => {
    const s = source();
    s.property.checkInTime = '14:00:00';
    s.property.checkOutTime = '9:30';
    const body = buildSellerFacts(s);
    expect(body.check_in).toBe('14:00');
    expect(body.check_out).toBe('09:30');
  });

  it('наличия мест и числа мест в фактах нет: продавец остаток не называет (часть 3 ТЗ)', () => {
    const text = JSON.stringify(buildSellerFacts(source()));
    expect(text).not.toContain('units');
    expect(text).not.toContain('18');
  });

  it('категории — по коду: порядок выборки из базы на тело не влияет', () => {
    const s = source();
    const reversed = { ...s, categories: [...s.categories].reverse(), rates: [...s.rates].reverse() };
    expect(buildSellerFacts(reversed)).toEqual(buildSellerFacts(s));
  });
});

describe('sellerFactsHash — отпечаток фактов', () => {
  it('те же данные — тот же отпечаток; другая цена — другой', () => {
    const a = sellerFactsHash(buildSellerFacts(source()));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(sellerFactsHash(buildSellerFacts(source()))).toBe(a);
    const cheaper = source({
      rates: days('2026-09-24', 60).map((date) => ({
        categoryCode: 'DBL',
        date,
        occupancy: 2,
        priceMinor: 1_400_000n,
      })),
    });
    expect(sellerFactsHash(buildSellerFacts(cheaper))).not.toBe(a);
  });

  it('документ фактов у бота называется platform:facts.md — по нему стойка узнаёт его в «Знаниях»', () => {
    expect(SELLER_FACTS_DOCUMENT).toBe('platform:facts.md');
  });
});
