import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { BeautyAppointmentsService } from './appointments';

vi.mock('./scope', async (original) => ({
  ...await original<typeof import('./scope')>(),
  mayBeauty: vi.fn(),
  beautyScope: vi.fn().mockResolvedValue({
    organizationId: 'org', businessId: 'business', locationId: 'salon', locationName: 'Тестовый салон',
    locationCurrency: 'KZT', locationTimezone: 'Asia/Almaty',
  }),
}));

type PeriodService = BeautyAppointmentsService & {
  period(from?: string, to?: string): Promise<{
    period: { from: string; to: string };
    appointments: Array<{ id: string; localDate: string; startMinutes: number; items: unknown[] }>;
  }>;
};

const row = {
  id: 'record', employeeId: 'master', serviceId: 'service',
  service: { name: 'Тестовая услуга' }, employee: { name: 'Мастер' },
  customer: { id: 'customer', firstName: 'Тест', lastName: null, phone: null },
  startsAt: new Date('2026-10-12T18:30:00Z'), endsAt: new Date('2026-10-12T19:30:00Z'),
  status: 'BOOKED', price: 100n, currency: 'KZT', notes: null, payments: [],
  lines: [{
    id: 'line', position: 0, employeeId: 'master', serviceId: 'service',
    employee: { name: 'Мастер' }, service: { name: 'Тестовая услуга' },
    startsAt: new Date('2026-10-12T18:30:00Z'), endsAt: new Date('2026-10-12T19:30:00Z'),
    basePriceMinor: 100n, discountMinor: 0n, surchargeMinor: 0n, priceMinor: 100n,
    currency: 'KZT', discountPercent: null,
  }],
};

function fixture() {
  const findMany = vi.fn().mockResolvedValue([row]);
  const employeeFindMany = vi.fn();
  const serviceFindMany = vi.fn();
  const db = {
    appointment: { findMany }, employee: { findMany: employeeFindMany },
    beautyService: { findMany: serviceFindMany }, employeeServicePrice: { findMany: vi.fn() },
  };
  const service = new BeautyAppointmentsService({ db } as unknown as PrismaService) as PeriodService;
  return { service, findMany, employeeFindMany, serviceFindMany };
}

describe('Beauty appointment period', () => {
  it('defaults an omitted period to today in the selected salon timezone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T20:30:00Z'));
    try {
      const { service } = fixture();
      expect((await service.period()).period).toEqual({from:'2026-10-13',to:'2026-10-13'});
    } finally { vi.useRealTimers(); }
  });
  it.each([
    [undefined, '2026-10-12'],
    ['2026-10-12', undefined],
    ['2026-02-30', '2026-03-01'],
    ['12.10.2026', '2026-10-12'],
    ['2026-10-13', '2026-10-12'],
    ['2026-01-01', '2027-01-02'],
  ])('отклоняет неверный период %s..%s', async (from, to) => {
    const { service } = fixture();
    await expect(service.period(from, to)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('читает до 366 дней одним запросом и не загружает календарные справочники', async () => {
    const { service, findMany, employeeFindMany, serviceFindMany } = fixture();
    const result = await service.period('2026-01-01', '2027-01-01');
    expect(result.period).toEqual({ from: '2026-01-01', to: '2027-01-01' });
    expect(result.appointments[0]).toMatchObject({
      id: 'record', localDate: '2026-10-12', startMinutes: 1410,
    });
    expect(result.appointments[0]!.items).toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        locationId: 'salon',
        lines: { some: {
          startsAt: { lt: new Date('2027-01-01T19:00:00Z') },
          endsAt: { gt: new Date('2025-12-31T19:00:00Z') },
        } },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    }));
    expect(employeeFindMany).not.toHaveBeenCalled();
    expect(serviceFindMany).not.toHaveBeenCalled();
  });
});

describe('C2 (паритет с zapis.kz): автор и источник в проекции записи', () => {
  it('отдаёт source и имя автора, когда они есть в строке', async () => {
    const { service, findMany } = fixture();
    findMany.mockResolvedValue([{
      ...row,
      source: 'WEBSITE',
      createdBy: { name: 'Тест Админ', email: 'admin@example.invalid' },
    }]);
    const result = await service.period('2026-10-12', '2026-10-12');
    expect(result.appointments[0]).toMatchObject({ source: 'WEBSITE', createdByName: 'Тест Админ' });
  });
  it('у старой записи без автора поля отдаются пустыми, а не падают', async () => {
    const { service, findMany } = fixture();
    findMany.mockResolvedValue([{ ...row, source: 'DESK', createdBy: null }]);
    const result = await service.period('2026-10-12', '2026-10-12');
    expect(result.appointments[0]).toMatchObject({ source: 'DESK', createdByName: null });
  });
});

describe('A4 (паритет с zapis.kz): платежи записи в проекции', () => {
  it('отдаёт список платежей с видом, способом, суммой и временем', async () => {
    const { service, findMany } = fixture();
    findMany.mockResolvedValue([{
      ...row,
      payments: [
        { id: 'op-1', kind: 'INCOME', method: 'CASH', amount: 5000n, occurredAt: new Date('2026-10-12T12:40:00Z') },
        { id: 'op-2', kind: 'EXPENSE', method: 'CASH', amount: 1000n, occurredAt: new Date('2026-10-12T13:00:00Z') },
      ],
    }]);
    const result = await service.period('2026-10-12', '2026-10-12');
    expect((result.appointments[0] as { payments: unknown[] }).payments).toEqual([
      { id: 'op-1', kind: 'INCOME', method: 'CASH', amountMinor: '5000', at: '2026-10-12T12:40:00.000Z' },
      { id: 'op-2', kind: 'EXPENSE', method: 'CASH', amountMinor: '1000', at: '2026-10-12T13:00:00.000Z' },
    ]);
  });
});
