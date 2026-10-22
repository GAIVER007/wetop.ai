import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../lib/api', async (original) => {
  const actual = await original<typeof import('../../lib/api')>();
  return { ...actual, beautyApi: { ...actual.beautyApi, financeDay: vi.fn() } };
});
vi.mock('../../components/date-field', () => ({ DateInput: (props: Record<string, unknown>) => `[${String(props.name)}=${String(props.defaultValue)}]` }));
import { beautyApi } from '../../lib/api';
import { BeautyFinanceScreen } from './beauty-finance';

const row = (id: string, status: string, priceMinor: string): BeautyAppointmentRow =>
  ({ id, status, priceMinor, currency: 'KZT', startsAt: '2026-10-20T05:00:00.000Z', employeeId: 'm1', serviceName: 'Стрижка', customer: { name: 'Клиент' } }) as unknown as BeautyAppointmentRow;
const day = (date = '2026-10-21'): BeautyDay => ({
  date,
  location: { id: 'l', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
  columns: [{ id: 'm1', name: 'Дина' }] as BeautyDay['columns'],
  appointments: date === '2026-10-20' ? [row('a1', 'DONE', '1200000'), row('a2', 'NO_SHOW', '500000')] : [],
  services: [],
  bounds: { fromMinutes: 0, toMinutes: 1440 },
});

beforeEach(() => {
  vi.mocked(beautyApi.financeDay).mockImplementation(async (date) => day(date ?? '2026-10-21'));
});

describe('Финансы салона (аудит 21.10.2026, пп. 1, 19, 28, 29)', () => {
  it('выбор периода как на «Обзоре продаж», период «15-21 окт.» без двоеточия', async () => {
    const html = renderToStaticMarkup(await BeautyFinanceScreen());
    expect(html).toContain('data-testid="finance-period"');
    expect(html).toContain('7 дней');
    expect(html).toContain('30 дней');
    expect(html).toContain('href="/finance?from=2026-09-22&amp;to=2026-10-21"');
    expect(html).toContain('15-21 окт.');
    expect(html).not.toMatch(/окт\.: /);
  });
  it('без плиток: итоги одной строкой, суммы на месте, без жаргона', async () => {
    const html = renderToStaticMarkup(await BeautyFinanceScreen());
    expect(html).not.toContain('kpi-row');
    expect(html).not.toContain('kpi-tile');
    expect(html).toContain('data-testid="beauty-finance-summary"');
    expect(html).toMatch(/data-testid="beauty-revenue"[^>]*>12 000 ₸/);
    expect(html).toMatch(/data-testid="beauty-lost"[^>]*>5 000 ₸/);
    expect(html).not.toContain('снимки цен');
    expect(html).not.toContain('не потерянные деньги');
    expect(html).toContain('по ценам на момент записи');
  });
  it('в «По дням» только дни с услугами и строка итогов, а не 7 нулей', async () => {
    const html = renderToStaticMarkup(await BeautyFinanceScreen());
    const days = html.slice(html.indexOf('По дням'), html.indexOf('По мастерам'));
    expect(days.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr/g)).toHaveLength(1);
    expect(days).toContain('Итого');
  });
  it('пустой период: одно пустое состояние вместо таблицы нулей', async () => {
    vi.mocked(beautyApi.financeDay).mockImplementation(async (date) => ({ ...day(date ?? '2026-10-21'), appointments: [] }));
    const html = renderToStaticMarkup(await BeautyFinanceScreen());
    const days = html.slice(html.indexOf('По дням'), html.indexOf('По мастерам'));
    expect(days).not.toContain('<table');
  });
});
