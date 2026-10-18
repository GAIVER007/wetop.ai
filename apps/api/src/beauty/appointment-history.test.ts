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
