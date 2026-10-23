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
