import { describe, expect, it } from 'vitest';
import { ownerAttention } from '../../../../../packages/domain/src/owner-summary/attention';
import { translator } from '../../i18n';
import { attentionLine } from './owner-attention-text';

/**
 * «Требуют решения» в английском и казахском (инструкция гостиницы 01.11.2026): API присылает готовую русскую строку
 * («Не убрано: 7 номеров», ссылка «Номера»), и она так и выходила на английской Главной. Строку собирает экран на
 * языке человека по id и числу; по-русски остаётся текст API как есть.
 */
const cyr = /[А-Яа-яЁё]/;
const all = ownerAttention({ vertical: 'HOSPITALITY', today: '2026-11-01', arrivals: 3, dirtyRooms: 7, noPrepay: 2, lowStock: 4, openShiftSince: '2026-10-30' })
  .concat(ownerAttention({ vertical: 'HOSPITALITY', dirtyRooms: 7 }))
  .concat(ownerAttention({ vertical: 'HOSPITALITY', dirtyRooms: 2, dirtyHasBeds: true }))
  .concat(ownerAttention({ vertical: 'HOSPITALITY', arrivals: 1, dirtyRooms: 0 }))
  .concat(ownerAttention({ vertical: 'BEAUTY', today: '2026-11-01', unpaidDone: 1, freeMasters: 2, lateUnmarked: 3, unconfirmedTomorrow: 5 }))
  .concat(ownerAttention({ vertical: 'FOOD_SERVICE', staleOrders: 2 }))
  .concat(ownerAttention({ vertical: 'FOOD_SERVICE', staleOrders: 0 }));

describe('owner attention in the reader language', () => {
  it('covers every kind of row', () => {
    expect(new Set(all.map((i) => i.id))).toEqual(
      new Set(['open-shift', 'arrivals', 'no-prepayment', 'low-stock', 'dirty-rooms', 'late-unmarked', 'unpaid-visits', 'unconfirmed-tomorrow', 'free-windows', 'stale-orders', 'all-clear']),
    );
  });
  for (const locale of ['en', 'kk'] as const)
    it(`${locale}: no Russian in text or link`, () => {
      const t = translator(locale);
      for (const item of all) {
        const line = attentionLine(item, t, locale);
        if (locale === 'en') expect(line.text, item.text).not.toMatch(cyr);
        else expect(line.text, item.text).not.toBe(item.text);
        if (locale === 'en') expect(line.action, item.action).not.toMatch(cyr);
        expect(line.text).toMatch(item.count !== undefined ? new RegExp(String(item.count)) : /./);
      }
    });
  it('en: dirty rooms and arrivals read naturally', () => {
    const t = translator('en');
    const dirty = all.find((i) => i.id === 'dirty-rooms' && i.text.includes('номер'))!;
    expect(attentionLine(dirty, t, 'en')).toEqual({ text: 'Not cleaned: 7 rooms', action: 'Rooms' });
    const beds = all.find((i) => i.id === 'dirty-rooms' && i.text.includes('мест'))!;
    expect(attentionLine(beds, t, 'en').text).toBe('Not cleaned: 2 places');
    const arrivals = all.find((i) => i.id === 'arrivals' && i.tone === 'warn')!;
    expect(attentionLine(arrivals, t, 'en').text).toBe('3 check-ins, not cleaned: 7 rooms');
    expect(attentionLine(all.find((i) => i.id === 'open-shift')!, t, 'en').text).toBe('Shift since 30.10 is not closed');
  });
  it('ru: the API text stays as it is', () => {
    const t = translator('ru');
    for (const item of all) expect(attentionLine(item, t, 'ru')).toEqual({ text: item.text, action: item.action });
  });
});
