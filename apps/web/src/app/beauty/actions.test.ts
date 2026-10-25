import { afterEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
import { authApi, beautyApi, ApiError } from '../../lib/api';
import { saveBeautyEmployee, saveBeautyWorkingHours } from './actions';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const form = (values: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values))
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  return f;
};
const employee = {
  id: 'employee',
  name: 'Тестовый мастер',
  phone: null,
  email: null,
  active: true,
  locationIds: ['location'],
  serviceIds: [],
  servicesRevision: 'a'.repeat(64),
};
describe('Beauty independent commands', () => {
  it('minimal create returns the saved ID without a hidden skills replace', async () => {
    const create = vi.spyOn(beautyApi, 'createEmployee').mockResolvedValue(employee);
    const skills = vi.spyOn(beautyApi, 'setEmployeeServices').mockResolvedValue(employee);
    expect(
      await saveBeautyEmployee(null, form({ name: 'Тестовый мастер', creationId: 'key' })),
    ).toMatchObject({ resourceId: 'employee', message: 'Сотрудник создан' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, creationId: 'key' }),
    );
    expect(skills).not.toHaveBeenCalled();
  });
  it('skills ignores stale hidden name and contacts', async () => {
    const update = vi.spyOn(beautyApi, 'updateEmployee').mockResolvedValue(employee);
    const skills = vi.spyOn(beautyApi, 'setEmployeeServices').mockResolvedValue(employee);
    await saveBeautyEmployee(
      null,
      form({
        id: 'employee',
        section: 'skills',
        name: 'Устаревшее имя',
        phone: 'synthetic',
        serviceIds: ['service'],
        expectedRevision: 'b'.repeat(64),
      }),
    );
    expect(update).not.toHaveBeenCalled();
    expect(skills).toHaveBeenCalledWith('employee', ['service'], 'b'.repeat(64));
  });
  it('profile patches only changed fields and never rewrites skills', async () => {
    const update = vi.spyOn(beautyApi, 'updateEmployee').mockResolvedValue(employee);
    const skills = vi.spyOn(beautyApi, 'setEmployeeServices').mockResolvedValue(employee);
    await saveBeautyEmployee(
      null,
      form({
        id: 'employee',
        section: 'basic',
        name: 'Новое имя',
        phone: 'old-phone',
        changedFields: '["name"]',
      }),
    );
    expect(update).toHaveBeenCalledWith('employee', { name: 'Новое имя' });
    expect(skills).not.toHaveBeenCalled();
  });
  it('a failed assignment retains saved ID/revision and retries assignment alone', async () => {
    const create = vi.spyOn(beautyApi, 'createEmployee').mockResolvedValue(employee);
    const skills = vi
      .spyOn(beautyApi, 'setEmployeeServices')
      .mockRejectedValueOnce(new ApiError(503, 'Назначение не сохранено'))
      .mockResolvedValue(employee);
    const f = form({ name: 'Тестовый мастер', creationId: 'key', serviceIds: ['service'] });
    const first = await saveBeautyEmployee(null, f);
    expect(first).toMatchObject({
      resourceId: 'employee',
      revision: employee.servicesRevision,
      error: 'Назначение не сохранено',
    });
    await saveBeautyEmployee(first, f);
    expect(create).toHaveBeenCalledTimes(1);
    expect(skills).toHaveBeenCalledTimes(2);
  });
  it('scope switch rejects the stale form before any domain command', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ context: { locationId: 'other' } } as never);
    const create = vi.spyOn(beautyApi, 'createEmployee').mockResolvedValue(employee);
    expect(
      await saveBeautyEmployee(null, form({ name: 'Тестовый мастер', scopeKey: 'old' })),
    ).toMatchObject({ error: expect.stringContaining('Филиал изменён') });
    expect(create).not.toHaveBeenCalled();
  });
  it('week forwards the resource revision', async () => {
    const hours = vi
      .spyOn(beautyApi, 'setWorkingHours')
      .mockResolvedValue({ week: [], weekRevision: 'c'.repeat(64) });
    await saveBeautyWorkingHours(
      null,
      form({ id: 'employee', intervals: '[]', expectedRevision: 'b'.repeat(64) }),
    );
    expect(hours).toHaveBeenCalledWith('employee', [], 'b'.repeat(64));
  });
});
