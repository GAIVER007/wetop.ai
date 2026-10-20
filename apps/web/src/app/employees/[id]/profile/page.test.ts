import type { ReactElement } from 'react';
import type { BeautyPermission } from '@pms/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  deskShell: vi.fn(),
  schedule: vi.fn(),
  day: vi.fn(),
  servicePrices: vi.fn(),
  members: vi.fn(),
  accountOptions: vi.fn(),
  sessionToken: vi.fn(),
  clientInfo: vi.fn(),
}));

vi.mock('../../../../lib/vertical-guard', () => ({ requireFeature: deps.requireFeature }));
vi.mock('../../../../lib/desk-shell', () => ({ deskShell: deps.deskShell }));
vi.mock('../../../../lib/api', () => ({
  authApi: { members: deps.members },
  beautyApi: {
    schedule: deps.schedule,
    day: deps.day,
    employeeServicePrices: deps.servicePrices,
  },
}));
vi.mock('../../../../lib/session', () => ({
  sessionToken: deps.sessionToken,
  clientInfo: deps.clientInfo,
}));
vi.mock('../../../../lib/employee-portal-api', () => ({
  employeePortalApi: { accountOptions: deps.accountOptions },
}));
vi.mock('../../../../components/employee-portal/screen', () => ({
  EmployeePortalScreen: () => null,
}));
vi.mock('next/navigation', () => ({ unstable_rethrow() {} }));

import EmployeeProfilePage from './page';

const permission = (
  section: BeautyPermission['section'],
  action: BeautyPermission['action'],
): BeautyPermission => ({ section, action, scope: 'BUSINESS' });

function shell(permissions: BeautyPermission[]) {
  return {
    vertical: 'BEAUTY' as const,
    scopeKey: 'business-1:location-1',
    readOnly: false,
    person: null,
    trial: null,
    tourKey: null,
    access: {
      role: 'STAFF' as const,
      platform: false,
      aiSeller: false,
      beautyAccess: {
        mode: 'ASSIGNED' as const,
        assigned: true,
        permissions,
      },
    },
  };
}

async function load(permissions: BeautyPermission[]) {
  deps.deskShell.mockResolvedValue(shell(permissions));
  return await EmployeeProfilePage({
    params: Promise.resolve({ id: 'employee-1' }),
    searchParams: Promise.resolve({}),
  }) as ReactElement<Record<string, unknown>>;
}

describe('Beauty canonical employee profile loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deps.requireFeature.mockResolvedValue(undefined);
    deps.schedule.mockResolvedValue({ locations: [{ id: 'location-1', name: 'Салон', assigned: true }] });
    deps.day.mockResolvedValue({
      columns: [{
        id: 'employee-1',
        timeOff: false,
        intervals: [{ timeFrom: '10:00', timeTo: '18:00' }],
      }],
    });
    deps.servicePrices.mockResolvedValue([{ serviceId: 'service-1' }]);
    deps.sessionToken.mockResolvedValue('synthetic-session');
    deps.clientInfo.mockResolvedValue({});
    deps.members.mockResolvedValue([{
      userId: 'member-1',
      email: 'master@example.invalid',
      name: 'Synthetic Master',
      position: 'Мастер',
      role: 'OWNER',
      scopes: [],
      suspended: false,
    }]);
    deps.accountOptions.mockResolvedValue([{
      userId: 'member-1',
      email: 'master@example.invalid',
      name: 'Synthetic Master',
    }]);
  });

  it('loads branch assignments and account choices from employees.update without legacy staff rights', async () => {
    const page = await load([permission('employees', 'update')]);

    expect(deps.schedule).toHaveBeenCalledWith('employee-1');
    expect(deps.accountOptions).toHaveBeenCalledWith('employee-1');
    expect(deps.members).not.toHaveBeenCalled();
    expect(page.props.locationAssignments).toEqual([
      { id: 'location-1', name: 'Салон', assigned: true },
    ]);
    expect(page.props.accountOptions).toEqual([{
      userId: 'member-1',
      label: 'Synthetic Master, master@example.invalid',
    }]);
    expect(deps.servicePrices).not.toHaveBeenCalled();
    expect(page.props.servicePrices).toBeUndefined();
  });

  it('loads master prices only from services.update', async () => {
    const page = await load([permission('services', 'update')]);

    expect(deps.servicePrices).toHaveBeenCalledWith('employee-1');
    expect(page.props.servicePrices).toEqual([{ serviceId: 'service-1' }]);
    expect(deps.schedule).not.toHaveBeenCalled();
    expect(deps.members).not.toHaveBeenCalled();
    expect(page.props.locationAssignments).toBeUndefined();
    expect(page.props.accountOptions).toBeUndefined();
  });

  it('loads today status only with journal.view', async () => {
    const allowed = await load([permission('journal', 'view')]);

    expect(deps.day).toHaveBeenCalledOnce();
    expect(allowed.props.dayStatus).toEqual({ state: 'ON_SHIFT', hours: '10:00–18:00' });

    vi.clearAllMocks();
    const denied = await load([permission('employees', 'view')]);

    expect(deps.day).not.toHaveBeenCalled();
    expect(denied.props.dayStatus).toEqual({ state: 'UNAVAILABLE', hours: null });
  });

  it('reports an unavailable schedule when the authorized day request fails', async () => {
    deps.day.mockRejectedValue(new Error('Synthetic day failure'));

    const page = await load([permission('journal', 'view')]);

    expect(deps.day).toHaveBeenCalledOnce();
    expect(page.props.dayStatus).toEqual({ state: 'UNAVAILABLE', hours: null });
  });
});
