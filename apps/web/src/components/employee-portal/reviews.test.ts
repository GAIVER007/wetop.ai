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
vi.mock('./service-prices', () => ({ EmployeeServicePrices: () => null, servicePricesKey: () => '' }));
vi.mock('../tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ label: string; content: ReactNode }> }) => createElement(
    'div',
    null,
    panels.map((panel) => createElement('section', { key: panel.label }, panel.content)),
  ),
}));

import { EmployeeCabinet } from './cabinet';

function initial(reviews: unknown): EmployeePortalDto {
  return {
    canUpload: true,
    access: 'SELF',
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
    timeOffs: [],
    appointments: [],
    orders: [],
    monthStats: { month: '2026-10', status: 'AVAILABLE', currency: 'KZT', shifts: 20, daysOff: 11, absenceDays: 0, appointmentsDone: 0, servicesDone: 0, ordersClosed: null, tablesServed: null, guests: null, revenueMinor: '0', bonusMinor: '0', percent: null },    pay: {
      month: '2026-10', status: 'NOT_CONFIGURED', model: null, fixedMinor: null,
      percent: null, percentBasis: null, policyRevision: null, earnedMinor: null,
      paidMinor: '0', remainingMinor: null, bonusMinor: null, penaltyMinor: null,
      currency: 'USD', explanation: '', adjustments: [],
    },
    reviews,
  } as EmployeePortalDto;
}

function render(reviews: unknown) {
  return renderToStaticMarkup(createElement(EmployeeCabinet, {
    initial: initial(reviews),
    target: { employeeId: null },
    scope: 'synthetic-scope',
  }));
}

describe('свои отзывы мастера', () => {
  it('показывает среднюю оценку и тексты отзывов без личности клиента', () => {
    const html = render({
      averageStars: 4.5,
      count: 2,
      hasMore: false,
      items: [
        { appointmentId: 'appointment-1', stars: 5, comment: 'Очень аккуратно', submittedAt: '2026-10-17T09:00:00.000Z' },
        { appointmentId: 'appointment-2', stars: 4, comment: null, submittedAt: '2026-10-16T09:00:00.000Z' },
      ],
    });

    expect(html).toContain('Отзывы');
    expect(html).toContain('data-testid="portal-reviews"');
    expect(html).toContain('4,5');
    expect(html).toContain('2 отзыва');
    expect(html).toContain('Очень аккуратно');
    expect(html).not.toContain('Клиент:');
  });

  it('при отсутствии отзывов не рисует нулевой рейтинг', () => {
    const html = render({ averageStars: null, count: 0, hasMore: false, items: [] });
    const reviews = html.slice(html.indexOf('data-testid="portal-reviews"'));

    expect(reviews).toContain('Отзывов пока нет');
    expect(reviews).not.toContain('0 из 5');
  });
});
