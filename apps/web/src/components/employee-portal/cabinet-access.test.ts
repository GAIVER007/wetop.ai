import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EmployeePortalDto, EmployeePortalSectionAccess } from '@pms/domain';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (value: unknown) => [value, vi.fn()],
  useActionState: () => [null, vi.fn(), false],
  useTransition: () => [false, (action: () => void) => action()],
}));
vi.mock('../ui', () => ({
  Badge: ({ children }: { children: ReactNode }) => createElement('span', null, children),
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) => createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
}));
vi.mock('./forms', () => ({
  PortalForm: ({ children, command }: { children: ReactNode; command: string }) => createElement('form', { 'data-command': command }, children),
  PortalWeek: () => createElement('div', { 'data-testid': 'portal-week-editor' }),
  PortalWeekView: () => createElement('div', { 'data-testid': 'portal-week-view' }),
}));
vi.mock('./media', () => ({ PortalMedia: () => createElement('div', { 'data-testid': 'portal-media' }) }));
vi.mock('./management', () => ({ PortalManagement: () => createElement('div', { 'data-testid': 'portal-management' }) }));
vi.mock('./locations', () => ({ EmployeeLocationsForm: () => createElement('div', { 'data-testid': 'portal-locations-form' }) }));
vi.mock('./service-prices', () => ({ EmployeeServicePrices: () => null }));
vi.mock('./reviews', () => ({ EmployeeReviews: () => createElement('div', { 'data-testid': 'portal-reviews' }) }));
vi.mock('../tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ id: string; label: string; content: ReactNode }> }) => createElement(
    'div',
    null,
    panels.map((panel) => createElement('section', { key: panel.id, 'data-panel': panel.id }, panel.label, panel.content)),
  ),
}));

import { EmployeeCabinet } from './cabinet';

type DayStatus = {
  state: 'ON_SHIFT' | 'OFF' | 'UNAVAILABLE';
  hours: string | null;
};
const CabinetWithDayStatus = EmployeeCabinet as unknown as (props: {
  initial: EmployeePortalDto;
  target: { employeeId: string | null };
  scope: string;
  dayStatus: DayStatus;
}) => ReactNode;

function dto(access: 'SELF' | 'MANAGER', sectionAccess: EmployeePortalSectionAccess): EmployeePortalDto {
  return {
    access,
    sectionAccess,
    canUpload: true,
    employee: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Synthetic master',
      phone: '+77000000000',
      email: 'synthetic@example.test',
      active: true,
      accountLinked: true,
      profileRevision: '2026-10-18T00:00:00.000000Z',
    },
    business: { id: 'business', name: 'Synthetic Beauty', vertical: 'BEAUTY' },
    location: { id: 'location', name: 'Synthetic salon', timezone: 'Asia/Almaty', currency: 'KZT' },
    profile: {
      headline: 'Master', biography: 'Private biography', practiceSinceYear: 2020, slug: 'synthetic-master',
      published: false, publicationConsent: false, revision: '1',
    },
    avatar: null,
    portfolio: [],
    services: [],
    servicesRevision: 'services-r1',
    week: [],
    weekRevision: 'week-r1',
    scheduleConflicts: { items: [], checkedFrom: '2026-10-18T00:00:00.000Z', checkedCount: 0, truncated: false },
    timeOffs: [],
    appointments: [],
    orders: [],
    reviews: { averageStars: null, count: 0, hasMore: false, items: [] },
    pay: {
      status: 'NOT_CONFIGURED', month: '2026-10', currency: 'KZT', model: null, fixedMinor: null,
      percent: null, percentBasis: null, policyRevision: null, earnedMinor: null, bonusMinor: null,
      penaltyMinor: null, paidMinor: null, remainingMinor: null, adjustments: [], explanation: '',
    },
  } as EmployeePortalDto;
}

const limited = {
  journalView: true,
  journalUpdate: false,
  appointmentsView: false,
  reviewsView: false,
  payrollView: false,
  payrollUpdate: false,
  employeesView: false,
  employeesUpdate: false,
  servicesView: false,
  servicesUpdate: false,
};

describe('Beauty employee cabinet access projection', () => {
  it('keeps self identity and schedule read-only while hiding ungranted tabs and edit actions', () => {
    const html = renderToStaticMarkup(createElement(EmployeeCabinet, {
      initial: dto('SELF', limited),
      target: { employeeId: null },
      scope: 'synthetic-scope',
    }));

    expect(html).toContain('Профессиональный профиль');
    expect(html).toContain('data-testid="portal-week-view"');
    expect(html).not.toContain('data-testid="portal-week-editor"');
    expect(html).not.toContain('data-command="profile"');
    expect(html).not.toContain('data-testid="portal-own-work"');
    expect(html).not.toContain('data-testid="portal-reviews"');
    expect(html).not.toContain('data-testid="portal-services"');
    expect(html).not.toContain('data-testid="portal-pay"');
    expect(html).not.toContain('data-testid="portal-media"');
    expect(html).not.toContain('data-testid="portal-management"');
  });

  it('does not turn employees.view into payroll, review, schedule or management tabs', () => {
    const html = renderToStaticMarkup(createElement(EmployeeCabinet, {
      initial: dto('MANAGER', { ...limited, journalView: false, employeesView: true }),
      target: { employeeId: '11111111-1111-4111-8111-111111111111' },
      scope: 'synthetic-scope',
    }));

    expect(html).toContain('Управление сотрудником');
    expect(html).not.toContain('data-testid="portal-own-work"');
    expect(html).not.toContain('data-testid="portal-reviews"');
    expect(html).not.toContain('data-testid="portal-week"');
    expect(html).not.toContain('data-testid="portal-pay"');
    expect(html).not.toContain('data-testid="portal-management"');
  });

  it('shows the canonical profile as off without confusing it with lifecycle status', () => {
    const html = renderToStaticMarkup(createElement(CabinetWithDayStatus, {
      initial: dto('MANAGER', { ...limited, journalView: true, employeesView: true }),
      target: { employeeId: '11111111-1111-4111-8111-111111111111' },
      scope: 'synthetic-scope',
      dayStatus: { state: 'OFF', hours: null },
    }));

    expect(html).toContain('Активен');
    expect(html).toContain('data-testid="employee-day-status">Выходной');
  });

  it('does not invent a day off when the canonical profile cannot read the schedule', () => {
    const html = renderToStaticMarkup(createElement(CabinetWithDayStatus, {
      initial: dto('MANAGER', { ...limited, journalView: false, employeesView: true }),
      target: { employeeId: '11111111-1111-4111-8111-111111111111' },
      scope: 'synthetic-scope',
      dayStatus: { state: 'UNAVAILABLE', hours: null },
    }));

    expect(html).toContain('data-testid="employee-day-status">График недоступен');
    expect(html).not.toContain('data-testid="employee-day-status">Выходной');
  });
});
