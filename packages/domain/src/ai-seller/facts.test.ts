import { describe, expect, it } from 'vitest';
import {
  SELLER_FACTS_DAYS,
  buildSellerFacts,
  priceText,
  sellerFactsHash,
  sellerFactsWindow,
  type SellerFactsSource,
} from './facts';

/**
 * Факты объекта для ИИ-продавца (ТЗ ред. 1 П8, Б7; docs/assistant/README.md §4): адрес, заезд и выезд, категории
 * и цены по тарифу сайта — из платформы, а не перепечаткой. Цена — целые тиыны строкой и готовая сумма: продавец
 * деньги не считает.
 */

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
  ],
  ratePlan: { code: 'BASE', name: 'Базовый тариф' },
  rates: [
    { categoryCode: 'DBL', date: '2026-09-25', occupancy: 2, priceMinor: 1_500_000n },
    { categoryCode: 'DBL', date: '2026-09-25', occupancy: 1, priceMinor: 1_250_050n },
    { categoryCode: 'DORM', date: '2026-09-24', occupancy: 1, priceMinor: 450_000n },
  ],
  window: { from: '2026-09-24', to: '2026-11-22' },
  ...over,
});

describe('priceText — сумма словами для продавца (DESIGN.md §14)', () => {
  it('целая — без тиынов, с разрядами и знаком тенге', () => {
    expect(priceText(1_500_000n, 'KZT')).toBe('15 000 ₸');
  });
  it('с тиынами — через запятую', () => {
    expect(priceText(1_250_050n, 'KZT')).toBe('12 500,50 ₸');
  });
  it('другая валюта — её кодом', () => {
    expect(priceText(9_900n, 'USD')).toBe('99 USD');
  });
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

describe('buildSellerFacts — документ для PUT /seller/facts', () => {
  it('snake_case, источник platform:facts, цены по коду категории, дате и числу гостей', () => {
    const facts = buildSellerFacts(source(), new Date('2026-09-24T09:00:00Z'));
    expect(facts).toEqual({
      source: 'platform:facts',
      generated_at: '2026-09-24T09:00:00.000Z',
      property: {
        name: 'Тестовый хостел',
        address: 'Алматы, ул. Вымышленная, 1',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        check_in_time: '14:00',
        check_out_time: '12:00',
      },
      categories: [
        { code: 'DORM', name: 'Место в общем номере', kind: 'DORM_BED', capacity_adults: 1, units: 18 },
        { code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacity_adults: 2, units: 4 },
      ],
      rate_plan: { code: 'BASE', name: 'Базовый тариф' },
      window: { from: '2026-09-24', to: '2026-11-22' },
      prices: [
        { category_code: 'DBL', date: '2026-09-25', guests: 1, price_minor: '1250050', price_text: '12 500,50 ₸' },
        { category_code: 'DBL', date: '2026-09-25', guests: 2, price_minor: '1500000', price_text: '15 000 ₸' },
        { category_code: 'DORM', date: '2026-09-24', guests: 1, price_minor: '450000', price_text: '4 500 ₸' },
      ],
    });
  });

  it('тарифа сайта нет — цен нет, а не цены чужого тарифа', () => {
    const facts = buildSellerFacts(source({ ratePlan: null }), new Date());
    expect(facts.rate_plan).toBeNull();
    expect(facts.prices).toEqual([]);
  });

  it('адреса нет — null, а не пустая строка', () => {
    const facts = buildSellerFacts(
      source({ property: { ...source().property, address: '  ' } }),
      new Date(),
    );
    expect(facts.property.address).toBeNull();
  });
});

describe('sellerFactsHash — отпечаток фактов для сверки раз в минуту', () => {
  it('время сборки в отпечаток не входит', () => {
    const a = buildSellerFacts(source(), new Date('2026-09-24T09:00:00Z'));
    const b = buildSellerFacts(source(), new Date('2026-09-24T09:05:00Z'));
    expect(sellerFactsHash(a)).toBe(sellerFactsHash(b));
    expect(sellerFactsHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('порядок строк на входе не важен', () => {
    const a = buildSellerFacts(source(), new Date());
    const b = buildSellerFacts(source({ rates: [...source().rates].reverse() }), new Date());
    expect(sellerFactsHash(a)).toBe(sellerFactsHash(b));
  });

  it('другая цена, время заезда или категория — другой отпечаток', () => {
    const base = sellerFactsHash(buildSellerFacts(source(), new Date()));
    const price = source();
    price.rates[0] = { ...price.rates[0]!, priceMinor: 1_600_000n };
    expect(sellerFactsHash(buildSellerFacts(price, new Date()))).not.toBe(base);
    const checkIn = source({ property: { ...source().property, checkInTime: '15:00' } });
    expect(sellerFactsHash(buildSellerFacts(checkIn, new Date()))).not.toBe(base);
    const cats = source({ categories: source().categories.slice(0, 1) });
    expect(sellerFactsHash(buildSellerFacts(cats, new Date()))).not.toBe(base);
  });
});
