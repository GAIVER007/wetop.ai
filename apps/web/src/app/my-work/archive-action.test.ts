import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeePortalApi } from '../../lib/employee-portal-api';
import { beautyApi } from '../../lib/api';
import { savePortal } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../lib/employee-portal-api', () => ({
  employeePortalApi: { load: vi.fn() },
}));
vi.mock('../../lib/scope-pointer', () => ({
  requestScopeHeader: vi.fn(async () => ({ 'x-wetop-scope': 'synthetic-scope' })),
}));
vi.mock('../../lib/api', () => ({
  beautyApi: { updateEmployee: vi.fn() },
}));

const employeeId = '11111111-1111-4111-8111-111111111111';
const portal = (access: 'MANAGER' | 'SELF') => ({
  access,
  employee: { id: employeeId, active: true },
});

describe('E5 (паритет с zapis.kz): архив мастера из карточки', () => {
  beforeEach(() => vi.clearAllMocks());

  it('руководитель убирает мастера в архив одной командой', async () => {
    vi.mocked(employeePortalApi.load).mockResolvedValue(portal('MANAGER') as never);
    vi.mocked(beautyApi.updateEmployee).mockResolvedValue({} as never);
    const form = new FormData();
    form.set('active', 'false');
    const result = await savePortal(employeeId as never, 'synthetic-scope', 'active', form);
    expect('error' in result).toBe(false);
    expect(beautyApi.updateEmployee).toHaveBeenCalledWith(employeeId, { active: false });
  });
  it('сам сотрудник команду не выполняет', async () => {
    vi.mocked(employeePortalApi.load).mockResolvedValue(portal('SELF') as never);
    const form = new FormData();
    form.set('active', 'false');
    const result = await savePortal(employeeId as never, 'synthetic-scope', 'active', form);
    expect(result.error).toBeTruthy();
    expect(beautyApi.updateEmployee).not.toHaveBeenCalled();
  });
});
