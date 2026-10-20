import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { withSignedInUser } from '../auth/request-context';
import { BeautyCustomerDetailService, beautyCustomerDetailWhere } from './customer-detail';

const actor = {
  userId: 'user-test',
  organizationId: 'organization-test',
  role: 'OWNER' as const,
  scope: 'BUSINESS' as const,
  businessId: 'business-test',
  locationId: 'location-test',
  vertical: 'BEAUTY' as const,
};

describe('D1: карточка клиента изолирована организацией и бизнесом', () => {
  it('строит обязательный tenant scope для канонической карточки клиента', () => {
    expect(
      beautyCustomerDetailWhere('customer-current', 'organization-test', 'business-test'),
    ).toEqual({
      id: 'customer-current',
      organizationId: 'organization-test',
      businesses: { some: { businessId: 'business-test' } },
    });
  });

  it('не читает историю, если клиент не принадлежит текущему бизнесу', async () => {
    const db = {
      business: {
        findFirst: vi.fn().mockResolvedValue({ id: 'business-test', name: 'Тестовый салон' }),
      },
      location: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'location-test',
          name: 'Тестовый филиал',
          currency: 'KZT',
          timezone: 'Asia/Almaty',
        }),
      },
      customer: { findFirst: vi.fn().mockResolvedValue(null) },
      appointment: { findMany: vi.fn() },
    };
    const service = new BeautyCustomerDetailService({ db } as unknown as PrismaService);
    await expect(
      withSignedInUser(actor, () => service.detail('customer-current')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'customer-current',
          organizationId: 'organization-test',
          businesses: { some: { businessId: 'business-test' } },
        },
      }),
    );
    expect(db.appointment.findMany).not.toHaveBeenCalled();
  });
});
