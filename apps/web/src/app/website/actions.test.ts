import { afterEach, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { analyticsApi, type TrackedSiteCard } from '../../lib/api';
import { bookingSettingsAction, hostsAction, siteAction } from './actions';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it.each(['pause', 'widget', 'hosts'])(
  'обновляет все вкладки «Сайта и онлайн-бронирования» после %s',
  async (action) => {
    const card = { site: { bookingEnabled: false, hosts: ['example.invalid'] } } as TrackedSiteCard;
    vi.spyOn(analyticsApi, 'update').mockResolvedValue(card);
    if (action === 'pause') await siteAction('site', 'pause');
    if (action === 'widget')
      await bookingSettingsAction('site', { enabled: false, ratePlanCode: '' });
    if (action === 'hosts') await hostsAction('site', 'example.invalid');
    for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings']) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  },
);
