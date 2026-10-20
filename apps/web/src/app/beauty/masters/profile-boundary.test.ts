import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeePortalDto } from '@pms/domain';
import type { BeautyDay, BeautyEmployeeRow, BeautySchedule, BeautyServiceRow } from '../../../lib/api';

const captured = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useActionState: () => [null, vi.fn(), false],
  useTransition: () => [false, (action: () => void) => action()],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: captured.replace }) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}));
vi.mock('../../../components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../components/ui')>()),
  Alert: ({ children }: { children: ReactNode }) => createElement('div', { role: 'alert' }, children),
  Badge: ({ children }: { children: ReactNode }) => createElement('span', null, children),
  Button: ({ children, ...props }: { children: ReactNode }) => createElement('button', props, children),
  Field: ({ label, children }: { label: string; children: ReactNode }) => createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
}));
vi.mock('../../../components/overlay', () => ({
  Overlay: ({ open, children, title }: { open: boolean; children: ReactNode; title: string }) =>
    open ? createElement('section', { role: 'dialog', 'aria-label': title, 'data-testid': 'master-preview' }, children) : null,
}));
vi.mock('../../../components/employee-workspace/workspace', () => ({
  EmployeeProfile: ({ row }: { row: unknown }) => createElement('div', { 'data-testid': row ? 'edit-profile' : 'create-profile' }),
  EmployeeTransitionGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../schedule/board', () => ({
  LocationsForm: () => createElement('div', { 'data-testid': 'edit-locations' }),
  WeekForm: () => createElement('div', { 'data-testid': 'edit-week' }),
}));
vi.mock('../actions', () => ({
  loadBeautySchedule: async () => ({ data: null }),
  loadBeautyEmployee: async () => ({ employee: null }),
  saveBeautyEmployee: async () => ({}),
}));
vi.mock('../../../components/employee-portal/forms', () => ({
  PortalForm: ({ children }: { children: ReactNode }) => createElement('form', null, children),
  PortalWeek: () => createElement('div', null, 'Редактор графика'),
  PortalWeekView: () => createElement('div', null, 'График'),
}));
vi.mock('../../../components/employee-portal/media', () => ({
  PortalMedia: () => createElement('section', null, 'Фото и работы'),
}));
vi.mock('../../../components/employee-portal/management', () => ({
  PortalManagement: () => createElement('section', null, 'Управление'),
}));
vi.mock('../../../components/tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ label: string; content: ReactNode }> }) => createElement(
    'div',
    null,
    createElement('nav', null, panels.map((panel) => createElement('span', { key: panel.label }, panel.label))),
    panels.map((panel) => createElement('section', { key: panel.label }, panel.content)),
  ),
}));

vi.mock('../../my-work/actions', () => ({ removeEmployeeServicePrice: vi.fn(), saveEmployeeServicePrice: vi.fn() }));

import { MastersBoard } from './board';
import { EmployeeCabinet } from '../../../components/employee-portal/cabinet';

const employee = (active = true): BeautyEmployeeRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Мария Тестова',
  phone: null,
  email: null,
  active,
  serviceIds: ['service-1'],
  locationIds: ['location-1'],
  servicesRevision: 'services-r1',
  profileRevision: 'profile-r1',
});

const services = [{
  id: 'service-1', name: 'Стрижка', category: 'Волосы', durationMinutes: 60,
  priceMinor: '12000', currency: 'KZT', active: true,
  location: null,
  effective: { sellable: true, durationMinutes: 60, priceMinor: '12000', currency: 'KZT', overridden: false },
}] as BeautyServiceRow[];
const locations = [{ id: 'location-1', name: 'Салон на Тестовой', assigned: true }] as BeautySchedule['locations'];
const today = {
  columns: [{ id: employee().id, name: employee().name, intervals: [{ timeFrom: '10:00', timeTo: '18:00' }], timeOff: false }],
  appointments: [],
} as unknown as BeautyDay;

function renderBoard(row = employee()) {
  return renderToStaticMarkup(createElement(MastersBoard, {
    items: [row], services, canEdit: true, today, locations, scopeKey: 'location-1',
    initialEmployeeId: row.id, businessName: 'Тестовый салон', locationName: 'Салон на Тестовой',
  }));
}

function portal(active: boolean): EmployeePortalDto {
  return {
    canUpload: true,
    access: 'MANAGER',
    employee: { id: employee().id, name: employee().name, phone: null, email: null, active, accountLinked: false, profileRevision: 'profile-r1' },
    business: { id: 'business-1', name: 'Тестовый салон', vertical: 'BEAUTY' },
    location: { id: 'location-1', name: 'Салон на Тестовой', timezone: 'Asia/Almaty', currency: 'KZT' },
    profile: { headline: '', biography: '', practiceSinceYear: null, slug: 'maria-testova', published: false, publicationConsent: false, revision: 'public-r1' },
    avatar: null, portfolio: [], services: [], servicesRevision: 'services-r1', week: [], weekRevision: 'week-r1',
    scheduleConflicts: { items: [], checkedFrom: '2026-10-18', checkedCount: 0, truncated: false },
    timeOffs: [], appointments: [], orders: [],
    reviews: { averageStars: null, count: 0, hasMore: false, items: [] },
    pay: {
      month: '2026-10', status: 'NOT_CONFIGURED', model: null, fixedMinor: null,
      percent: null, percentBasis: null, policyRevision: null, earnedMinor: null,
      paidMinor: '0', remainingMinor: null, bonusMinor: null, penaltyMinor: null,
      currency: 'KZT', explanation: '', adjustments: [],
    },
  } as EmployeePortalDto;
}

beforeEach(() => captured.replace.mockClear());

describe('beauty master profile boundary', () => {
  it('opens the canonical master profile directly without a second preview card', () => {
    const html = renderBoard();

    expect(html).toContain('href="/employees/11111111-1111-4111-8111-111111111111/profile"');
    expect(html).not.toContain('data-testid="master-preview"');
    expect(html).not.toContain('Краткая карточка');
    expect(html).not.toContain('Открыть полную карточку');
    expect(html).toContain('Мария Тестова');
    expect(html).toContain('На смене');
  });

  it('keeps active/archive separate from working today', () => {
    const body = (html: string) => html.split('<tbody>')[1]!.split('</tbody>')[0]!;
    const active = body(renderBoard());
    const archived = body(renderBoard(employee(false)));

    // единый экран персонала (20.10.2026): статус строки «На смене» у активного, «В архиве» у архивного, не вместе
    expect(active).toContain('На смене');
    expect(active).not.toContain('>В архиве<');
    expect(archived).toContain('В архиве');
    expect(archived).not.toContain('>На смене<');
    expect(archived).not.toContain('Работает');
  });

  it('keeps all employee management sections in the canonical full profile', () => {
    const html = renderToStaticMarkup(createElement(EmployeeCabinet, {
      initial: portal(true), target: { employeeId: employee().id }, scope: 'business-1:location-1',
    }));

    expect(html).toContain('Активен');
    expect(html).not.toContain('Работает');
    for (const label of ['Профиль', 'Услуги', 'Филиалы', 'График', 'Оплата труда', 'Фото и работы', 'Управление']) {
      expect(html).toContain(label);
    }
  });
});
