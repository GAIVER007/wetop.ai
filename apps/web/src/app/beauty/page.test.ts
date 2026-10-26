import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));

const { day, period } = vi.hoisted(() => ({ day: vi.fn(), period: vi.fn() }));
vi.mock('../../lib/vertical-guard', () => ({ requireVertical: async () => ({}), requireFeature: async () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams() }));
// оболочка как у настоящей: права нужны странице (возврат по записи, §54)
vi.mock('../../lib/desk-shell', async () => {
  const { UNKNOWN_SHELL } = await import('../../lib/desk-person');
  return {
    deskShell: async () => ({ ...UNKNOWN_SHELL, readOnly: false }),
    currentMe: async () => ({ user: { organizationId: 'synthetic-org' }, context: { businessId: 'synthetic-salon', locationId: 'salon' } }),
  };
});
vi.mock('../../lib/api', () => ({ beautyApi: {
  day, period, customers: async () => ({ items: [] }), employees: async () => ({ items: [] }),
} }));
vi.mock('./journal', () => ({ JournalBoard: () => createElement('div', null, 'Журнал дня') }));
const prefetchFlags: unknown[] = [];
vi.mock('next/link', () => ({
  default: ({ prefetch, ...props }: { prefetch?: boolean; href: string; children?: unknown }) => {
    prefetchFlags.push(prefetch);
    return createElement('a', props as Record<string, unknown>);
  },
}));
import BeautyPage from './page';

const row = (id: string, localDate: string, startMinutes: number, name: string) => ({
  id, localDate, employeeId: 'm1', serviceId: 's1', serviceName: 'Стрижка', customer: { id: `c-${id}`, name, phone: null },
  startsAt: `${localDate}T05:00:00.000Z`, endsAt: `${localDate}T06:00:00.000Z`, startMinutes, endMinutes: startMinutes + 60,
  status: 'BOOKED', next: [], priceMinor: '1000', paidMinor: '0', refundedMinor: '0', currency: 'KZT', notes: null,
});
beforeEach(() => {
  day.mockReset();
  period.mockReset();
  period.mockImplementation(async (from: string, to: string) => ({
    location: { id: 'salon', name: 'Тестовый салон', timezone: 'Asia/Almaty', currency: 'KZT' },
    period: { from, to },
    appointments: [
      row('a1', '2026-10-26', 600, 'Тестовая клиентка'),
      row('a2', '2026-10-08', 600, 'Клиент 1'),
      row('a3', '2026-10-08', 660, 'Клиент 2'),
      row('a4', '2026-10-08', 720, 'Клиент 3'),
      row('a5', '2026-10-08', 780, 'Клиент 4'),
    ],
  }));
  day.mockImplementation(async (date = '2026-10-14') => ({
    date, location: { id: 'salon', name: 'Тестовый салон', timezone: 'Asia/Almaty', currency: 'KZT' },
    columns: [], appointments: [], services: [], bounds: { fromMinutes: 540, toMinutes: 1080 },
  }));
});

describe('Месячный журнал салона (владелец 26.10.2026: «Неделя» заменена на «Месяц», вариант А)', () => {
  it('одним запросом за весь месяц, сетка с понедельника: 5 недель октября 2026, записи в клетках', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14', view: 'month' }) }));
    // октябрь 2026: сетка с пн 28.09 по вс 01.11
    expect(period.mock.calls).toEqual([['2026-09-28', '2026-11-01']]);
    expect(day).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-testid="beauty-month"');
    expect(html.match(/class="beauty-month-day[ "]/g)).toHaveLength(35);
    expect(html).toContain('Тестовая клиентка');
    expect(html).toContain('/calendar?date=2026-10-26');
    expect(html).not.toMatch(/<section[^>]*role="listitem"/);
  });
  it('в клетке не больше трёх записей, остальное «ещё N»; дни чужого месяца приглушены', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14', view: 'month' }) }));
    expect(html).toContain('ещё 1');
    expect(html.match(/class="beauty-month-day is-other/g)).toHaveLength(4);
  });
  it('переключатель «День / Месяц», «Недели» больше нет, без предзагрузки (аудит 21.10.2026, п. 3)', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14', view: 'month' }) }));
    const views = html.slice(html.indexOf('aria-label="Вид журнала"'));
    expect(views).toContain('>День<');
    expect(views).toContain('>Месяц<');
    expect(views).not.toContain('>Неделя<');
    expect(prefetchFlags.filter((flag) => flag === false).length).toBeGreaterThanOrEqual(2);
  });
  it('старая ссылка view=week открывает месяц', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14', view: 'week' }) }));
    expect(html).toContain('data-testid="beauty-month"');
  });
  it('обычный день не загружает месяц', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14' }) }));
    expect(day).toHaveBeenCalledTimes(1);
    expect(period).not.toHaveBeenCalled();
    expect(html).toContain('Журнал дня');
  });
});
