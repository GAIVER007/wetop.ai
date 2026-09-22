import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HotelService } from './hotel.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

const property = { id: 'test-property', name: 'Тестовый объект' };
function setup() {
  const findFirst = vi.fn().mockResolvedValue(property);
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const service = new HotelService({
    db: { property: { findFirst }, ratePlan: { findMany }, accommodationType: { count } },
  } as unknown as PrismaService);
  return { service, findFirst, findMany, count };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('одновременное чтение настроек', () => {
  it('пять холодных запросов делят одно чтение БД; после TTL получают новые настройки', async () => {
    const { service, findFirst, findMany } = setup();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.stubEnv('HOTEL_SETTINGS_TTL_MS', '60000');
    const values = await Promise.all(Array.from({ length: 5 }, () => service.settings()));
    expect(values).toEqual(Array(5).fill({ property, ratePlans: [], needsOnboarding: true }));
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    now.mockReturnValue(61001);
    findFirst.mockResolvedValue({ ...property, name: 'Обновлённый объект' });
    const refreshed = await Promise.all(Array.from({ length: 5 }, () => service.settings()));
    expect(refreshed[0]?.property.name).toBe('Обновлённый объект');
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('отказ не запоминается; следующая попытка снова читает БД', async () => {
    const { service, findFirst } = setup();
    findFirst.mockRejectedValue(new Error('Synthetic database unavailable'));
    const failed = await Promise.allSettled(Array.from({ length: 5 }, () => service.settings()));
    expect(failed.every((r) => r.status === 'rejected')).toBe(true);
    expect(findFirst).toHaveBeenCalledTimes(1);
    findFirst.mockResolvedValue(property);
    await expect(service.settings()).resolves.toEqual({
      property,
      ratePlans: [],
      needsOnboarding: true,
    });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  /**
   * Мультитенантность: кэш настроек — по организации. Иначе первый вошедший «прогревал» бы кэш, и
   * второй из ДРУГОЙ организации получил бы чужой объект. Разные организации — разные чтения и разбор
   * по своему `organizationId`; служебный ходок читает по имени.
   */
  it('кэш настроек не течёт между организациями', async () => {
    const { service, findFirst } = setup();
    findFirst.mockImplementation(async ({ where }: { where: { organizationId?: string } }) => ({
      id: `p-${where.organizationId ?? 'name'}`,
      name: where.organizationId === 'org-a' ? 'Отель А' : 'Отель Б',
    }));
    const a = await withSignedInUser({ userId: 'u-a', organizationId: 'org-a' }, () =>
      service.settings(),
    );
    const b = await withSignedInUser({ userId: 'u-b', organizationId: 'org-b' }, () =>
      service.settings(),
    );
    expect(a.property.name).toBe('Отель А');
    expect(b.property.name).toBe('Отель Б');
    expect(findFirst).toHaveBeenCalledTimes(2); // по одному чтению на организацию, кэши раздельны
    expect(findFirst.mock.calls[0]?.[0].where).toEqual({ organizationId: 'org-a' });
    expect(findFirst.mock.calls[1]?.[0].where).toEqual({ organizationId: 'org-b' });
  });
});
