import { describe, expect, it } from 'vitest';
import {
  callbackStatusLabel,
  formatDuration,
  formatPhone,
  formatWhen,
  stateBadge,
  summaryItems,
  type VoiceSummaryView,
} from './format';

const summary = (over: Partial<VoiceSummaryView['totals']> = {}, hasData = true): VoiceSummaryView => ({
  month: '2026-10',
  timezone: 'Asia/Almaty',
  hasData,
  totals: {
    calls: 4,
    answered: 3,
    ended: 2,
    rejected: 1,
    failed: 0,
    callbacks: 2,
    transfers: 1,
    avgDurationSeconds: 150,
    ...over,
  },
});

describe('длительность разговора', () => {
  it.each([
    [null, '–'],
    [0, '0 с'],
    [59, '59 с'],
    [60, '1 мин'],
    [125, '2 мин 5 с'],
    [3725, '1 ч 2 мин'],
    [3600, '1 ч'],
  ])('%s -> %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('номер телефона', () => {
  it('+7 делится на группы', () => {
    expect(formatPhone('+77001112233')).toBe('+7 700 111 22 33');
  });
  it('чужой код и мусор остаются как есть, без падения', () => {
    expect(formatPhone('+14155550123')).toBe('+14155550123');
    expect(formatPhone('')).toBe('');
    expect(formatPhone('***2233')).toBe('***2233');
  });
});

describe('время звонка в часовом поясе филиала', () => {
  it('Алматы UTC+5', () => {
    expect(formatWhen('2026-10-22T05:00:00.000Z', 'Asia/Almaty')).toBe('22.10.2026, 10:00');
  });
  it('неверное время не роняет страницу', () => {
    expect(formatWhen('вчера', 'Asia/Almaty')).toBe('–');
  });
  it('неверный пояс откатывается на UTC, а не падает', () => {
    expect(formatWhen('2026-10-22T05:00:00.000Z', 'Mars/Phobos')).toBe('22.10.2026, 05:00');
  });
});

describe('состояния звонка', () => {
  it.each([
    ['RECEIVED', 'Принят', 'info'],
    ['ANSWERED', 'Идёт разговор', 'info'],
    ['ENDED', 'Завершён', 'ok'],
    ['REJECTED', 'Отклонён', 'warn'],
    ['FAILED', 'Сбой', 'danger'],
  ])('%s', (state, label, tone) => {
    expect(stateBadge(state)).toEqual({ label, tone });
  });
  it('неизвестное состояние показывается как есть, нейтрально', () => {
    expect(stateBadge('WEIRD')).toEqual({ label: 'WEIRD', tone: 'neutral' });
  });
  it('статус просьбы', () => {
    expect(callbackStatusLabel('NEW')).toBe('Ждёт звонка');
    expect(callbackStatusLabel('DONE')).toBe('Обработана');
  });
});

describe('итоги месяца', () => {
  it('числа из журнала, средняя длительность словами', () => {
    const items = summaryItems(summary());
    expect(items.map((i) => [i.key, i.value])).toEqual([
      ['calls', '4'],
      ['answered', '3'],
      ['callbacks', '2'],
      ['transfers', '1'],
      ['avg', '2 мин 30 с'],
      ['rejected', '1'],
    ]);
  });
  it('пустой журнал: «Нет данных», а не нули', () => {
    const items = summaryItems(summary({ calls: 0, answered: 0, callbacks: 0, transfers: 0, rejected: 0, avgDurationSeconds: null }, false));
    expect(items.every((i) => i.value === 'Нет данных')).toBe(true);
  });
  it('нет длительности при наличии звонков: прочерк', () => {
    expect(summaryItems(summary({ avgDurationSeconds: null })).find((i) => i.key === 'avg')?.value).toBe('–');
  });
});

describe('подсказка над выключателем брони', () => {
  it('своя для каждого направления; без агента просит создать его', async () => {
    const { bookingHint } = await import('./format');
    expect(bookingHint('BEAUTY')).toMatch(/мастер/);
    expect(bookingHint('FOOD_SERVICE')).toMatch(/Номер стола агент не называет/);
    expect(bookingHint('HOSPITALITY')).toMatch(/свободные номера/);
    expect(bookingHint(null)).toMatch(/нет агента/);
  });
});

describe('брони голосового агента: подписи', () => {
  const tz = 'Asia/Almaty';
  it('номер: категория, даты, гости, номер брони, сумма', async () => {
    const { bookingTitle } = await import('./format');
    const t = bookingTitle({ id: '1', kind: 'HOTEL', at: '2026-11-10T05:00:00.000Z', status: 'CONFIRMED', reference: 'WT-1', category: 'Стандарт', arrival: '2026-11-20', departure: '2026-11-22', adults: 2, totalMinor: '3000000', currency: 'KZT' }, tz);
    expect(t).toContain('Стандарт');
    expect(t).toContain('20.11.2026');
    expect(t).toContain('22.11.2026');
    expect(t).toContain('2 гост');
    expect(t).toContain('WT-1');
    expect(t).toMatch(/30\s?000/);
  });
  it('запись: услуга, мастер, время в поясе филиала; стол: дата, время, гости, период', async () => {
    const { bookingTitle } = await import('./format');
    const visit = bookingTitle({ id: '2', kind: 'APPOINTMENT', at: '2026-11-10T05:00:00.000Z', status: 'BOOKED', service: 'Стрижка', master: 'Алия', startsAt: '2026-11-12T05:00:00.000Z' }, tz);
    expect(visit).toContain('Стрижка');
    expect(visit).toContain('Алия');
    expect(visit).toContain('12.11.2026, 10:00');
    const table = bookingTitle({ id: '3', kind: 'TABLE', at: '2026-11-10T05:00:00.000Z', status: 'BOOKED', startsAt: '2026-11-12T14:00:00.000Z', partySize: 4, period: 'Ужин' }, tz);
    expect(table).toContain('4 гост');
    expect(table).toContain('19:00');
    expect(table).toContain('Ужин');
  });
  it('статус словами и тоном: ждёт подтверждения, подтверждена, отменена; неизвестный без выдумки', async () => {
    const { bookingStatus } = await import('./format');
    expect(bookingStatus('APPOINTMENT', 'BOOKED')).toEqual({ label: 'Ждёт подтверждения', tone: 'warn' });
    expect(bookingStatus('TABLE', 'CONFIRMED')).toEqual({ label: 'Подтверждена', tone: 'ok' });
    expect(bookingStatus('HOTEL', 'CANCELLED').tone).toBe('danger');
    expect(bookingStatus('HOTEL', null)).toEqual({ label: '–', tone: 'neutral' });
    expect(bookingStatus('HOTEL', 'ВЫДУМАНО')).toEqual({ label: '–', tone: 'neutral' });
  });
  it('вид брони словами', async () => {
    const { bookingKindLabel } = await import('./format');
    expect(bookingKindLabel('HOTEL')).toBe('Номер');
    expect(bookingKindLabel('APPOINTMENT')).toBe('Запись');
    expect(bookingKindLabel('TABLE')).toBe('Стол');
  });
});
