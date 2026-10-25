import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalManagement } from '../../components/employee-portal/management';
import { employeePortalApi } from '../../lib/employee-portal-api';
import { savePortal } from './actions';

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../lib/scope-pointer', () => ({
  requestScopeHeader: async () => ({ 'x-wetop-scope': 'synthetic-scope' }),
}));
vi.mock('../../lib/employee-portal-api', () => ({
  employeePortalApi: { load: vi.fn(), pay: vi.fn() },
}));

const target = { employeeId: 'synthetic-employee' };

describe('employee salary in configured currency major units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeePortalApi.load).mockResolvedValue({ access: 'MANAGER' } as never);
    vi.mocked(employeePortalApi.pay).mockResolvedValue({} as never);
  });

  it('converts a decimal major-unit salary exactly before sending it to the API', async () => {
    const form = new FormData();
    form.set('model', 'FIXED');
    form.set('fixedAmount', '1 234,56');
    form.set('percent', '0');

    await savePortal(target, 'synthetic-scope', 'pay', form);

    expect(employeePortalApi.pay).toHaveBeenCalledWith(target, {
      model: 'FIXED',
      fixedMinor: '123456',
      percent: 0,
    });
  });

  it('renders the saved salary in major units and names its actual currency', () => {
    const html = renderToStaticMarkup(createElement(PortalManagement, {
      data: {
        access: 'MANAGER',
        employee: { accountLinked: true },
        business: { vertical: 'BEAUTY' },
        profile: { revision: '1' },
        pay: {
          currency: 'USD',
          model: 'FIXED',
          fixedMinor: '123456',
          percent: 0,
          percentBasis: null,
          policyRevision: null,
        },
      } as never,
      context: { target, scope: 'synthetic-scope', onSaved: vi.fn() },
    }));

    // те же подписи, что окно «Оплата» в «Зарплате» (владелец 25.10.2026): «Только оклад» показывает одно поле оклада
    expect(html).toContain('Оклад за месяц, USD');
    expect(html).toContain('<input type="hidden" name="percent" value="0"/>');
    expect(html).toContain('name="fixedAmount"');
    expect(html).toContain('value="1234.56"');
    expect(html).not.toContain('minor units');
    expect(html).not.toContain('тиын');
  });
});
