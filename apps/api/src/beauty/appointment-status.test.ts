import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BeautyAppointmentsController, BeautyAppointmentsService } from './appointments';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

const id = '00000000-0000-4000-8000-000000000001';
const startsAt = new Date('2026-10-18T13:00:00Z');
const actor = {
  userId: 'user', organizationId: 'org', role: 'OWNER' as const,
  scope: 'LOCATION' as const, businessId: 'business', locationId: 'location', vertical: 'BEAUTY' as const,
};

function fixture(status = 'BOOKED') {
  const row = { id, employeeId: 'employee', serviceId: 'service', startsAt,
    endsAt: new Date('2026-10-18T14:00:00Z'), status, updatedAt: new Date('2026-10-17T00:00:00Z'),
    price: 100000n, currency: 'KZT', notes: null, service: { name: 'Тестовая услуга' },
    customer: { id: 'customer', firstName: 'Тестовый клиент', lastName: null, phone: null }, payments: [], lines: [] };
  const db = {
    organization: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null }) },
    business: { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) },
    location: { findFirst: vi.fn().mockResolvedValue({ id: 'location', name: 'Тестовый салон', currency: 'KZT', timezone: 'Asia/Almaty' }) },
    employee: { findMany: vi.fn().mockResolvedValue([]) },
    beautyService: { findMany: vi.fn().mockResolvedValue([]) },
    employeeServicePrice: { findMany: vi.fn().mockResolvedValue([]) },
    beautyLocationHours: { findUnique: vi.fn().mockResolvedValue(null) },
    appointment: { findFirst: vi.fn().mockResolvedValue(row), findMany: vi.fn().mockResolvedValue([row]), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      // пересчёт напоминаний (решение 21.10.2026): запись не найдена, очередь не трогается
      findUnique: vi.fn().mockResolvedValue(null) },
    restaurantCashOperation: { groupBy: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  const service = new BeautyAppointmentsService({ db } as unknown as PrismaService);
  return { db, row, service, run: <T>(fn: () => Promise<T>) => withSignedInUser(actor, fn) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(startsAt.getTime() - 1));
});
afterEach(() => vi.useRealTimers());

describe('Неявка только после наступления начала визита', () => {
  for (const status of ['BOOKED', 'CONFIRMED']) {
    it(`${status}: отказывает за миллисекунду до начала без изменения записи и истории`, async () => {
      const f = fixture(status);
      await expect(f.run(() => f.service.setStatus(id, { status: 'NO_SHOW' }))).rejects.toThrow('Можно после начала визита');
      expect(f.db.appointment.updateMany).not.toHaveBeenCalled();
      expect(f.db.auditLog.create).not.toHaveBeenCalled();
    });
    for (const offset of [0, 1]) {
      it(`${status}: разрешает на границе начала +${offset} мс и пишет один audit`, async () => {
        vi.setSystemTime(new Date(startsAt.getTime() + offset));
        const f = fixture(status);
        vi.spyOn(f.service, 'day').mockResolvedValue({} as Awaited<ReturnType<typeof f.service.day>>);
        await f.run(() => f.service.setStatus(id, { status: 'NO_SHOW' }));
        expect(f.db.appointment.updateMany).toHaveBeenCalledWith({
          where: { id, status, updatedAt: f.row.updatedAt }, data: { status: 'NO_SHOW' },
        });
        expect(f.db.auditLog.create).toHaveBeenCalledTimes(1);
        expect(f.db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
          userId: 'user', before: { status }, after: { status: 'NO_SHOW' },
        }) }));
      });
    }
  }

  it('не предлагает неявку в журнале будущего визита в поясе салона', async () => {
    const f = fixture();
    const result = await f.run(() => f.service.day('2026-10-18'));
    expect(result.appointments[0]!.next).not.toContain('NO_SHOW');
    expect(result.appointments[0]!.next).toContain('CONFIRMED');
  });

  it('предлагает неявку после наступления начала', async () => {
    vi.setSystemTime(startsAt);
    const f = fixture();
    const result = await f.run(() => f.service.day('2026-10-18'));
    expect(result.appointments[0]!.next).toContain('NO_SHOW');
  });

  it('сохраняет конфликт при конкурентном изменении и не пишет ложный audit', async () => {
    vi.setSystemTime(startsAt);
    const f = fixture();
    f.db.appointment.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.run(() => f.service.setStatus(id, { status: 'NO_SHOW' }))).rejects.toThrow('Запись уже изменена');
    expect(f.db.auditLog.create).not.toHaveBeenCalled();
  });

  it('не раскрывает чужую запись и не изменяет её', async () => {
    const f = fixture();
    f.db.appointment.findFirst.mockResolvedValue(null);
    await expect(f.run(() => f.service.setStatus(id, { status: 'NO_SHOW' }))).rejects.toThrow('Запись не найдена');
    expect(f.db.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id, locationId: 'location' } }));
    expect(f.db.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('не обходит режим только чтение организации', async () => {
    const f = fixture();
    f.db.organization.findUnique.mockResolvedValue({ status: 'SUSPENDED', trialEndsAt: null });
    await expect(f.run(() => f.service.setStatus(id, { status: 'NO_SHOW' }))).rejects.toThrow();
    expect(f.db.appointment.findFirst).not.toHaveBeenCalled();
    expect(f.db.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('отказывает пользователю без роли до чтения визита', async () => {
    const f = fixture();
    await expect(withSignedInUser({ ...actor, role: null }, () =>
      f.service.setStatus(id, { status: 'NO_SHOW' }),
    )).rejects.toThrow();
    expect(f.db.appointment.findFirst).not.toHaveBeenCalled();
    expect(f.db.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('отвечает HTTP 409 на прямую попытку преждевременной неявки', async () => {
    const f = fixture();
    const module = await Test.createTestingModule({
      controllers: [BeautyAppointmentsController],
      providers: [{ provide: BeautyAppointmentsService, useValue: f.service }],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    app.use((_req: unknown, _res: unknown, next: () => void) => withSignedInUser(actor, async () => next()));
    try {
      await app.listen(0, '127.0.0.1');
      const result = await request(app.getHttpServer()).post(`/beauty/appointments/${id}/status`)
        .send({ status: 'NO_SHOW' }).expect(409);
      expect(result.body.message).toBe('Можно после начала визита');
      expect(f.db.appointment.updateMany).not.toHaveBeenCalled();
      expect(f.db.auditLog.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
