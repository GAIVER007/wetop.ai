import { afterEach, describe, expect, it, vi } from 'vitest';
import { beautyApi } from '../../../lib/api';
import { saveBeautyService } from '../actions';

// Онбординг на живом сайте 21.10.2026: «← Настроить» у типовой услуги обещает «добавить в филиал», а услуга
// оставалась только в каталоге («В филиале: 0»), и шаг «Добавьте услуги» не засчитывался
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
};
const base = { name: 'Стрижка мужская', category: 'Волосы', durationMinutes: '45', priceMinor: '500000', currency: 'KZT', active: 'on', creationId: 'key' };
const saved = { id: 'svc-1' } as Awaited<ReturnType<typeof beautyApi.createService>>;

describe('saveBeautyService: новая услуга сразу в филиал', () => {
  it('enableForLocation=on: после создания услуга включается в выбранном филиале', async () => {
    vi.spyOn(beautyApi, 'createService').mockResolvedValue(saved);
    const location = vi.spyOn(beautyApi, 'setLocationService').mockResolvedValue(undefined as never);
    const result = await saveBeautyService(null, form({ ...base, enableForLocation: 'on' }));
    expect(location).toHaveBeenCalledWith('svc-1', { enabled: true, priceOverrideMinor: '', durationOverrideMinutes: '' });
    expect(result).toMatchObject({ resourceId: 'svc-1', message: 'Услуга добавлена в филиал' });
  });
  it('без флага: только каталог, как раньше', async () => {
    vi.spyOn(beautyApi, 'createService').mockResolvedValue(saved);
    const location = vi.spyOn(beautyApi, 'setLocationService').mockResolvedValue(undefined as never);
    const result = await saveBeautyService(null, form(base));
    expect(location).not.toHaveBeenCalled();
    expect(result).toMatchObject({ resourceId: 'svc-1' });
  });
  it('филиал не принял: услуга создана, ошибка словами, id сохранён для повтора', async () => {
    vi.spyOn(beautyApi, 'createService').mockResolvedValue(saved);
    vi.spyOn(beautyApi, 'setLocationService').mockRejectedValue(new Error('boom'));
    const result = await saveBeautyService(null, form({ ...base, enableForLocation: 'on' }));
    expect(result).toMatchObject({ resourceId: 'svc-1' });
    expect(result.error).toMatch(/Услуга создана, но не включилась в филиале/);
  });
});
