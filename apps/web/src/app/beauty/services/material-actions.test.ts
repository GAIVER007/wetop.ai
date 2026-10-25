import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authApi, beautyApi } from '../../../lib/api';
import { loadBeautyServiceMaterials, saveBeautyServiceMaterials } from './material-actions';

// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../../i18n/server', async () => ({ serverT: async () => (await import('../../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(_status: number, message: string) { super(message); }
  },
  authApi: { me: vi.fn() },
  beautyApi: { serviceMaterials: vi.fn(), saveServiceMaterials: vi.fn() },
}));

const serviceId = '11111111-1111-4111-8111-111111111111';
const scopeKey = '21111111-1111-4111-8111-111111111111';
const response = {
  serviceId,
  revision: 1,
  locationId: scopeKey,
  currency: 'USD',
  totalCostMinor: '42',
  missingCost: false,
  items: [],
  products: [],
};

describe('server actions техкарты услуги', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({ context: { locationId: scopeKey } } as never);
  });

  it('передаёт точную decimal-норму и revision zero без числового преобразования', async () => {
    vi.mocked(beautyApi.saveServiceMaterials).mockResolvedValue(response);
    const form = new FormData();
    form.set('serviceId', serviceId);
    form.set('scopeKey', scopeKey);
    form.set('expectedRevision', '0');
    form.set('items', JSON.stringify([{ productId: 'product-1', normQty: '0.125', unit: 'мл' }]));

    expect(await saveBeautyServiceMaterials(null, form)).toMatchObject({ message: 'Техкарта сохранена' });
    expect(beautyApi.saveServiceMaterials).toHaveBeenCalledWith(serviceId, {
      expectedRevision: 0,
      items: [{ productId: 'product-1', normQty: '0.125', unit: 'мл' }],
    });
  });

  it('не читает и не сохраняет техкарту после смены филиала', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ context: { locationId: 'another-location' } } as never);
    expect(await loadBeautyServiceMaterials(serviceId, scopeKey)).toMatchObject({ error: expect.stringContaining('Филиал изменён') });
    const form = new FormData();
    form.set('serviceId', serviceId);
    form.set('scopeKey', scopeKey);
    form.set('expectedRevision', '0');
    form.set('items', '[]');
    expect(await saveBeautyServiceMaterials(null, form)).toMatchObject({ error: expect.stringContaining('Филиал изменён') });
    expect(beautyApi.serviceMaterials).not.toHaveBeenCalled();
    expect(beautyApi.saveServiceMaterials).not.toHaveBeenCalled();
  });

  it('отклоняет отсутствующую revision до запроса к API', async () => {
    const form = new FormData();
    form.set('serviceId', serviceId);
    form.set('scopeKey', scopeKey);
    form.set('items', '[]');
    expect(await saveBeautyServiceMaterials(null, form)).toMatchObject({ error: expect.stringContaining('устарела') });
    expect(beautyApi.saveServiceMaterials).not.toHaveBeenCalled();
  });

  it('возвращает серверный конфликт stale revision без потери текста', async () => {
    vi.mocked(beautyApi.saveServiceMaterials).mockRejectedValue(new ApiError(409, 'Техкарта уже изменена'));
    const form = new FormData();
    form.set('serviceId', serviceId);
    form.set('scopeKey', scopeKey);
    form.set('expectedRevision', '2');
    form.set('items', '[]');
    expect(await saveBeautyServiceMaterials(null, form)).toEqual({ error: 'Техкарта уже изменена' });
  });
});
