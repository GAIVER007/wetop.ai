import { describe, expect, it } from 'vitest';
import {
  availabilityChange,
  autoSyncWindow,
  withVanished,
  type StayAvailabilityState,
} from './auto-sync';

const stay = (
  code: string,
  arrival: string,
  departure: string,
  sold = true,
): StayAvailabilityState => ({
  accommodationTypeCode: code,
  arrivalDate: arrival,
  departureDate: departure,
  sold,
});
const map = (entries: Array<[string, StayAvailabilityState]>) => new Map(entries);
const TODAY = '2026-09-13';

describe('autoSyncWindow (ADR-032)', () => {
  const now = new Date('2026-09-13T17:30:00Z'); // 22:30 в Алматы

  it('окно в местном времени Алматы: от начала прошлого прогона минус 15 мин до «сейчас + 5 мин»', () => {
    const w = autoSyncWindow(now, {
      startedAt: new Date('2026-09-13T17:15:00Z'),
      fullPassAt: new Date('2026-09-13T17:00:00Z'),
    });
    // Exely понимает modifiedFrom во времени объекта (проверено cli-exely-modified-window.ts 13.09.2026)
    expect(w).toEqual({ modifiedFrom: '2026-09-13T22:00', modifiedTo: '2026-09-13T22:35', fullPass: false });
  });

  it('первый прогон смотрит на сутки назад и делает полный проход по сегодняшним броням', () => {
    expect(autoSyncWindow(now, null)).toEqual({
      modifiedFrom: '2026-09-12T22:30',
      modifiedTo: '2026-09-13T22:35',
      fullPass: true,
    });
  });

  it('полный проход по суткам — раз в час', () => {
    const last = (fullPassAt: string) => ({
      startedAt: new Date('2026-09-13T17:15:00Z'),
      fullPassAt: new Date(fullPassAt),
    });
    expect(autoSyncWindow(now, last('2026-09-13T16:31:00Z')).fullPass).toBe(false);
    expect(autoSyncWindow(now, last('2026-09-13T16:30:00Z')).fullPass).toBe(true);
  });

  it('задача долго стояла (день двойного ввода) — догоняет не дальше 7 суток', () => {
    const w = autoSyncWindow(now, {
      startedAt: new Date('2026-08-01T00:00:00Z'),
      fullPassAt: null,
    });
    expect(w.modifiedFrom).toBe('2026-09-06T22:30');
    expect(w.fullPass).toBe(true);
  });
});

describe('availabilityChange: какие категории и ночи пересчитать после импорта', () => {
  it('ничего не изменилось — дельты нет, в Channex не уходит ни одного запроса', () => {
    const s = stay('dorm', '2026-09-14', '2026-09-16');
    expect(availabilityChange(map([['a', s]]), map([['a', { ...s }]]), TODAY)).toBeNull();
  });

  it('новое проданное проживание — его категория и ночи', () => {
    expect(
      availabilityChange(map([]), map([['a', stay('dorm', '2026-09-14', '2026-09-16')]]), TODAY),
    ).toEqual({ categoryCodes: ['dorm'], from: '2026-09-14', toExclusive: '2026-09-16' });
  });

  it('отмена — пересчитываются прежние ночи', () => {
    expect(
      availabilityChange(
        map([['a', stay('dorm', '2026-09-14', '2026-09-16')]]),
        map([['a', stay('dorm', '2026-09-14', '2026-09-16', false)]]),
        TODAY,
      ),
    ).toEqual({ categoryCodes: ['dorm'], from: '2026-09-14', toExclusive: '2026-09-16' });
  });

  it('перенос дат и смена категории — старое и новое вместе, одним окном', () => {
    expect(
      availabilityChange(
        map([['a', stay('dorm', '2026-09-20', '2026-09-22')]]),
        map([['a', stay('single', '2026-09-14', '2026-09-15')]]),
        TODAY,
      ),
    ).toEqual({ categoryCodes: ['dorm', 'single'], from: '2026-09-14', toExclusive: '2026-09-22' });
  });

  it('изменения у непроданных (отменённая бронь поменяла даты) остаток не двигают', () => {
    expect(
      availabilityChange(
        map([['a', stay('dorm', '2026-09-14', '2026-09-16', false)]]),
        map([['a', stay('dorm', '2026-09-18', '2026-09-19', false)]]),
        TODAY,
      ),
    ).toBeNull();
  });

  it('прошедшие ночи не пересчитываются: окно начинается с сегодня, целиком прошлое — дельты нет', () => {
    expect(
      availabilityChange(map([]), map([['a', stay('dorm', '2026-09-10', '2026-09-15')]]), TODAY),
    ).toEqual({ categoryCodes: ['dorm'], from: TODAY, toExclusive: '2026-09-15' });
    expect(
      availabilityChange(map([]), map([['b', stay('dorm', '2026-09-01', '2026-09-13')]]), TODAY),
    ).toBeNull();
  });

  it('окно не дальше 500 суток — глубины полной выгрузки', () => {
    expect(
      availabilityChange(map([]), map([['a', stay('dorm', '2026-09-14', '2029-01-01')]]), TODAY),
    ).toEqual({ categoryCodes: ['dorm'], from: '2026-09-14', toExclusive: '2028-01-26' });
  });
});

describe('withVanished — освободившиеся ночи исчезнувших проживаний (ADR-050) попадают в дельту остатков', () => {
  it('исчезнувшее проживание считается «было продано → не продано», и дельта его ночи видит', () => {
    const before = new Map<string, StayAvailabilityState>();
    const after = new Map<string, StayAvailabilityState>();
    withVanished(before, after, [
      { exelyRoomStayId: 'S-2', accommodationTypeCode: 'exely-5074688', arrivalDate: '2026-09-20', departureDate: '2026-09-22' },
    ]);
    expect(before.get('S-2')).toEqual({ accommodationTypeCode: 'exely-5074688', arrivalDate: '2026-09-20', departureDate: '2026-09-22', sold: true });
    expect(after.get('S-2')).toEqual({ accommodationTypeCode: 'exely-5074688', arrivalDate: '2026-09-20', departureDate: '2026-09-22', sold: false });
    expect(availabilityChange(before, after, '2026-09-15')).toEqual({ categoryCodes: ['exely-5074688'], from: '2026-09-20', toExclusive: '2026-09-22' });
  });
  it('состояние «до», снятое с базы, не переписывается', () => {
    const before = new Map<string, StayAvailabilityState>([
      ['S-2', { accommodationTypeCode: 'exely-5074688', arrivalDate: '2026-09-19', departureDate: '2026-09-22', sold: true }],
    ]);
    const after = new Map<string, StayAvailabilityState>();
    withVanished(before, after, [
      { exelyRoomStayId: 'S-2', accommodationTypeCode: 'exely-5074688', arrivalDate: '2026-09-20', departureDate: '2026-09-22' },
    ]);
    expect(before.get('S-2')!.arrivalDate).toBe('2026-09-19');
    expect(after.get('S-2')!.sold).toBe(false);
  });
});
