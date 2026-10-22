import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodCustomer } from '../../lib/food-types';

const { customers, reservations, shell } = vi.hoisted(() => ({
  customers: vi.fn(),
  reservations: vi.fn(),
  shell: vi.fn(),
}));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn(), useRouter: () => ({ refresh() {} }) }));
vi.mock('./restaurant-load', () => ({ restaurantShell: shell }));
vi.mock('../../lib/food-api', () => ({ foodApi: { customers, reservations } }));
vi.mock('./customer-marks', () => ({ CustomerMarks: () => null }));
vi.mock('../../components/tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ id: string; content: unknown }> }) =>
    panels.find((p) => p.id === 'all')?.content ?? null,
}));
import { FoodCustomers } from './customers';

const guest: FoodCustomer = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Тестовый',
  lastName: 'Гость',
  phone: '+7 700 000 30 03',
  status: 'ACTIVE',
  visits: 0,
};
const render = async (query = '') => renderToStaticMarkup(await FoodCustomers({ query }));

describe('«Клиенты» ресторана: панель действий как в салоне (аудит 22.10.2026 P1-5)', () => {
  beforeEach(() => {
    shell.mockResolvedValue({
      date: '2026-10-22', timezone: 'Asia/Almaty', scopeKey: 'b:l', readOnly: false, canDesk: true,
    });
    customers.mockResolvedValue({ items: [guest], nextCursor: null });
    reservations.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('поиск по имени или телефону и «Добавить клиента» через новую бронь', async () => {
    const html = await render();
    expect(html).toContain('data-testid="food-customers-bar"');
    expect(html).toMatch(/<form[^>]*action="\/customers"[^>]*method="get"|<form[^>]*method="get"[^>]*action="\/customers"/);
    expect(html).toMatch(/<input[^>]*name="q"/);
    expect(html).toMatch(/<a[^>]*href="\/table-reservations\?new=1"[^>]*>Добавить клиента<\/a>/);
  });

  it('пустой список: первое действие «Создать первую бронь», а не голый текст', async () => {
    customers.mockResolvedValue({ items: [], nextCursor: null });
    const html = await render();
    expect(html).toContain('Клиенты появятся после первого бронирования');
    expect(html).toMatch(/<a[^>]*href="\/table-reservations\?new=1"[^>]*>Создать первую бронь<\/a>/);
  });

  it('только чтение: панели действий нет, поиск остаётся', async () => {
    shell.mockResolvedValue({
      date: '2026-10-22', timezone: 'Asia/Almaty', scopeKey: 'b:l', readOnly: true, canDesk: true,
    });
    const html = await render();
    expect(html).toMatch(/<input[^>]*name="q"/);
    expect(html).not.toContain('Добавить клиента');
  });

  it('запрос из поиска в шапке подставлен в поле и сужает список', async () => {
    const html = await render('Гость');
    expect(html).toMatch(/<input[^>]*name="q"[^>]*value="Гость"/);
    expect(html).toContain('Найдено по запросу «Гость»: 1');
  });
});
