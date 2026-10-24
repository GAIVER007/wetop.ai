import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EmployeePortalDto } from '@pms/domain';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useActionState: () => [null, vi.fn(), false],
  useTransition: () => [false, (action: () => void) => action()],
}));
vi.mock('../ui', () => ({
  Alert: ({ children }: { children: ReactNode }) => createElement('div', { role: 'alert' }, children),
  Badge: ({ children }: { children: ReactNode }) => createElement('span', null, children),
  Button: ({ children, ...props }: { children: ReactNode }) => createElement('button', props, children),
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) => createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Select: ({ children, ...props }: { children: ReactNode }) => createElement('select', props, children),
}));
vi.mock('./forms', () => ({
  PortalForm: ({ children }: { children: ReactNode }) => createElement('form', null, children),
  PortalWeek: () => null,
  PortalWeekView: () => null,
}));
vi.mock('./media', () => ({ PortalMedia: () => null }));
vi.mock('./management', () => ({ PortalManagement: () => null }));
vi.mock('./locations', () => ({ EmployeeLocationsForm: () => null }));
vi.mock('../../app/my-work/actions', () => ({
  saveEmployeeServicePrice: vi.fn(),
  removeEmployeeServicePrice: vi.fn(),
}));
vi.mock('../tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ label: string; content: ReactNode }> }) => createElement(
    'div',
    null,
    panels.map((panel) => createElement('section', { key: panel.label }, panel.content)),
  ),
}));

import { EmployeeCabinet } from './cabinet';
import { servicePricesKey } from './service-prices';

const initial = (access: 'MANAGER' | 'SELF'): EmployeePortalDto => ({
  canUpload: true,
  access,
  employee: { id: '11111111-1111-4111-8111-111111111111', name: 'Тестовый мастер', phone: null, email: null, active: true, accountLinked: false, profileRevision: 'profile-r1' },
  business: { id: 'business', name: 'Тестовый салон', vertical: 'BEAUTY' },
  location: { id: 'location', name: 'Тестовый филиал', timezone: 'Asia/Almaty', currency: 'USD' },
  profile: { headline: '', biography: '', practiceSinceYear: null, slug: 'test-master', published: false, publicationConsent: false, revision: 'public-r1' },
  avatar: null,
  portfolio: [],
  services: [],
  servicesRevision: 'services-r1',
  week: [],
  weekRevision: 'week-r1',
  scheduleConflicts: { items: [], checkedFrom: '2026-10-18', checkedCount: 0, truncated: false },
  reviews: { averageStars: null, count: 0, hasMore: false, items: [] },
  timeOffs: [],
  appointments: [],
  orders: [],
  workRange: 'DAY', workTruncated: false, monthStats: { month: '2026-10', status: 'AVAILABLE', currency: 'KZT', shifts: 20, daysOff: 11, absenceDays: 0, appointmentsDone: 0, servicesDone: 0, ordersClosed: null, tablesServed: null, guests: null, revenueMinor: '0', bonusMinor: '0', percent: null },
  pay: {
    month: '2026-10', status: 'NOT_CONFIGURED', model: null, fixedMinor: null,
    percent: null, percentBasis: null, policyRevision: null, earnedMinor: null,
    paidMinor: '0', remainingMinor: null, bonusMinor: null, penaltyMinor: null,
    currency: 'USD', explanation: '', adjustments: [],
  },
} as EmployeePortalDto);

const prices = [
  { employeeId: '11111111-1111-4111-8111-111111111111', serviceId: '21111111-1111-4111-8111-111111111111', serviceName: 'Стрижка', priceType: 'FIXED', priceMinMinor: '123456', priceMaxMinor: '123456', durationMinutes: 75, currency: 'USD', source: 'MASTER', revision: 3, sellable: true },
  { employeeId: '11111111-1111-4111-8111-111111111111', serviceId: '31111111-1111-4111-8111-111111111111', serviceName: 'Окрашивание', priceType: 'UNFIXED', priceMinMinor: null, priceMaxMinor: null, durationMinutes: 120, currency: 'USD', source: 'CATALOG', revision: null, sellable: false },
  { employeeId: '11111111-1111-4111-8111-111111111111', serviceId: '41111111-1111-4111-8111-111111111111', serviceName: 'Консультация', priceType: 'FREE', priceMinMinor: '0', priceMaxMinor: '0', durationMinutes: 30, currency: 'USD', source: 'MASTER', revision: 1, sellable: true },
] as const;

function render(access: 'MANAGER' | 'SELF') {
  return renderToStaticMarkup(createElement(EmployeeCabinet, {
    initial: initial(access),
    target: { employeeId: '11111111-1111-4111-8111-111111111111' },
    scope: 'synthetic-scope',
    servicePrices: prices,
  } as never));
}

describe('цены и длительность услуг мастера', () => {
  it('показывает руководителю major-unit значения и честные типы цены', () => {
    const html = render('MANAGER');
    expect(html).toContain('data-testid="portal-service-prices"');
    const fixed = html.slice(html.indexOf('Стрижка'), html.indexOf('Окрашивание'));
    expect(fixed).toContain('value="1234.56"');
    expect(fixed).toContain('value="75"');
    expect(fixed).toContain('Своя цена мастера');
    const unfixed = html.slice(html.indexOf('Окрашивание'), html.indexOf('Консультация'));
    expect(unfixed).toContain('Цена не задана');
    expect(unfixed).not.toContain('name="priceMin"');
    const free = html.slice(html.indexOf('Консультация'));
    expect(free).toContain('Бесплатно');
    expect(free).toContain('value="0"');
  });

  it('не показывает редактор цен в собственном read-only кабинете мастера', () => {
    expect(render('SELF')).not.toContain('data-testid="portal-service-prices"');
  });
});

/** Живой сайт 21.10.2026: после «Сохранить услуги» блок цен писал «Сначала назначьте мастеру услугу» до перезагрузки */
describe('блок цен мастера обновляется после назначения услуг', () => {
  it('ключ меняется, когда меняется набор услуг', () => {
    expect(servicePricesKey([])).not.toBe(servicePricesKey([prices[0]]));
    expect(servicePricesKey([prices[0], prices[1]])).toBe(servicePricesKey([prices[1], prices[0]]));
    expect(servicePricesKey([prices[0]])).not.toBe(servicePricesKey([{ ...prices[0], revision: 4 }]));
  });
});
