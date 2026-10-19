import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authApi, beautyApi } from '../../../lib/api';
import {
  assignBeautyPosition,
  createBeautyPosition,
  revokeBeautyPosition,
} from './position-actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  authApi: { me: vi.fn() },
  beautyApi: {
    positions: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    archivePosition: vi.fn(),
    assignPosition: vi.fn(),
    revokePosition: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const businessId = '21111111-1111-4111-8111-111111111111';
const locationId = '31111111-1111-4111-8111-111111111111';
const scopeKey = JSON.stringify({ organizationId, businessId, locationId });
const emptyWorkspace = { businessId, positions: [], assignments: [], members: [], locations: [] };

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe('Beauty position server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({
      user: { organizationId },
      context: { businessId, locationId },
    } as never);
    vi.mocked(beautyApi.positions).mockResolvedValue(emptyWorkspace);
  });

  it('blocks a stale captured salon before any position API mutation or reload', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { organizationId },
      context: { businessId, locationId: 'another-location' },
    } as never);

    const result = await createBeautyPosition(null, form({
      scopeKey,
      positionName: 'Администратор',
      permissions: JSON.stringify([
        { section: 'appointments', action: 'view', scope: 'BUSINESS' },
      ]),
    }));

    expect(result).toMatchObject({
      error: expect.stringContaining('Контекст изменён'),
      values: { name: 'Администратор' },
    });
    expect(beautyApi.createPosition).not.toHaveBeenCalled();
    expect(beautyApi.updatePosition).not.toHaveBeenCalled();
    expect(beautyApi.archivePosition).not.toHaveBeenCalled();
    expect(beautyApi.assignPosition).not.toHaveBeenCalled();
    expect(beautyApi.revokePosition).not.toHaveBeenCalled();
    expect(beautyApi.positions).not.toHaveBeenCalled();
  });

  it('sends explicit permissions, then reloads the current workspace', async () => {
    vi.mocked(beautyApi.createPosition).mockResolvedValue({
      id: 'position-id', name: 'Администратор', revision: 1, archivedAt: null, permissions: [],
    } as never);
    const permissions = [
      { section: 'appointments', action: 'view', scope: 'BUSINESS' },
      { section: 'finance', action: 'refund', scope: 'BUSINESS' },
    ];

    const result = await createBeautyPosition(null, form({
      scopeKey,
      positionName: ' Администратор ',
      permissions: JSON.stringify(permissions),
    }));

    expect(beautyApi.createPosition).toHaveBeenCalledWith({
      name: 'Администратор',
      permissions,
    });
    expect(beautyApi.positions).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ workspace: emptyWorkspace, message: 'Должность создана' });
  });

  it('accepts a business-wide captured scope with no selected location', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { organizationId },
      context: { businessId },
    } as never);
    vi.mocked(beautyApi.createPosition).mockResolvedValue({
      id: 'position-id', name: 'Администратор', revision: 1, archivedAt: null, permissions: [],
    } as never);
    const businessScopeKey = JSON.stringify({ organizationId, businessId, locationId: null });

    const result = await createBeautyPosition(null, form({
      scopeKey: businessScopeKey,
      positionName: 'Администратор',
      permissions: JSON.stringify([
        { section: 'appointments', action: 'view', scope: 'BUSINESS' },
      ]),
    }));

    expect(beautyApi.createPosition).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ workspace: emptyWorkspace, message: 'Должность создана' });
  });

  it('does not invite a duplicate retry when the mutation succeeded but refresh failed', async () => {
    vi.mocked(beautyApi.createPosition).mockResolvedValue({
      id: 'position-id', name: 'Администратор', revision: 1, archivedAt: null, permissions: [],
    } as never);
    vi.mocked(beautyApi.positions).mockRejectedValue(new ApiError(503, 'Список временно недоступен'));

    const result = await createBeautyPosition(null, form({
      scopeKey,
      positionName: 'Администратор',
      permissions: JSON.stringify([
        { section: 'appointments', action: 'view', scope: 'BUSINESS' },
      ]),
    }));

    expect(beautyApi.createPosition).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      message: expect.stringContaining('сохранено'),
      error: expect.stringContaining('Обновите страницу'),
    });
    expect(result?.error).not.toContain('Не удалось создать');
  });

  it('preserves assignment choices when the API reports a stale revision', async () => {
    vi.mocked(beautyApi.assignPosition).mockRejectedValue(
      new ApiError(409, 'Назначение изменено. Обновите данные.'),
    );
    const values = {
      scopeKey,
      assignmentUserId: '41111111-1111-4111-8111-111111111111',
      assignmentPositionId: '51111111-1111-4111-8111-111111111111',
      assignmentLocationId: locationId,
      expectedRevision: '2',
    };

    const result = await assignBeautyPosition(null, form(values));

    expect(result).toMatchObject({
      error: 'Назначение изменено. Обновите данные.',
      values: {
        userId: values.assignmentUserId,
        positionId: values.assignmentPositionId,
        locationId,
      },
    });
    expect(beautyApi.positions).not.toHaveBeenCalled();
  });

  it('revokes only the selected historical assignment with its exact revision', async () => {
    vi.mocked(beautyApi.revokePosition).mockResolvedValue({
      id: '61111111-1111-4111-8111-111111111111',
      userId: '41111111-1111-4111-8111-111111111111',
      locationId,
      positionId: '51111111-1111-4111-8111-111111111111',
      revision: 4,
      revokedAt: '2026-10-18T10:00:00.000Z',
    });

    const result = await revokeBeautyPosition(null, form({
      scopeKey,
      assignmentId: '61111111-1111-4111-8111-111111111111',
      expectedRevision: '3',
    }));

    expect(beautyApi.revokePosition).toHaveBeenCalledWith(
      '61111111-1111-4111-8111-111111111111',
      3,
    );
    expect(result).toMatchObject({ workspace: emptyWorkspace, message: 'Назначение отозвано' });
  });
});
