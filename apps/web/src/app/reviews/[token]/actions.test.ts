import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-error';
import { reviewApi } from './review-api';
import { submitBeautyReview } from './actions';

vi.mock('./review-api', () => ({ reviewApi: { submit: vi.fn() } }));

describe('отправка публичного отзыва', () => {
  beforeEach(() => vi.clearAllMocks());

  it('отправляет выбранных мастеров одной операцией, сохраняя целую оценку', async () => {
    vi.mocked(reviewApi.submit).mockResolvedValue({ status: 'SUBMITTED', submittedCount: 1 });
    const reviews = [{ masterKey: 'master-a', stars: 5, comment: '  Отличная работа  ' }];

    await expect(submitBeautyReview('synthetic-token', reviews)).resolves.toEqual({ submitted: true });
    expect(reviewApi.submit).toHaveBeenCalledWith('synthetic-token', {
      reviews: [{ masterKey: 'master-a', stars: 5, comment: 'Отличная работа' }],
    });
  });

  it('не отправляет пустой выбор', async () => {
    await expect(submitBeautyReview('synthetic-token', [])).resolves.toEqual({
      error: 'Выберите хотя бы одного мастера и поставьте оценку.',
    });
    expect(reviewApi.submit).not.toHaveBeenCalled();
  });

  it('объясняет single-use конфликт без повторной отправки', async () => {
    vi.mocked(reviewApi.submit).mockRejectedValue(new ApiError(409, 'Отзыв уже отправлен'));
    await expect(submitBeautyReview('synthetic-token', [{ masterKey: 'master-a', stars: 4 }])).resolves.toEqual({
      error: 'Отзыв по этой ссылке уже отправлен.',
    });
  });
});
