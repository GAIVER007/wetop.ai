import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';
import { barApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { hotelApi } from '../../lib/hotel-api';
import { loadBarContext } from './load-context';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T,>(fn: T) => fn,
}));
vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn(),
}));
vi.mock('../../lib/hotel-api', () => ({ hotelApi: { settings: vi.fn() } }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: vi.fn() }));
vi.mock('../../lib/api', async () => ({
  ApiError: (await import('../../lib/api-error')).ApiError,
  barApi: { report: vi.fn() },
}));

describe('контекст денежных форм бара (D-CUR, ADR-178)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('у гостиницы объект и валюта берутся из её настроек', async () => {
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-1', currency: 'USD' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
    await expect(loadBarContext()).resolves.toEqual({ propertyId: 'property-1', currency: 'USD' });
    expect(barApi.report).not.toHaveBeenCalled();
  });

  it('у салона нет гостиничного объекта: объект формы это филиал, валюта из отчёта бара', async () => {
    vi.mocked(hotelApi.settings).mockRejectedValue(new ApiError(404, 'Гостиница ещё не настроена'));
    vi.mocked(currentMe).mockResolvedValue({
      context: { locationId: 'location-1' },
    } as Awaited<ReturnType<typeof currentMe>>);
    vi.mocked(barApi.report).mockResolvedValue({ currency: 'KZT' } as Awaited<ReturnType<typeof barApi.report>>);
    await expect(loadBarContext()).resolves.toEqual({ propertyId: 'location-1', currency: 'KZT' });
  });

  it('любой другой отказ настроек не прячется под запасной путь', async () => {
    vi.mocked(hotelApi.settings).mockRejectedValue(new ApiError(503, 'Нет связи'));
    await expect(loadBarContext()).rejects.toMatchObject({ status: 503 });
    expect(barApi.report).not.toHaveBeenCalled();
  });
});
