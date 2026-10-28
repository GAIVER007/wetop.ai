import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { BeautyAppointmentsService } from './appointments';

vi.mock('./scope', async (original) => ({
  ...(await original<typeof import('./scope')>()),
  mayBeauty: vi.fn(),
  beautyScope: vi.fn().mockResolvedValue({
    organizationId: 'org',
    businessId: 'business',
    locationId: 'salon',
    locationName: 'Тестовый салон',
    locationCurrency: 'KZT',
    locationTimezone: 'Asia/Almaty',
  }),
}));

/** Сводка пульта «Аналитики» (вариант A, 25.10.2026): оценки, новые и повторные клиенты, «давно не были» */
type InsightsService = BeautyAppointmentsService & {
  insights(
    from?: string,
    to?: string,
  ): Promise<{
    period: { from: string; to: string };
    reviews: { count: number; avgTenths: number | null };
    customers: { total: number; new: number; repeat: number; lapsed: number };
    employees: Array<{
      employeeId: string;
      customers: number;
      returning: number;
      returnedToMaster: number;
      ltvMinor: string;
      reviews: number;
      avgTenths: number | null;
    }>;
  }>;
};

const at = (iso: string) => new Date(iso);
function fixture() {
  const reviews = vi.fn().mockResolvedValue([
    { employeeId: 'm1', stars: 5 },
    { employeeId: 'm1', stars: 4 },
    { employeeId: 'm2', stars: 5 },
  ]);
  const periodRows = [
    { customerId: 'c-old', employeeId: 'm1', lines: [{ employeeId: 'm1' }] },
    { customerId: 'c-new', employeeId: 'm1', lines: [{ employeeId: 'm1' }, { employeeId: 'm2' }] },
    { customerId: 'c-new', employeeId: 'm2', lines: [] },
  ];
  // первый запрос: визиты периода (`gte`), второй: история мастеров до конца периода (здесь пустая)
  const done = vi.fn(async (args: { where: { startsAt: { gte?: Date } } }) => (args.where.startsAt.gte ? periodRows : []));
  const groupBy = vi.fn().mockResolvedValue([
    {
      customerId: 'c-old',
      _min: { startsAt: at('2026-06-01T05:00:00Z') },
      _max: { startsAt: at('2026-10-20T05:00:00Z') },
    },
    {
      customerId: 'c-new',
      _min: { startsAt: at('2026-10-21T05:00:00Z') },
      _max: { startsAt: at('2026-10-22T05:00:00Z') },
    },
    // последний визит 60 дней до конца периода: «давно не были»
    {
      customerId: 'c-gone',
      _min: { startsAt: at('2026-05-01T05:00:00Z') },
      _max: { startsAt: at('2026-08-26T05:00:00Z') },
    },
    // 300 дней назад: уже не считаем, слишком давно
    {
      customerId: 'c-lost',
      _min: { startsAt: at('2025-12-01T05:00:00Z') },
      _max: { startsAt: at('2025-12-29T05:00:00Z') },
    },
  ]);
  const db = {
    beautyAppointmentReview: { findMany: reviews },
    appointment: { findMany: done, groupBy },
  };
  const service = new BeautyAppointmentsService({
    db,
  } as unknown as PrismaService) as InsightsService;
  return { service, reviews, done, groupBy };
}

describe('сводка пульта салона', () => {
  it('оценки периода по мастерам в десятых долях, только отзывы визитов этого филиала', async () => {
    const { service, reviews } = fixture();
    const r = await service.insights('2026-10-19', '2026-10-25');
    expect(r.reviews).toEqual({ count: 3, avgTenths: 47 });
    expect(r.employees.find((e) => e.employeeId === 'm1')).toMatchObject({
      reviews: 2,
      avgTenths: 45,
    });
    expect(reviews.mock.calls[0]![0].where.appointment).toEqual({ locationId: 'salon' });
  });
  it('новые и повторные клиенты по первому завершённому визиту в филиале', async () => {
    const { service } = fixture();
    const r = await service.insights('2026-10-19', '2026-10-25');
    expect(r.customers).toMatchObject({ total: 2, new: 1, repeat: 1 });
  });
  it('вернувшиеся по мастеру: строки многоуслужной записи делят визит между мастерами', async () => {
    const { service } = fixture();
    const r = await service.insights('2026-10-19', '2026-10-25');
    expect(r.employees.find((e) => e.employeeId === 'm1')).toMatchObject({
      customers: 2,
      returning: 1,
    });
    expect(r.employees.find((e) => e.employeeId === 'm2')).toMatchObject({
      customers: 1,
      returning: 0,
    });
  });
  it('«давно не были»: последний визит от 46 до 180 дней до конца периода', async () => {
    const { service } = fixture();
    expect((await service.insights('2026-10-19', '2026-10-25')).customers.lapsed).toBe(1);
  });
  it('ответ без имён и телефонов клиентов', async () => {
    const { service } = fixture();
    const text = JSON.stringify(await service.insights('2026-10-19', '2026-10-25'));
    expect(text).not.toMatch(/c-old|c-new|c-gone|phone|name/);
  });
  it('пустой филиал: нули и null вместо деления на ноль', async () => {
    const { service, reviews, done, groupBy } = fixture();
    reviews.mockResolvedValue([]);
    done.mockImplementation(async () => []);
    groupBy.mockResolvedValue([]);
    expect(await service.insights('2026-10-25', '2026-10-25')).toMatchObject({
      reviews: { count: 0, avgTenths: null },
      customers: { total: 0, new: 0, repeat: 0, lapsed: 0 },
      employees: [],
    });
  });
});

/**
 * «Вернулись» и LTV мастера (владелец 26.10.2026: «Вернулись (LTV тут считаем четко)»): клиент вернулся к мастеру, если
 * до начала периода у него уже был завершённый визит именно у этого мастера. LTV: сколько в среднем принёс мастеру
 * один его клиент периода за всё время по завершённым визитам до конца периода (строки записи по своей цене).
 */
describe('вернулись к мастеру и LTV', () => {
  it('считает по истории строк мастера, а не по салону', async () => {
    const { service, done } = fixture();
    const inPeriod = [
      { customerId: 'c-old', employeeId: 'm1', lines: [{ employeeId: 'm1' }] },
      { customerId: 'c-new', employeeId: 'm1', lines: [{ employeeId: 'm1' }, { employeeId: 'm2' }] },
      { customerId: 'c-new', employeeId: 'm2', lines: [] },
    ];
    const history = [
      // c-old: раньше был у m1 (вернулся к m1), сейчас снова у m1
      { customerId: 'c-old', employeeId: 'm1', price: 0n, startsAt: at('2026-06-01T05:00:00Z'), lines: [{ employeeId: 'm1', priceMinor: 500000n }] },
      { customerId: 'c-old', employeeId: 'm1', price: 0n, startsAt: at('2026-10-20T05:00:00Z'), lines: [{ employeeId: 'm1', priceMinor: 300000n }] },
      // c-new: впервые, у m1 и m2 одной записью
      { customerId: 'c-new', employeeId: 'm1', price: 0n, startsAt: at('2026-10-21T05:00:00Z'), lines: [{ employeeId: 'm1', priceMinor: 100000n }, { employeeId: 'm2', priceMinor: 200000n }] },
      // старая запись без строк: цена записи целиком мастеру записи
      { customerId: 'c-new', employeeId: 'm2', price: 400000n, startsAt: at('2026-10-22T05:00:00Z'), lines: [] },
    ];
    done.mockImplementation(async (args: { where: { startsAt: { gte?: Date } } }) => (args.where.startsAt.gte ? inPeriod : history));
    const r = await service.insights('2026-10-19', '2026-10-25');
    const m1 = r.employees.find((e) => e.employeeId === 'm1')!;
    const m2 = r.employees.find((e) => e.employeeId === 'm2')!;
    expect(m1).toMatchObject({ customers: 2, returnedToMaster: 1, ltvMinor: '450000' });
    expect(m2).toMatchObject({ customers: 1, returnedToMaster: 0, ltvMinor: '600000' });
  });
});
