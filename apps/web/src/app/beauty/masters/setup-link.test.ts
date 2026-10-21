import { beforeEach, describe, expect, it, vi } from 'vitest';

const status = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ unstable_rethrow() {} }));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('../../../lib/api', () => ({ sharedOnboardingApi: { status } }));

import { salonSetupPending } from './setup-link';

beforeEach(() => { status.mockReset(); });

// «Вернуться к настройке салона» только при незавершённой настройке или по пути из чек-листа (аудит 21.10.2026, п. 17)
describe('ссылка к настройке салона', () => {
  it('настройка пройдена: ссылки нет', async () => {
    status.mockResolvedValue({ vertical: 'BEAUTY', completedAt: '2026-10-01T10:00:00Z' });
    expect(await salonSetupPending(false)).toBe(false);
  });
  it('настройка не завершена: ссылка есть', async () => {
    status.mockResolvedValue({ vertical: 'BEAUTY', completedAt: null });
    expect(await salonSetupPending(false)).toBe(true);
  });
  it('пришли из чек-листа (?onboarding=1): ссылка есть без запроса', async () => {
    expect(await salonSetupPending(true)).toBe(true);
    expect(status).not.toHaveBeenCalled();
  });
  it('сводку не прочитали: ссылки нет, страница не падает', async () => {
    status.mockImplementation(async () => {
      throw new Error('offline');
    });
    const pending = await salonSetupPending(false);
    expect(pending).toBe(false);
  });
});
