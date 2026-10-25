import { beforeEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
import { authApi, beautyApi } from '../../lib/api';
import { issueReviewInvitation } from './review-invitation-actions';

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  authApi: { me: vi.fn() },
  beautyApi: { issueReviewInvitation: vi.fn() },
}));

const scope = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  businessId: '21111111-1111-4111-8111-111111111111',
  locationId: '31111111-1111-4111-8111-111111111111',
};

const form = () => {
  const value = new FormData();
  value.set('appointmentId', '41111111-1111-4111-8111-111111111111');
  value.set('scopeKey', JSON.stringify(scope));
  return value;
};

describe('создание ссылки на отзыв', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({
      user: { organizationId: scope.organizationId },
      context: { businessId: scope.businessId, locationId: scope.locationId },
    } as never);
  });

  it('создаёт ссылку только для записи исходного филиала', async () => {
    const invitation = { reviewPath: '/reviews/synthetic-token', expiresAt: '2026-11-17T12:00:00.000Z', masterCount: 2 };
    vi.mocked(beautyApi.issueReviewInvitation).mockResolvedValue(invitation);
    await expect(issueReviewInvitation(null, form())).resolves.toEqual({ invitation });
    expect(beautyApi.issueReviewInvitation).toHaveBeenCalledWith('41111111-1111-4111-8111-111111111111');
  });

  it('не создаёт ссылку после смены филиала', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { organizationId: scope.organizationId },
      context: { businessId: scope.businessId, locationId: 'another-location' },
    } as never);
    await expect(issueReviewInvitation(null, form())).resolves.toMatchObject({ error: expect.stringContaining('Контекст изменён') });
    expect(beautyApi.issueReviewInvitation).not.toHaveBeenCalled();
  });
});
