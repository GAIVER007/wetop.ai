import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { HotelService } from './hotel.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

/**
 * «Первые шаги» на Главной (ТЗ `plans/ux-retention-2026-09-26.md` п. 2.1): панель держится, пока в объекте нет ни
 * одной брони. Ответ читается без кэша — иначе после первой брони панель висела бы ещё минуту — и только по объекту
 * организации вошедшего: чужие брони не делают чужую панель «готовой».
 */
function setup(reservation: { id: string } | null) {
  const property = vi.fn().mockResolvedValue({ id: 'org-a-property', name: 'Хостел А' });
  const reservationFirst = vi.fn().mockResolvedValue(reservation);
  const service = new HotelService({
    db: { property: { findFirst: property }, reservation: { findFirst: reservationFirst } },
  } as unknown as PrismaService);
  return { service, property, reservationFirst };
}

const asOwner = <T>(fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'user-a', organizationId: 'org-a' }, fn);

describe('первые шаги', () => {
  it('броней нет — панель нужна; бронь есть — нет', async () => {
    expect(await asOwner(() => setup(null).service.firstSteps())).toEqual({ hasReservations: false });
    expect(await asOwner(() => setup({ id: 'r1' }).service.firstSteps())).toEqual({
      hasReservations: true,
    });
  });

  it('ищет бронь только в объекте своей организации и не кэширует ответ', async () => {
    const { service, property, reservationFirst } = setup(null);
    await asOwner(() => service.firstSteps());
    reservationFirst.mockResolvedValue({ id: 'r1' });
    expect(await asOwner(() => service.firstSteps())).toEqual({ hasReservations: true });
    expect(property).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-a' } }),
    );
    expect(reservationFirst).toHaveBeenCalledTimes(2);
    expect(reservationFirst).toHaveBeenLastCalledWith({
      where: { propertyId: 'org-a-property' },
      select: { id: true },
    });
  });
});
