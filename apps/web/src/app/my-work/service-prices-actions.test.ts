import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beautyApi } from '../../lib/api';
import { removeEmployeeServicePrice, saveEmployeeServicePrice } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../lib/employee-portal-api', () => ({
  employeePortalApi: { load: vi.fn() },
}));
vi.mock('../../lib/scope-pointer', () => ({
  requestScopeHeader: vi.fn(async () => ({ 'x-wetop-scope': 'synthetic-scope' })),
}));
vi.mock('../../lib/api', () => ({
  beautyApi: {
    setEmployeeServicePrice: vi.fn(),
    removeEmployeeServicePrice: vi.fn(),
  },
}));

const employeeId = '11111111-1111-4111-8111-111111111111';
const serviceId = '21111111-1111-4111-8111-111111111111';

describe('service price server actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts exact decimal major units and creates revision zero', async () => {
    vi.mocked(beautyApi.setEmployeeServicePrice).mockResolvedValue([] as never);
    const form = new FormData();
    form.set('serviceId', serviceId);
    form.set('priceType', 'RANGE');
    form.set('priceMin', '1 234,56');
    form.set('priceMax', '2345.67');
    form.set('durationMinutes', '75');
    form.set('currency', 'USD');
    form.set('expectedRevision', '0');

    expect(await saveEmployeeServicePrice(employeeId, 'synthetic-scope', form)).toMatchObject({ error: null });
    expect(beautyApi.setEmployeeServicePrice).toHaveBeenCalledWith(employeeId, serviceId, {
      expectedRevision: 0,
      priceType: 'RANGE',
      priceMinMinor: '123456',
      priceMaxMinor: '234567',
      durationMinutes: 75,
      currency: 'USD',
    });
  });

  it('rejects a changed scope without calling the API', async () => {
    const form = new FormData();
    form.set('serviceId', serviceId);
    expect(await saveEmployeeServicePrice(employeeId, 'stale-scope', form)).toMatchObject({ error: expect.stringContaining('Филиал изменился') });
    expect(beautyApi.setEmployeeServicePrice).not.toHaveBeenCalled();
  });

  it('deletes only the exact saved revision', async () => {
    vi.mocked(beautyApi.removeEmployeeServicePrice).mockResolvedValue([] as never);
    const form = new FormData();
    form.set('serviceId', serviceId);
    form.set('expectedRevision', '4');

    expect(await removeEmployeeServicePrice(employeeId, 'synthetic-scope', form)).toMatchObject({ error: null });
    expect(beautyApi.removeEmployeeServicePrice).toHaveBeenCalledWith(employeeId, serviceId, { expectedRevision: 4 });
  });
});
