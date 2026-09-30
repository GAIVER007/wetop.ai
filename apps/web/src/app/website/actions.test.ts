import { afterEach, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { analyticsApi, type TrackedSiteCard } from '../../lib/api';
import { addDomainAction, bookingSettingsAction, removeDomainAction, siteAction } from './actions';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it.each(['pause', 'widget', 'domain'])(
  'обновляет все вкладки «Сайта и онлайн-бронирования» после %s',
  async (action) => {
    const card = { site: { bookingEnabled: false, hosts: ['example.invalid'] } } as TrackedSiteCard;
    vi.spyOn(analyticsApi, 'update').mockResolvedValue(card);
    vi.spyOn(analyticsApi, 'card').mockResolvedValue(card);
    if (action === 'pause') await siteAction('site', 'pause');
    if (action === 'widget')
      await bookingSettingsAction('site', { enabled: false, ratePlanCode: '' });
    if (action === 'domain') await addDomainAction('site', 'luxxaparts.kz');
    for (const path of [
      '/website',
      '/website/booking',
      '/website/analytics',
      '/website/settings',
    ]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  },
);

const withHosts = (hosts: string[]) =>
  ({ site: { id: 'site', hosts, bookingEnabled: false } }) as unknown as TrackedSiteCard;

it('добавление домена читает список заново и убирает заглушку', async () => {
  vi.spyOn(analyticsApi, 'card').mockResolvedValue(withHosts(['luxx-aparts.example']));
  const update = vi.spyOn(analyticsApi, 'update').mockResolvedValue(withHosts(['luxxaparts.kz']));
  const result = await addDomainAction('site', 'https://www.luxxaparts.kz/');
  expect(update).toHaveBeenCalledWith('site', { hosts: ['luxxaparts.kz'] });
  expect(result.error).toBeNull();
  expect(result.message).toContain('luxxaparts.kz');
  expect(result.message).toContain('luxx-aparts.example');
});

it('неверный адрес не уходит в API', async () => {
  const update = vi.spyOn(analyticsApi, 'update');
  const result = await addDomainAction('site', 'luxx aparts');
  expect(update).not.toHaveBeenCalled();
  expect(result.error).toContain('Не похоже на адрес сайта');
});

it('последний домен не убирается', async () => {
  vi.spyOn(analyticsApi, 'card').mockResolvedValue(withHosts(['luxxaparts.kz']));
  const update = vi.spyOn(analyticsApi, 'update');
  const result = await removeDomainAction('site', 'luxxaparts.kz');
  expect(update).not.toHaveBeenCalled();
  expect(result.error).toContain('хотя бы один адрес');
});

it('убранный домен уходит из списка, остальные на месте', async () => {
  vi.spyOn(analyticsApi, 'card').mockResolvedValue(withHosts(['luxxaparts.kz', 'promo.kz']));
  const update = vi.spyOn(analyticsApi, 'update').mockResolvedValue(withHosts(['luxxaparts.kz']));
  const result = await removeDomainAction('site', 'promo.kz');
  expect(update).toHaveBeenCalledWith('site', { hosts: ['luxxaparts.kz'] });
  expect(result.message).toContain('promo.kz');
});

it('сообщения о бронировании говорят, что увидит гость и где код (WEB3)', async () => {
  const plan = { id: 'p', code: 'BASE', name: 'Стандартный' };
  vi.spyOn(analyticsApi, 'update').mockResolvedValueOnce({
    site: { id: 'site', hosts: ['myhotel.kz'], bookingEnabled: true, bookingRatePlan: plan },
  } as unknown as TrackedSiteCard);
  const on = await bookingSettingsAction('site', { enabled: true, ratePlanCode: 'BASE' });
  expect(on.message).toBe(
    'Бронирование с сайта включено, тариф «Стандартный». Код для сайта — в «Установке виджета»',
  );
  vi.spyOn(analyticsApi, 'update').mockResolvedValueOnce(withHosts(['myhotel.kz']));
  const off = await bookingSettingsAction('site', { enabled: false, ratePlanCode: '' });
  expect(off.message).toBe(
    'Бронирование с сайта выключено: форма на сайте останется, но цены и брони не покажет',
  );
});
