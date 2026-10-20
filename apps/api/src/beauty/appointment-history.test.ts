import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { withSignedInUser } from '../auth/request-context';
import { BeautyAppointmentHistoryService } from './appointment-history';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  role: 'OWNER' as const,
  scope: 'LOCATION' as const,
  businessId: '33333333-3333-4333-8333-333333333333',
  locationId: '44444444-4444-4444-8444-444444444444',
  vertical: 'BEAUTY' as const,
};

describe('A10/M4: история одной записи', () => {
  it('возвращает только известные события, автора и сохранённые before/after', async () => {
    const db = {
      business: { findFirst: vi.fn().mockResolvedValue({ id: actor.businessId }) },
      location: {
        findFirst: vi.fn().mockResolvedValue({
          id: actor.locationId,
          name: 'Тестовый филиал',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        }),
      },
      appointment: {
        findFirst: vi.fn().mockResolvedValue({
          id: '55555555-5555-4555-8555-555555555555',
          currency: 'KZT',
        }),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '66666666-6666-4666-8666-666666666666',
            createdAt: new Date('2036-10-19T05:00:00.000Z'),
            action: 'beauty.appointment.status',
            userId: actor.userId,
            user: { id: actor.userId, name: 'Тестовый администратор' },
            before: { status: 'CONFIRMED', ignored: 'secret' },
            after: { status: 'DONE', ignored: 'secret' },
          },
        ]),
      },
      employee: { findMany: vi.fn().mockResolvedValue([]) },
      beautyService: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new BeautyAppointmentHistoryService({ db } as unknown as PrismaService);

    await expect(
      withSignedInUser(actor, () => service.history('55555555-5555-4555-8555-555555555555')),
    ).resolves.toEqual({
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      items: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          at: '2036-10-19T05:00:00.000Z',
          action: 'beauty.appointment.status',
          author: { id: actor.userId, name: 'Тестовый администратор' },
          before: { status: 'CONFIRMED' },
          after: { status: 'DONE' },
        },
      ],
      truncated: false,
    });
  });

  it('не читает аудит до подтверждения принадлежности записи текущему филиалу', async () => {
    const db = {
      business: { findFirst: vi.fn().mockResolvedValue({ id: actor.businessId }) },
      location: {
        findFirst: vi.fn().mockResolvedValue({
          id: actor.locationId,
          name: 'Тестовый филиал',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        }),
      },
      appointment: { findFirst: vi.fn().mockResolvedValue(null) },
      auditLog: { findMany: vi.fn() },
    };
    const service = new BeautyAppointmentHistoryService({ db } as unknown as PrismaService);

    await expect(
      withSignedInUser(actor, () => service.history('55555555-5555-4555-8555-555555555555')),
    ).rejects.toThrow('Запись не найдена');
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });
});

const appointmentId = '55555555-5555-4555-8555-555555555555';
const names = {
  employees: [{ id: 'master-a', name: 'Тест мастер А' }, { id: 'master-b', name: 'Тест мастер Б' }],
  services: [{ id: 'service-a', name: 'Тест услуга А' }, { id: 'service-b', name: 'Тест услуга Б' }],
};
function fixture(action: string, before: unknown, after: unknown) {
  const db = {
    business: { findFirst: vi.fn().mockResolvedValue({ id: actor.businessId }) },
    location: { findFirst: vi.fn().mockResolvedValue({ id: actor.locationId, timezone: 'Asia/Almaty', currency: 'KZT' }) },
    appointment: { findFirst: vi.fn().mockResolvedValue({ id: appointmentId, currency: 'KZT' }) },
    auditLog: { findMany: vi.fn().mockResolvedValue([{
      id: 'audit', createdAt: new Date('2036-10-19T05:00:00Z'), action, before, after, user: null,
    }]) },
    employee: { findMany: vi.fn().mockResolvedValue(names.employees) },
    beautyService: { findMany: vi.fn().mockResolvedValue(names.services) },
  };
  const service = new BeautyAppointmentHistoryService({ db } as unknown as PrismaService);
  return { db, read: () => withSignedInUser(actor, () => service.history(appointmentId)) };
}
const line = {
  position: 0, employeeId: 'master-a', serviceId: 'service-a', startsAt: '2036-10-19T05:00:00Z',
  endsAt: '2036-10-19T05:30:00Z', basePriceMinor: '1000', discountMinor: '100', surchargeMinor: '0',
  priceMinor: '900', discountPercent: null, currency: 'KZT',
};
const safeLine = (value: typeof line) => ({
  position: value.position, startsAt: value.startsAt, endsAt: value.endsAt,
  basePriceMinor: value.basePriceMinor, discountMinor: value.discountMinor, surchargeMinor: value.surchargeMinor,
  priceMinor: value.priceMinor, discountPercent: value.discountPercent, currency: value.currency,
  employee: names.employees.find((item) => item.id === value.employeeId),
  service: names.services.find((item) => item.id === value.serviceId),
});

describe('line provenance allowlist, independent from current totals and private audit fields', () => {
  it('retains moved before/after line changes despite equal visit totals and strips private fields', async () => {
    const second = { ...line, position: 1, serviceId: 'service-b', startsAt: line.endsAt, endsAt: '2036-10-19T06:00:00Z' };
    const changed = { ...second, employeeId: 'master-b', endsAt: '2036-10-19T06:15:00Z', discountMinor: '0', priceMinor: '1000' };
    const firstChanged = { ...line, discountMinor: '200', priceMinor: '800' };
    const privateFields = { notes: 'PRIVATE_NOTE', customerPhone: 'PRIVATE_PHONE', token: 'PRIVATE_TOKEN', ignored: 'PRIVATE_OTHER' };
    const top = { startsAt: line.startsAt, priceMinor: '1800', ...privateFields };
    const f = fixture('beauty.appointment.moved',
      { ...top, items: [line, second].map((item) => ({ ...item, ...privateFields })) },
      { ...top, items: [firstChanged, changed].map((item) => ({ ...item, ...privateFields })) });
    const result = await f.read();
    expect(result.items).toEqual([{
      id: 'audit', at: '2036-10-19T05:00:00.000Z', action: 'beauty.appointment.moved', author: null,
      before: { startsAt: line.startsAt, priceMinor: '1800', items: [safeLine(line), safeLine(second)] },
      after: { startsAt: line.startsAt, priceMinor: '1800', items: [safeLine(firstChanged), safeLine(changed)] },
    }]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_');
    expect(f.db.appointment.findFirst).toHaveBeenCalledWith({ where: { id: appointmentId, locationId: actor.locationId }, select: { id: true, currency: true } });
    expect(f.db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: actor.organizationId, entityType: 'appointment', entityId: appointmentId }), take: 101,
    }));
    for (const entity of [f.db.employee, f.db.beautyService]) {
      expect(entity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: actor.businessId }) }));
    }
  });
  it('preserves legacy created lines without inventing missing components and ignores created.before', async () => {
    const legacy = { position: 0, startsAt: line.startsAt, priceMinor: '900', employeeId: 'master-a', serviceId: 'service-a' };
    const result = await fixture('beauty.appointment.created', { items: [line] }, { items: [legacy] }).read();
    expect(result.items[0]?.before).toEqual({});
    expect(result.items[0]?.after).toEqual({ items: [{ position: 0, startsAt: line.startsAt, priceMinor: '900', employee: names.employees[0], service: names.services[0] }] });
    expect((await fixture('beauty.appointment.moved', { priceMinor: '900' }, { priceMinor: '900' }).read()).items[0]?.before).toEqual({ priceMinor: '900' });
  });
  it('does not leak unresolved entities or malformed optional component values', async () => {
    const malformed = { ...line, basePriceMinor: '-1', discountMinor: 'PRIVATE_TEXT', surchargeMinor: 20, discountPercent: 101, currency: 'PRIVATE_CURRENCY' };
    const result = await fixture('beauty.appointment.moved', {}, { items: [malformed, { ...line, employeeId: 'foreign-master' }, { ...line, serviceId: 'foreign-service' }] }).read();
    expect(result.items[0]?.after).toEqual({ items: [{
      position: 0, startsAt: line.startsAt, endsAt: line.endsAt, priceMinor: '900', employee: names.employees[0], service: names.services[0],
    }] });
  });
});
