import { beforeEach, describe, expect, it, vi } from 'vitest';
import { customerHits, customerQueryReady, matchesCustomerQuery } from '../../lib/customer-hits';

const { deskShell, beautyCustomers, foodCustomers } = vi.hoisted(() => ({
  deskShell: vi.fn(),
  beautyCustomers: vi.fn(),
  foodCustomers: vi.fn(),
}));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../lib/desk-shell', () => ({ deskShell }));
vi.mock('../../lib/api', () => ({ beautyApi: { customers: beautyCustomers } }));
vi.mock('../../lib/food-api', () => ({ foodApi: { customers: foodCustomers } }));
import { searchCustomers } from './search-action';

const row = { id: 'c-1', firstName: 'Тестовая', lastName: 'Клиентка', phone: '+7 700 000 10 01' };

describe('поиск клиентов в шапке салона и ресторана (аудит 22.10.2026 P1-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    beautyCustomers.mockResolvedValue({ items: [row] });
    foodCustomers.mockResolvedValue({ items: [row], nextCursor: null });
  });

  it('салон: клиенты из API салона, ссылка на карточку клиента', async () => {
    deskShell.mockResolvedValue({ vertical: 'BEAUTY' });
    expect(await searchCustomers('  Тест ')).toEqual([
      { id: 'c-1', label: 'Тестовая Клиентка', hint: '+7 700 000 10 01', href: '/customers/c-1' },
    ]);
    expect(beautyCustomers).toHaveBeenCalledWith({ q: 'Тест' });
    expect(foodCustomers).not.toHaveBeenCalled();
  });

  it('ресторан: гости из API ресторана, ссылка открывает карточку гостя (решение 23.10.2026 п. 4)', async () => {
    deskShell.mockResolvedValue({ vertical: 'FOOD_SERVICE' });
    const [hit] = await searchCustomers('700 000');
    expect(foodCustomers).toHaveBeenCalledWith(undefined, '700 000');
    expect(hit?.href).toBe('/customers/c-1');
    expect(beautyCustomers).not.toHaveBeenCalled();
  });

  it('гостиница, короткий запрос и отказ API: пусто, окно поиска не падает', async () => {
    deskShell.mockResolvedValue({ vertical: 'HOSPITALITY' });
    expect(await searchCustomers('Тест')).toEqual([]);
    expect(await searchCustomers('т')).toEqual([]);
    expect(deskShell).toHaveBeenCalledTimes(1);
    deskShell.mockResolvedValue({ vertical: 'BEAUTY' });
    beautyCustomers.mockRejectedValue(new Error('403'));
    expect(await searchCustomers('Тест')).toEqual([]);
  });

  it('не больше пяти строк; салон и ресторан ведут на карточку клиента (решение 23.10.2026 п. 4)', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...row, id: `c-${i}` }));
    expect(customerHits('BEAUTY', many)).toHaveLength(5);
    expect(customerHits('FOOD_SERVICE', [{ ...row, id: 'g-1', phone: null }])[0]?.href).toBe('/customers/g-1');
    expect(customerHits('HOSPITALITY', [{ ...row, phone: null }])[0]?.href).toBe(
      '/customers?q=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%D1%8F+%D0%9A%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BA%D0%B0',
    );
    expect(customerQueryReady(' a ')).toBe(false);
    expect(customerQueryReady('ab')).toBe(true);
  });

  it('ссылка ресторана находит того же гостя в «Клиентах» по телефону и по имени', () => {
    expect(matchesCustomerQuery(row, '+7 700 000 10 01')).toBe(true);
    expect(matchesCustomerQuery(row, '8 700 000')).toBe(true);
    expect(matchesCustomerQuery(row, 'тестовая клиентка')).toBe(true);
    expect(matchesCustomerQuery(row, 'Иванов')).toBe(false);
    expect(matchesCustomerQuery({ ...row, phone: null }, '700')).toBe(false);
    expect(matchesCustomerQuery(row, '  ')).toBe(true);
  });
});
