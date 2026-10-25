import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const status = vi.hoisted(() => vi.fn());
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../../i18n/server', async () => ({ serverT: async () => (await import('../../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }));
vi.mock('../../../lib/vertical-guard', () => ({ requireFeature: async () => ({}) }));
vi.mock('../../../lib/desk-shell', () => ({ deskShell: async () => ({ readOnly: false, access: { role: 'OWNER' } }) }));
vi.mock('../../../lib/navigation', () => ({ mayBeautyAccess: () => true }));
vi.mock('../../../lib/api', () => ({
  sharedOnboardingApi: { status },
  beautyApi: { services: async () => ({ items: [], locationId: 'l', locationCurrency: 'KZT' }) },
}));
vi.mock('./board', () => ({ ServicesBoard: () => createElement('div', null, 'board') }));

import BeautyServicesPage from './page';

/** Аудит 21.10.2026 п.21: «Вернуться к настройке салона» только пока настройка не завершена */
describe('ссылка на настройку салона на странице услуг', () => {
  it('видна, пока настройка идёт', async () => {
    status.mockResolvedValue({ vertical: 'BEAUTY', completedAt: null });
    expect(renderToStaticMarkup(await BeautyServicesPage())).toContain('Вернуться к настройке салона');
  });
  it('скрыта после завершения настройки и при ошибке чтения', async () => {
    status.mockResolvedValue({ vertical: 'BEAUTY', completedAt: '2026-10-01T00:00:00Z' });
    expect(renderToStaticMarkup(await BeautyServicesPage())).not.toContain('Вернуться к настройке салона');
    status.mockRejectedValue(new Error('нет'));
    expect(renderToStaticMarkup(await BeautyServicesPage())).not.toContain('Вернуться к настройке салона');
  });
});
