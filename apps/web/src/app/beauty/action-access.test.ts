import type { BeautyPermission } from '@pms/domain';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';

const state = vi.hoisted(() => ({
  access: {} as Record<string, unknown>,
  role: 'MANAGER',
  day: vi.fn(),
  period: vi.fn(),
  customers: vi.fn(),
  employees: vi.fn(),
  services: vi.fn(),
  schedule: vi.fn(),
  locationHours: vi.fn(),
  reminderSettings: vi.fn(),
  bonusProgram: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect(url: string) {
    throw new Error(`redirect ${url}`);
  },
  unstable_rethrow() {},
  useRouter: () => ({ refresh() {}, replace() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/calendar',
}));
vi.mock('../../lib/vertical-guard', () => ({
  requireFeature: async () => ({ context: { vertical: 'BEAUTY' } }),
}));
vi.mock('../../lib/desk-shell', () => ({
  deskShell: async () => ({ access: state.access, readOnly: false, scopeKey: 'business:location' }),
  currentMe: async () => ({
    user: { role: state.role, organizationId: 'synthetic-org' },
    context: { vertical: 'BEAUTY', businessId: 'synthetic-business', locationId: 'synthetic-location' },
  }),
}));
vi.mock('../../lib/staff-revenue-load', () => ({ loadStaffRevenue: async () => null, StaffRevenuePeriodNav: () => null }));
vi.mock('../../lib/api', () => ({
  sharedOnboardingApi: { status: async () => ({ vertical: 'BEAUTY', completedAt: '2026-10-01T00:00:00Z' }) },
  beautyApi: {
    day: state.day,
    period: state.period,
    customers: state.customers,
    employees: state.employees,
    services: state.services,
    schedule: state.schedule,
    locationHours: state.locationHours,
    reminderSettings: state.reminderSettings,
    bonusProgram: state.bonusProgram,
  },
}));
vi.mock('../beauty-settings/loyalty-forms', () => ({
  ReminderSettingsForm: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'reminders-update', 'data-allowed': String(props.canEdit) }),
  BonusProgramForm: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'bonus-update', 'data-allowed': String(props.canEdit) }),
}));
vi.mock('./journal', () => ({
  JournalBoard: (props: Record<string, unknown>) => createElement('div', {
    'data-testid': 'journal-flags',
    'data-create': String(props.canCreate),
    'data-update': String(props.canUpdate),
    'data-pay': String(props.canPay),
    'data-refund': String(props.canRefund),
    'data-review': String(props.canIssueReview),
    'data-price': String(props.canAdjustPrice),
  }),
}));
vi.mock('../appointments/list', () => ({
  AppointmentsList: (props: Record<string, unknown>) => createElement('div', {
    'data-testid': 'appointment-flags',
    'data-create': String(props.canCreate),
    'data-update': String(props.canUpdate),
    'data-pay': String(props.canPay),
    'data-refund': String(props.canRefund),
    'data-review': String(props.canIssueReview),
    'data-price': String(props.canAdjustPrice),
  }),
}));
vi.mock('../customers/customer-tools', () => ({
  BeautyCustomerTools: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'customer-create', 'data-allowed': String(props.canEdit) }),
}));
vi.mock('../customers/beauty-table', () => ({
  BeautyCustomersTable: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'customer-update', 'data-allowed': String(props.canEdit) }, props.tools as never),
}));
vi.mock('./services/board', () => ({
  ServicesBoard: (props: Record<string, unknown>) => createElement('div', {
    'data-testid': 'service-flags',
    'data-create': String(props.canCreate),
    'data-update': String(props.canUpdate),
    'data-delete': String(props.canDelete),
  }),
}));
vi.mock('./masters/board', () => ({
  MastersBoard: (props: Record<string, unknown>) => createElement('div', {
    'data-testid': 'master-flags',
    'data-create': String(props.canCreate),
    'data-update': String(props.canUpdate),
    'data-prices': String(props.canManagePrices),
  }),
}));
vi.mock('../beauty-settings/hours-form', () => ({
  SalonHoursForm: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'settings-update', 'data-allowed': String(props.canEdit) }),
}));
vi.mock('../../components/use-confirm', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
vi.mock('./journal-actions', () => ({
  moveAppointment: vi.fn(),
  customerBonusQuote: vi.fn(),
  lookupCertificate: vi.fn(),
  payAppointment: vi.fn(),
  refundAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
}));
vi.mock('./appointment-editor', () => ({ AppointmentEditor: () => null }));
vi.mock('./appointment-history-panel', () => ({ AppointmentHistoryPanel: () => null }));
vi.mock('./review-invitation', () => ({ ReviewInvitation: () => null }));

import AppointmentsPage from '../appointments/page';
import BeautySettingsPage from '../beauty-settings/page';
import CustomersPage from '../customers/page';
import { AppointmentCard } from './appointment-card';
import BeautyPage from './page';
import BeautyMastersPage from './masters/page';
import BeautyServicesPage from './services/page';

const day: BeautyDay = {
  location: { id: 'synthetic-location', name: 'Synthetic Salon', timezone: 'UTC', currency: 'USD' },
  date: '2026-10-18',
  columns: [{
    id: 'synthetic-master',
    name: 'Synthetic Master',
    intervals: [{ timeFrom: '09:00', timeTo: '18:00' }],
    timeOff: false,
    timeOffReason: null,
    serviceIds: ['synthetic-service'],
  }],
  appointments: [],
  services: [],
  bounds: { fromMinutes: 540, toMinutes: 1080 },
};

const permission = (
  section: BeautyPermission['section'],
  action: BeautyPermission['action'],
): BeautyPermission => ({ section, action, scope: 'BUSINESS' });

function assigned(permissions: BeautyPermission[], role = 'MANAGER') {
  state.role = role;
  state.access = {
    aiSeller: false,
    platform: false,
    role,
    beautyAccess: { mode: 'ASSIGNED', assigned: true, permissions },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.day.mockResolvedValue(day);
  state.period.mockResolvedValue({
    period: { from: day.date, to: day.date },
    location: day.location,
    appointments: [],
  });
  state.customers.mockResolvedValue({ items: [] });
  state.employees.mockResolvedValue({ locationId: day.location.id, items: [] });
  state.services.mockResolvedValue({ locationId: day.location.id, locationCurrency: 'USD', items: [] });
  state.schedule.mockResolvedValue({ businessName: 'Synthetic Business', location: day.location, locations: [] });
  state.locationHours.mockResolvedValue({ location: day.location, weekdays: [] });
  state.reminderSettings.mockResolvedValue({ revision: 0, enabled: true, hoursBefore: [24, 2], template: null, whatsappTemplateName: null });
  state.bonusProgram.mockResolvedValue({ revision: 0, enabled: false, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null });
});

describe('Beauty page action access', () => {
  it.each(['journal', 'appointments'] as const)('lets a custom STAFF administrator issue review links from %s', async section => {
    assigned([permission(section, 'view'), permission('reviews', 'create')], 'STAFF');
    const props = {searchParams: Promise.resolve({date: day.date})};
    const html = renderToStaticMarkup(await (section === 'journal' ? BeautyPage(props) : AppointmentsPage(props)));
    expect(html).toContain('data-review="true"');
  });
  it('opens a read-only calendar without loading customer or employee catalogs', async () => {
    assigned([permission('journal', 'view')]);

    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: day.date }) }));

    expect(state.day).toHaveBeenCalledOnce();
    expect(state.customers).not.toHaveBeenCalled();
    expect(state.employees).not.toHaveBeenCalled();
    expect(html).toContain('data-testid="journal-flags"');
    expect(html).toContain('data-create="false"');
    expect(html).toContain('data-update="false"');
    expect(html).toContain('data-pay="false"');
    expect(html).toContain('data-refund="false"');
    expect(html).toContain('data-review="false"');
    expect(html).toContain('data-price="false"');
  });

  it('loads appointments without journal access and exposes only an explicit refund action', async () => {
    assigned([
      permission('appointments', 'view'),
      permission('finance', 'refund'),
    ], 'STAFF');

    const html = renderToStaticMarkup(await AppointmentsPage({
      searchParams: Promise.resolve({ from: day.date, to: day.date }),
    }));

    expect(state.day).not.toHaveBeenCalled();
    expect(state.period).toHaveBeenCalledWith(day.date, day.date);
    expect(state.customers).not.toHaveBeenCalled();
    expect(state.employees).not.toHaveBeenCalled();
    expect(html).toContain('data-testid="appointment-flags"');
    expect(html).toContain('data-create="false"');
    expect(html).toContain('data-update="false"');
    expect(html).toContain('data-pay="false"');
    expect(html).toContain('data-refund="true"');
    expect(html).toContain('data-review="false"');
    expect(html).toContain('data-price="false"');
  });

  it('separates customer creation from customer updates for a legacy manager role', async () => {
    assigned([
      permission('customers', 'view'),
      permission('customers', 'update'),
    ]);

    const html = renderToStaticMarkup(await CustomersPage());

    expect(html).toContain('data-testid="customer-create" data-allowed="false"');
    expect(html).toContain('data-testid="customer-update" data-allowed="true"');
  });

  it('separates service catalog create, update and delete actions', async () => {
    assigned([
      permission('services', 'view'),
      permission('services', 'update'),
    ]);

    const html = renderToStaticMarkup(await BeautyServicesPage());

    expect(html).toContain('data-testid="service-flags"');
    expect(html).toContain('data-create="false"');
    expect(html).toContain('data-update="true"');
    expect(html).toContain('data-delete="false"');
  });

  it('separates employee writes from master price updates', async () => {
    assigned([
      permission('employees', 'view'),
      permission('services', 'view'),
      permission('services', 'update'),
      permission('journal', 'view'),
    ]);

    const html = renderToStaticMarkup(await BeautyMastersPage());

    expect(html).toContain('data-testid="master-flags"');
    expect(html).toContain('data-create="false"');
    expect(html).toContain('data-update="false"');
    expect(html).toContain('data-prices="true"');
  });

  it('keeps salon hours read-only without settings.update', async () => {
    assigned([permission('settings', 'view')]);

    // единый вход в настройки (PR 879): режим, напоминания и бонусы открываются каждый своим разделом
    const render = async (section: string) =>
      renderToStaticMarkup(await BeautySettingsPage({ searchParams: Promise.resolve({ section }) }));

    expect(await render('hours')).toContain('data-testid="settings-update" data-allowed="false"');
    // напоминания и бонусы (решение 21.10.2026) под тем же правом settings.update
    expect(await render('reminders')).toContain('data-testid="reminders-update" data-allowed="false"');
    expect(await render('bonuses')).toContain('data-testid="bonus-update" data-allowed="false"');
  });
});

describe('Appointment card action access', () => {
  it('shows an authorized refund without leaking create, update, payment or price actions', () => {
    const row: BeautyAppointmentRow = {
      id: 'synthetic-appointment',
      employeeId: 'synthetic-master',
      serviceId: 'synthetic-service',
      serviceName: 'Synthetic service',
      customer: { id: 'synthetic-customer', name: 'Synthetic Customer', phone: null },
      startsAt: '2026-10-18T10:00:00.000Z',
      endsAt: '2026-10-18T11:00:00.000Z',
      startMinutes: 600,
      endMinutes: 660,
      status: 'DONE',
      next: ['BOOKED'],
      priceMinor: '20000',
      paidMinor: '12345',
      refundedMinor: '0',
      currency: 'USD',
      notes: null,
    };
    const html = renderToStaticMarkup(createElement(AppointmentCard as never, {
      day: { ...day, appointments: [row] },
      row,
      canCreate: false,
      canUpdate: false,
      canPay: false,
      canRefund: true,
      canIssueReview: false,
      canAdjustPrice: false,
      onDone: vi.fn(),
    }));

    expect(html).toContain('aria-label="Возврат по записи"');
    expect(html).not.toContain('Повторить запись');
    expect(html).not.toContain('aria-label="Редактирование услуг"');
    expect(html).not.toContain('aria-label="Оплата записи"');
    expect(html).not.toContain('<h3>Перенести</h3>');
  });
});
