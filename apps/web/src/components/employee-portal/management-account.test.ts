import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EmployeePortalDto } from '@pms/domain';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../ui', () => ({
  Field: ({ label, children }: { label: string; children: ReactNode }) => createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Select: ({ children, ...props }: { children: ReactNode }) => createElement('select', props, children),
}));
vi.mock('./forms', () => ({
  PortalForm: ({ children, command, label }: { children?: ReactNode; command: string; label: string }) =>
    createElement('form', { 'data-command': command }, children, createElement('button', { type: 'submit' }, label)),
}));

import { PortalManagement } from './management';

const data = (accountLinked = false, access: 'MANAGER' | 'SELF' = 'MANAGER'): EmployeePortalDto => ({
  access,
  canUpload: true,
  employee: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Тестовый мастер',
    phone: null,
    email: null,
    active: true,
    accountLinked,
    profileRevision: 'profile-r1',
  },
  business: { id: 'business-1', name: 'Тестовый салон', vertical: 'BEAUTY' },
  location: { id: 'location-1', name: 'Тестовый филиал', timezone: 'Asia/Almaty', currency: 'KZT' },
  profile: {
    headline: '', biography: '', practiceSinceYear: null, slug: 'test-master', published: false,
    publicationConsent: false, revision: 'public-r1',
  },
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
  reviews: { averageStars: null, count: 0, hasMore: false, items: [] },
  workRange: 'DAY', workTruncated: false, monthStats: { month: '2026-10', status: 'AVAILABLE', currency: 'KZT', shifts: 20, daysOff: 11, absenceDays: 0, appointmentsDone: 0, servicesDone: 0, ordersClosed: null, tablesServed: null, guests: null, revenueMinor: '0', bonusMinor: '0', percent: null },
  pay: {
    month: '2026-10', status: 'NOT_CONFIGURED', model: null, fixedMinor: null, percent: null,
    percentBasis: null, policyRevision: null, earnedMinor: null, paidMinor: '0', remainingMinor: null,
    bonusMinor: null, penaltyMinor: null, currency: 'KZT', explanation: '', adjustments: [],
  },
});

const context = {
  target: { employeeId: '11111111-1111-4111-8111-111111111111' },
  scope: 'business-1:location-1',
  onSaved: vi.fn(),
};

type AccountOption = { userId: string; label: string };
const options: AccountOption[] = [
  { userId: '22222222-2222-4222-8222-222222222222', label: 'Айжан, master@example.invalid' },
];
const ManagementWithOptions = PortalManagement as unknown as (props: {
  data: EmployeePortalDto;
  context: typeof context;
  accountOptions?: AccountOption[];
}) => ReactNode;

describe('E4: привязка входа мастера выбором участника команды', () => {
  it('показывает подтверждённых участников в select без ручного UUID', () => {
    const html = renderToStaticMarkup(createElement(ManagementWithOptions, {
      data: data(), context, accountOptions: options,
    }));
    expect(html).toContain('<select name="userId"');
    expect(html).toContain('value="22222222-2222-4222-8222-222222222222"');
    expect(html).toContain('Айжан, master@example.invalid');
    expect(html).not.toContain('ID существующего');
    expect(html).not.toContain('<input name="userId"');
  });

  it('не предлагает повторную привязку уже связанного аккаунта', () => {
    const html = renderToStaticMarkup(createElement(ManagementWithOptions, {
      data: data(true), context, accountOptions: options,
    }));
    expect(html).not.toContain('data-command="account"');
    expect(html).toContain('data-command="unlink"');
  });

  it('не показывает управление аккаунтом сотруднику в своём кабинете', () => {
    const html = renderToStaticMarkup(createElement(ManagementWithOptions, {
      data: data(false, 'SELF'), context, accountOptions: options,
    }));
    expect(html).toBe('');
  });
});
