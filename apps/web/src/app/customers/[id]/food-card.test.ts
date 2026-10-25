import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../i18n/server', async () => ({ serverT: async () => (await import('../../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404'); }, useRouter: () => ({ refresh() {} }) }));
vi.mock('../../../lib/vertical-guard', () => ({ requireVertical: async () => ({ context: { vertical: 'FOOD_SERVICE' } }) }));
vi.mock('../../../lib/desk-shell', () => ({
  deskShell: async () => ({ readOnly: false, scopeKey: 's', access: { role: 'OWNER', desk: 'write' } }),
}));
vi.mock('../../../lib/navigation', () => ({ mayAccess: () => true, mayBeautyAccess: () => true }));
vi.mock('../actions', () => ({ markBeautyCustomer: vi.fn() }));
const beautyCustomer = vi.fn();
vi.mock('../../../lib/api', () => ({ beautyApi: { customer: (...a: unknown[]) => beautyCustomer(...a), customerBonuses: async () => null } }));
const visit = (id: string, startsAt: string, status: string, location: string, table: { name: string; areaName: string } | null) => ({
  id, startsAt, endsAt: startsAt, partySize: 4, status, source: 'DESK', notes: null,
  location: { id: location, name: location === 'l1' ? 'Центр' : 'Мега', timezone: 'Asia/Almaty' }, table,
});
vi.mock('../../../lib/food-api', () => ({
  foodApi: {
    customer: async () => ({
      customer: {
        id: 'g1', firstName: 'Айгерим', lastName: 'Тестова', phone: '+77000000001', email: null,
        notes: 'Любит веранду', status: 'ACTIVE', isVip: true, birthDate: null,
      },
      visits: [
        visit('r3', '2026-10-20T15:00:00Z', 'BOOKED', 'l1', null),
        visit('r2', '2026-10-10T14:00:00Z', 'COMPLETED', 'l2', null),
        visit('r1', '2026-10-01T13:00:00Z', 'COMPLETED', 'l1', { name: '5', areaName: 'Веранда' }),
      ],
      historyTruncated: false,
    }),
  },
}));

import CustomerPage from './page';

/** Решение владельца 23.10.2026 п. 4: карточка клиента у ресторана в том же виде, что у салона */
describe('карточка клиента ресторана', () => {
  it('контакты строкой, «Постоянный гость» от двух визитов, история броней со столом и филиалом, без сумм', async () => {
    const html = renderToStaticMarkup(await CustomerPage({ params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) }));
    expect(beautyCustomer).not.toHaveBeenCalled();
    expect(html).toContain('beauty-customer-contacts');
    expect(html).toContain('Айгерим Тестова');
    expect(html).toContain('Постоянный гость');
    expect(html).toContain('VIP');
    expect(html).toContain('Визитов: 2, всего 3 брони');
    expect(html).toContain('Любит веранду');
    expect(html).toContain('История броней');
    expect(html).toContain('Веранда, Стол 5');
    expect(html).toContain('Без стола');
    expect(html).toContain('Мега');
    expect(html).toContain('Забронировать стол');
    expect(html).not.toContain('Сумма');
    expect(html).not.toContain('Записать');
    expect(html).toContain('href="/customers"');
  });
});
