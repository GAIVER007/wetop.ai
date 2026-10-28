import { describe, expect, it } from 'vitest';
import type { PortalMonthStats } from '@pms/domain';
import { portalAbsenceDays, portalAbsences, portalMonthLabel, portalMonthLine, portalInitials, portalMonthTiles, portalShiftMonth } from './portal-month';

const base: PortalMonthStats = {
  month: '2026-10', status: 'AVAILABLE', currency: 'KZT',
  shifts: null, daysOff: null, absenceDays: null, appointmentsDone: null, servicesDone: null,
  ordersClosed: null, tablesServed: null, guests: null, revenueMinor: null, bonusMinor: null, percent: null,
};

describe('строка «Мой месяц»', () => {
  it('салон: смены, выходные, услуги, выручка, бонусы одной строкой', () => {
    const line = portalMonthLine({ ...base, shifts: 12, daysOff: 19, absenceDays: 0, appointmentsDone: 30, servicesDone: 37, revenueMinor: '45000000', bonusMinor: '1000000' }, '2026');
    expect(line).toMatch(/^Октябрь: 12 смен, 19 выходных, 30 записей, 37 услуг, выручка 450\s000\s?₸, бонусы 10\s000\s?₸$/u);
  });
  it('ресторан: заказы, столы, гости, процент; отсутствия в скобках', () => {
    const line = portalMonthLine({ ...base, month: '2025-03', shifts: 21, daysOff: 10, absenceDays: 2, ordersClosed: 41, tablesServed: 22, guests: 1, revenueMinor: '0', bonusMinor: '0', percent: 5 }, '2026');
    expect(line).toContain('Март 2025: 21 смена, 10 выходных (из них 2 дня отсутствия), 41 заказ, 22 стола, 1 гость');
    expect(line).toContain('мой процент 5%');
  });
  it('без филиала просит выбрать филиал; соседние месяцы через год', () => {
    expect(portalMonthLine({ ...base, status: 'SELECT_LOCATION' }, '2026')).toBe('Октябрь: выберите филиал, чтобы увидеть итоги месяца');
    expect(portalShiftMonth('2026-01', -1)).toBe('2025-12');
    expect(portalShiftMonth('2026-12', 1)).toBe('2027-01');
    expect(portalMonthLabel('2026-05', '2026')).toBe('Май');
  });
});

describe('отсутствия в кабинете', () => {
  it('делит на текущие/будущие и прошедшие, считает дни включительно', () => {
    const rows = [
      { id: 'a', dateFrom: '2026-09-01', dateTo: '2026-09-03', reason: null },
      { id: 'b', dateFrom: '2026-10-20', dateTo: '2026-10-24', reason: 'Отпуск' },
      { id: 'c', dateFrom: '2026-11-02', dateTo: '2026-11-02', reason: null },
      { id: 'd', dateFrom: '2026-10-01', dateTo: '2026-10-02', reason: null },
    ];
    const r = portalAbsences(rows, '2026-10-22');
    expect(r.upcoming.map((x) => x.id)).toEqual(['b', 'c']);
    expect(r.past.map((x) => x.id)).toEqual(['d', 'a']);
    expect(portalAbsenceDays(rows[0]!)).toBe('3 дня');
    expect(portalAbsenceDays(rows[2]!)).toBe('1 день');
  });
});

// карточка сотрудника, вариант A (владелец 28.10.2026): цифры месяца крупными плитками
describe('плитки месяца в карточке сотрудника', () => {
  const pay = { status: 'AVAILABLE' as const, earnedMinor: '553500', currency: 'QAR' };
  const reviews = { averageStars: 4.86, count: 38 };
  it('салон: выручка, визиты, услуги, ЗП, оценка; пустые не показываем', () => {
    const tiles = portalMonthTiles({ ...base, currency: 'QAR', shifts: 22, appointmentsDone: 124, servicesDone: 140, revenueMinor: '1845000' }, { pay, reviews });
    expect(tiles.map((t) => t.id)).toEqual(['revenue', 'visits', 'services', 'pay', 'rating']);
    expect(tiles.find((t) => t.id === 'visits')?.value).toBe('124');
    expect(tiles.find((t) => t.id === 'rating')?.value).toBe('4,9 ★');
    expect(tiles.find((t) => t.id === 'rating')?.hint).toBe('38 отзывов');
    expect(tiles.find((t) => t.id === 'revenue')?.value).toMatch(/18\s450/u);
  });
  it('ресторан: заказы и гости вместо визитов; без доступа к ЗП и отзывам плиток нет', () => {
    const tiles = portalMonthTiles({ ...base, shifts: 20, ordersClosed: 41, guests: 96, revenueMinor: '0' }, { pay: null, reviews: null });
    expect(tiles.map((t) => t.id)).toEqual(['revenue', 'orders', 'guests', 'shifts']);
  });
  it('без отзывов оценка не выдумывается; ЗП не настроена не показывается; без филиала плиток нет', () => {
    const tiles = portalMonthTiles({ ...base, appointmentsDone: 3, revenueMinor: '100' }, { pay: { status: 'NOT_CONFIGURED', earnedMinor: null, currency: 'KZT' }, reviews: { averageStars: null, count: 0 } });
    expect(tiles.map((t) => t.id)).toEqual(['revenue', 'visits']);
    expect(portalMonthTiles({ ...base, status: 'SELECT_LOCATION', revenueMinor: '5' }, { pay, reviews })).toEqual([]);
  });
});

describe('инициалы без фото', () => {
  it('два слова, одно слово, лишние пробелы', () => {
    expect(portalInitials('Айгерим Сапарова')).toBe('АС');
    expect(portalInitials('  Keamogetswe  Innocentia Mohlabai ')).toBe('KI');
    expect(portalInitials('Aidai')).toBe('AI');
  });
});
