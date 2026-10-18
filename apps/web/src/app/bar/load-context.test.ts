import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';
import { barApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { hotelApi } from '../../lib/hotel-api';
import { loadBarContext } from './load-context';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T,>(fn: T) => fn,
}));
vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn(),
}));
vi.mock('../../lib/hotel-api', () => ({ hotelApi: { settings: vi.fn() } }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: vi.fn() }));
vi.mock('../../lib/workspace-context', () => ({ selectedWorkspaceBranch: vi.fn() }));
vi.mock('../../lib/api', async () => ({
  ApiError: (await import('../../lib/api-error')).ApiError,
  barApi: { report: vi.fn() },
}));

describe('контекст денежных форм бара (D-CUR, ADR-178)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentMe).mockResolvedValue({
      context: { vertical: 'HOSPITALITY', locationId: 'property-1' },
    } as Awaited<ReturnType<typeof currentMe>>);
  });

  it('у гостиницы объект и валюта берутся из её настроек', async () => {
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-1', currency: 'USD' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
    await expect(loadBarContext()).resolves.toEqual({ propertyId: 'property-1', currency: 'USD' });
    expect(barApi.report).not.toHaveBeenCalled();
  });

  it('у салона не запрашивает гостиничные настройки и берёт настроенную валюту филиала', async () => {
    vi.mocked(currentMe).mockResolvedValue({
      context: { vertical: 'BEAUTY', locationId: 'location-1' },
    } as Awaited<ReturnType<typeof currentMe>>);
    vi.mocked(selectedWorkspaceBranch).mockResolvedValue({
      locationId: 'location-1', currency: 'USD',
    } as Awaited<ReturnType<typeof selectedWorkspaceBranch>>);
    await expect(loadBarContext()).resolves.toEqual({ propertyId: 'location-1', currency: 'USD' });
    expect(hotelApi.settings).not.toHaveBeenCalled();
    expect(barApi.report).not.toHaveBeenCalled();
  });

  it('любой другой отказ настроек не прячется под запасной путь', async () => {
    vi.mocked(hotelApi.settings).mockRejectedValue(new ApiError(503, 'Нет связи'));
    await expect(loadBarContext()).rejects.toMatchObject({ status: 503 });
    expect(barApi.report).not.toHaveBeenCalled();
  });
});
