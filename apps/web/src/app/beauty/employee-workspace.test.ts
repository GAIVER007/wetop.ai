import { beforeEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
import { saveBeautyEmployee } from './actions';
import { beautyApi } from '../../lib/api';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  beautyApi: { createEmployee: vi.fn(), updateEmployee: vi.fn(), setEmployeeServices: vi.fn() },
}));

// Boundary proof only: these mocks do not prove DB atomicity or HTTP permissions.
describe('Employee create action: base profile is independent of skills', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the saved identity without an unnecessary skills write', async () => {
    const employee = {
      id: 'cf36e5fb-ce20-46e5-a462-82b42ea1e106',
      name: 'Тестовый мастер',
      active: true,
      phone: null,
      email: null,
      locationIds: [],
      serviceIds: [],
    };
    vi.mocked(beautyApi.createEmployee).mockResolvedValue(employee);
    vi.mocked(beautyApi.setEmployeeServices).mockResolvedValue(employee);
    const form = new FormData();
    form.set('name', employee.name);
    form.set('active', 'on');
    form.set('section', 'basic');
    const result = await saveBeautyEmployee(null, form);
    expect(beautyApi.createEmployee).toHaveBeenCalledTimes(1);
    expect(beautyApi.setEmployeeServices).not.toHaveBeenCalled();
    expect(result).toMatchObject({ resourceId: employee.id });
  });
  it('saving skills never writes an obsolete profile', async () => {
    const row = {
      id: 'cf36e5fb-ce20-46e5-a462-82b42ea1e106',
      name: 'Новое имя',
      active: true,
      phone: null,
      email: null,
      locationIds: [],
      serviceIds: ['service-fixture'],
    };
    vi.mocked(beautyApi.updateEmployee).mockResolvedValue(row);
    vi.mocked(beautyApi.setEmployeeServices).mockResolvedValue(row);
    const form = new FormData();
    form.set('id', row.id);
    form.set('section', 'skills');
    form.set('name', 'Старое имя');
    form.set('active', 'on');
    form.append('serviceIds', 'service-fixture');
    await saveBeautyEmployee(null, form);
    expect(beautyApi.setEmployeeServices).toHaveBeenCalledTimes(1);
    expect(beautyApi.updateEmployee).not.toHaveBeenCalled();
  });
  it('saving a profile never restores an obsolete skills selection', async () => {
    const row = {
      id: 'cf36e5fb-ce20-46e5-a462-82b42ea1e106',
      name: 'Новое имя',
      active: true,
      phone: null,
      email: null,
      locationIds: [],
      serviceIds: [],
    };
    vi.mocked(beautyApi.updateEmployee).mockResolvedValue(row);
    vi.mocked(beautyApi.setEmployeeServices).mockResolvedValue(row);
    const form = new FormData();
    form.set('id', row.id);
    form.set('section', 'basic');
    form.set('name', row.name);
    form.set('active', 'on');
    form.append('serviceIds', 'obsolete-service-fixture');
    await saveBeautyEmployee(null, form);
    expect(beautyApi.updateEmployee).toHaveBeenCalledTimes(1);
    expect(beautyApi.setEmployeeServices).not.toHaveBeenCalled();
  });

  it('profile revision roundtrip preserves all six microsecond digits', async () => {
    const expectedProfileRevision = '2026-10-14T10:20:30.123456Z';
    const row = {
      id: 'cf36e5fb-ce20-46e5-a462-82b42ea1e106',
      name: 'Тестовый мастер',
      active: true,
      phone: null,
      email: null,
      locationIds: [],
      serviceIds: [],
      profileRevision: '2026-10-14T10:20:30.123457Z',
    };
    vi.mocked(beautyApi.updateEmployee).mockResolvedValue(row);
    const form = new FormData();
    form.set('id', row.id);
    form.set('section', 'basic');
    form.set('name', row.name);
    form.set('active', 'on');
    form.set('expectedProfileRevision', expectedProfileRevision);
    const result = await saveBeautyEmployee(null, form);
    expect(beautyApi.updateEmployee).toHaveBeenCalledWith(
      row.id,
      expect.objectContaining({ expectedProfileRevision }),
    );
    expect(result.employee?.profileRevision).toBe(row.profileRevision);
  });
});
