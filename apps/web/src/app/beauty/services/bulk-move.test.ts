import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, beautyApi } from '../../../lib/api';
import { moveLocationServices } from '../actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(_status: number, message: string) {
      super(message);
    }
  },
  authApi: { me: vi.fn() },
  beautyApi: { services: vi.fn(), setLocationService: vi.fn(), createService: vi.fn() },
}));

const scopeKey = 'location-1';
const row = (id: string, name: string, enabled: boolean, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  category: 'Волосы',
  durationMinutes: 60,
  priceMinor: '100000',
  currency: 'KZT',
  active: true,
  location: { enabled, priceOverrideMinor: null, durationOverrideMinutes: null },
  effective: null,
  ...extra,
});
const form = (direction: 'enable' | 'disable', ids: string[], presets: string[] = []) => {
  const data = new FormData();
  data.set('scopeKey', scopeKey);
  data.set('direction', direction);
  ids.forEach((id) => data.append('id', id));
  presets.forEach((name) => data.append('preset', name));
  return data;
};

describe('массовый перенос услуг между каталогом и филиалом', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({ context: { locationId: scopeKey } } as never);
    vi.mocked(beautyApi.setLocationService).mockResolvedValue({ items: [] } as never);
  });

  it('добавляет все отмеченные услуги и сохраняет свою цену филиала у тех, у кого она была', async () => {
    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: scopeKey,
      locationCurrency: 'KZT',
      items: [
        row('a', 'Массаж', false),
        {
          ...row('b', 'Укладка', false),
          location: { enabled: false, priceOverrideMinor: '125000', durationOverrideMinutes: 75 },
        },
      ],
    } as never);

    const result = await moveLocationServices(null, form('enable', ['a', 'b']));

    expect(result).toEqual({ message: 'Добавлено в филиал: 2 услуги' });
    expect(beautyApi.setLocationService).toHaveBeenCalledWith('a', {
      enabled: true,
      priceOverrideMinor: '',
      durationOverrideMinutes: '',
    });
    expect(beautyApi.setLocationService).toHaveBeenCalledWith('b', {
      enabled: true,
      priceOverrideMinor: '125000',
      durationOverrideMinutes: '75',
    });
  });

  it('убирает из филиала только то, что там есть, и не трогает остальное', async () => {
    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: scopeKey,
      locationCurrency: 'KZT',
      items: [row('a', 'Массаж', true), row('b', 'Укладка', false)],
    } as never);

    const result = await moveLocationServices(null, form('disable', ['a', 'b']));

    expect(result).toEqual({ message: 'Убрано из филиала: 1 услуга' });
    expect(beautyApi.setLocationService).toHaveBeenCalledTimes(1);
    expect(beautyApi.setLocationService).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ enabled: false }),
    );
  });

  it('не включает услугу из архива', async () => {
    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: scopeKey,
      locationCurrency: 'KZT',
      items: [row('a', 'Старая', false, { active: false })],
    } as never);

    await moveLocationServices(null, form('enable', ['a']));

    expect(beautyApi.setLocationService).not.toHaveBeenCalled();
  });

  it('создаёт типовую услугу с нулевой ценой, не выдумывая цену, и сразу включает её в филиале', async () => {
    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: scopeKey,
      locationCurrency: 'KZT',
      items: [],
    } as never);
    vi.mocked(beautyApi.createService).mockResolvedValue({ id: 'new-id' } as never);

    const result = await moveLocationServices(
      null,
      form('enable', [], ['Стрижка мужская', 'Не из списка']),
    );

    expect(result).toEqual({ message: 'Добавлено в филиал: 1 услуга' });
    expect(beautyApi.createService).toHaveBeenCalledTimes(1);
    expect(beautyApi.createService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Стрижка мужская',
        priceMinor: '0',
        currency: 'KZT',
        durationMinutes: '45',
      }),
    );
    expect(beautyApi.setLocationService).toHaveBeenCalledWith(
      'new-id',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('не дублирует типовую услугу, если такая карточка уже есть в каталоге', async () => {
    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: scopeKey,
      locationCurrency: 'KZT',
      items: [row('exists', 'Стрижка мужская', false)],
    } as never);

    await moveLocationServices(null, form('enable', [], ['Стрижка мужская']));

    expect(beautyApi.createService).not.toHaveBeenCalled();
    expect(beautyApi.setLocationService).toHaveBeenCalledWith(
      'exists',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('при частичном сбое говорит, сколько перенесено и какие услуги остались', async () => {
    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: scopeKey,
      locationCurrency: 'KZT',
      items: [row('a', 'Массаж', false), row('b', 'Укладка', false)],
    } as never);
    vi.mocked(beautyApi.setLocationService)
      .mockResolvedValueOnce({ items: [] } as never)
      .mockRejectedValueOnce(new Error('boom'));

    const result = await moveLocationServices(null, form('enable', ['a', 'b']));

    expect(result.error).toContain('Добавлено в филиал: 1');
    expect(result.error).toContain('Укладка');
  });

  it('отказывает без отметки, без выбранного филиала и после смены филиала', async () => {
    expect(await moveLocationServices(null, form('enable', []))).toEqual({
      error: 'Отметьте услуги галочкой.',
    });

    vi.mocked(beautyApi.services).mockResolvedValue({
      locationId: null,
      locationCurrency: null,
      items: [],
    } as never);
    expect(await moveLocationServices(null, form('enable', ['a']))).toMatchObject({
      error: expect.stringContaining('Выберите филиал'),
    });

    vi.mocked(authApi.me).mockResolvedValue({ context: { locationId: 'other' } } as never);
    expect(await moveLocationServices(null, form('enable', ['a']))).toMatchObject({
      error: expect.stringContaining('Филиал изменён'),
    });
    expect(beautyApi.setLocationService).not.toHaveBeenCalled();
  });
});
