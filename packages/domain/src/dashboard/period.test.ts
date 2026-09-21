import { describe, expect, it } from 'vitest';
import { periodNights, previousPeriod, resolvePeriod } from './period';

const today = '2026-09-16';

describe('resolvePeriod', () => {
  it('готовые отрезки считаются от сегодняшнего дня объекта', () => {
    expect(resolvePeriod({ preset: 'today' }, today)).toEqual({
      preset: 'today',
      from: today,
      to: today,
    });
    expect(resolvePeriod({ preset: 'yesterday' }, today)).toMatchObject({
      from: '2026-09-15',
      to: '2026-09-15',
    });
    expect(resolvePeriod({ preset: 'week' }, today)).toMatchObject({
      from: '2026-09-10',
      to: '2026-09-16',
    });
    expect(resolvePeriod({ preset: 'month' }, today)).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolvePeriod({ preset: 'last-month' }, today)).toMatchObject({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    // январь → декабрь прошлого года
    expect(resolvePeriod({ preset: 'last-month' }, '2027-01-03')).toMatchObject({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('свой отрезок — по датам; неверные даты или больше 366 дней → сегодня с ошибкой', () => {
    expect(resolvePeriod({ preset: 'custom', from: '2026-09-01', to: '2026-09-10' }, today)).toEqual({
      preset: 'custom',
      from: '2026-09-01',
      to: '2026-09-10',
    });
    expect(resolvePeriod({ preset: 'custom', from: '2026-09-10', to: '2026-09-01' }, today)).toEqual({
      preset: 'today',
      from: today,
      to: today,
      error: 'Окончание периода не может быть раньше начала',
    });
    expect(resolvePeriod({ preset: 'custom', from: '2025-01-01', to: '2026-09-01' }, today)).toMatchObject(
      { preset: 'today', error: expect.stringMatching(/366/) },
    );
    expect(resolvePeriod({ preset: 'custom', from: '01.09.2026', to: '2026-09-10' }, today)).toMatchObject({
      preset: 'today',
      error: expect.stringMatching(/дат/),
    });
  });

  it('старый параметр date — один день; неизвестный preset — сегодня', () => {
    expect(resolvePeriod({ date: '2026-08-15' }, today)).toEqual({
      preset: 'custom',
      from: '2026-08-15',
      to: '2026-08-15',
    });
    expect(resolvePeriod({ preset: 'quarter' }, today)).toMatchObject({ preset: 'today' });
    expect(resolvePeriod({}, today)).toMatchObject({ preset: 'today' });
  });
});

describe('previousPeriod / periodNights', () => {
  it('предыдущий отрезок той же длины, впритык к началу', () => {
    expect(previousPeriod('2026-09-16', '2026-09-16')).toEqual({ from: '2026-09-15', to: '2026-09-15' });
    expect(previousPeriod('2026-09-01', '2026-09-30')).toEqual({ from: '2026-08-02', to: '2026-08-31' });
    expect(periodNights('2026-09-01', '2026-09-30')).toBe(30);
  });
});
