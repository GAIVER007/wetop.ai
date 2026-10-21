import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404'); }, useRouter: () => ({ refresh() {} }) }));
vi.mock('../../../lib/vertical-guard', () => ({ requireVertical: async () => ({}) }));
vi.mock('../../../lib/desk-shell', () => ({
  deskShell: async () => ({ readOnly: false, scopeKey: 's', access: { role: 'OWNER', desk: 'write' } }),
}));
vi.mock('../../../lib/navigation', () => ({ mayAccess: () => true, mayBeautyAccess: () => true }));
vi.mock('../actions', () => ({ markBeautyCustomer: vi.fn() }));
vi.mock('../../../lib/api', () => ({
  beautyApi: {
    customer: async () => ({
      customer: {
        id: 'c1', firstName: 'Алия', lastName: 'Тестова', phone: '+77000000001', email: null,
        notes: null, status: 'ACTIVE', isVip: false, birthDate: null,
      },
      visits: [],
      historyTruncated: false,
    }),
    customerBonuses: async () => ({
      customerId: 'c1', currency: 'KZT', balanceMinor: '35000', entries: [],
      program: { enabled: true, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null },
    }),
  },
}));

import BeautyCustomerPage from './page';

/** Аудит 21.10.2026 п.10 и п.11: карточка клиента без плиток, с «Записать» и тем же сегментом, что в списке */
describe('карточка клиента салона', () => {
  it('контакты одной строкой, сегмент как в списке и кнопка записи', async () => {
    const html = renderToStaticMarkup(
      await BeautyCustomerPage({ params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) }),
    );
    expect(html).not.toContain('beauty-customer-head');
    expect(html).toContain('beauty-customer-contacts');
    expect(html).toContain('Новый');
    expect(html).not.toContain('Активен');
    expect(html).toContain('Записать');
    expect(html).toContain('/appointments?create=1&amp;customer=c1');
    expect(html).toContain('customer-bonus-head');
  });
});
