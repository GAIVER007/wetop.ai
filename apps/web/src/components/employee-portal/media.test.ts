import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EmployeePortalDto } from '@pms/domain';

vi.mock('../ui', () => ({
  Field: ({ label, children }: { label: string; children: ReactNode }) => createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Select: ({ children, ...props }: { children: ReactNode }) => createElement('select', props, children),
}));
vi.mock('./forms', () => ({
  PortalForm: ({ children, command, label }: { children?: ReactNode; command: string; label: string }) =>
    createElement('form', { 'data-command': command }, children, createElement('button', null, label)),
}));

import { PortalMedia } from './media';

const context = {
  target: { employeeId: null }, scope: 'synthetic-scope', onSaved: vi.fn(),
};

function data(canUpload: boolean): EmployeePortalDto {
  return ({
    canUpload,
    access: 'SELF',
    employee: { id: 'employee', name: 'Тестовый мастер', phone: null, email: null, active: true, accountLinked: true, profileRevision: 'r1' },
    business: { id: 'business', name: 'Тестовый салон', vertical: 'BEAUTY' },
    location: { id: 'location', name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' },
    profile: { headline: '', biography: '', practiceSinceYear: null, slug: 'master', published: false, publicationConsent: false, revision: '1' },
    avatar: null, portfolio: [], services: [], servicesRevision: null, week: [], weekRevision: null,
    scheduleConflicts: { items: [], checkedFrom: '2026-10-18T00:00:00.000Z', checkedCount: 0, truncated: false },
    timeOffs: [], appointments: [], orders: [],
    workRange: 'DAY', workTruncated: false, monthStats: { month: '2026-10', status: 'AVAILABLE', currency: 'KZT', shifts: 20, daysOff: 11, absenceDays: 0, appointmentsDone: 0, servicesDone: 0, ordersClosed: null, tablesServed: null, guests: null, revenueMinor: '0', bonusMinor: '0', percent: null },
    pay: { status: 'NOT_CONFIGURED', month: '2026-10', currency: 'KZT', model: null, fixedMinor: null, percent: null, percentBasis: null, policyRevision: null, earnedMinor: null, bonusMinor: null, penaltyMinor: null, paidMinor: null, remainingMinor: null, explanation: '', adjustments: [] },
  } as unknown) as EmployeePortalDto;
}

describe('employee portal photo storage capability', () => {
  it('does not offer uploads when runtime storage is unavailable', () => {
    const html = renderToStaticMarkup(createElement(PortalMedia, { data: data(false), context }));
    expect(html).toContain('Загрузка фото пока недоступна');
    expect(html).not.toContain('data-command="avatar"');
    expect(html).not.toContain('data-command="add-work"');
  });

  it('offers avatar and portfolio uploads when runtime storage is configured', () => {
    const html = renderToStaticMarkup(createElement(PortalMedia, { data: data(true), context }));
    expect(html).toContain('data-command="avatar"');
    expect(html).toContain('data-command="add-work"');
    expect(html).not.toContain('Загрузка фото пока недоступна');
  });
});
