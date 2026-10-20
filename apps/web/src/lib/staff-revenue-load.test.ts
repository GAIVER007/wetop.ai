import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';

// Сумма «Принёс» не ломает список персонала (beauty-ui на реальном API, 20.10.2026): любая ошибка = колонки нет
const getJsonPublic = vi.fn();
vi.mock('./api', () => ({ getJsonPublic: (...a: unknown[]) => getJsonPublic(...a) }));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined }));
vi.mock('../components/chip', () => ({ Chip: () => null, ChipGroup: () => null }));

import { loadStaffRevenue } from './staff-revenue-load';

describe('loadStaffRevenue', () => {
  it('свод приходит: отдаёт его как есть', async () => {
    getJsonPublic.mockResolvedValueOnce({ period: 'day', fromDate: '', toDate: '', items: [] });
    await expect(loadStaffRevenue('branch', 'day')).resolves.toMatchObject({ period: 'day' });
    expect(getJsonPublic).toHaveBeenLastCalledWith('/food-service/staff-revenue?period=day');
  });
  it.each([403, 400, 404, 500])('ошибка API %i: null, страница открыта', async (status) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getJsonPublic.mockRejectedValueOnce(new ApiError(status, 'нет'));
    await expect(loadStaffRevenue('hotel', 'week')).resolves.toBeNull();
  });
  it('нет связи: null', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getJsonPublic.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(loadStaffRevenue('branch', 'month')).resolves.toBeNull();
  });
});
