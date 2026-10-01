import { describe, expect, it } from 'vitest';
import { summarize } from './summary';

/**
 * Сводка формы «Новая бронь» (ТЗ QA 01.10.2026, WET-02): при групповой брони API заводит `quantity` проживаний
 * по `adults` гостей в каждом, поэтому гостей в размещении столько же, сколько мест, умноженных на гостей на место.
 * До правки сводка показывала «3 места, 1 гость», а сохранялось 3 гостя.
 */
const props = {
  arrival: '2026-11-10',
  departure: '2026-11-13',
  categories: [
    { code: 'MALE', name: 'Мужской общий номер' },
    { code: 'ROOM', name: 'Двухместный номер' },
  ],
  piiStorage: 'real' as const,
};

describe('сводка новой брони: гости в групповом размещении', () => {
  it('3 койки по одному гостю: 3 места и 3 гостя', () => {
    const facts = summarize(
      props,
      ['0'],
      { accommodationTypeCode: 'MALE', quantity: '3', adults: '1', source: 'DESK' },
      null,
    );
    expect(facts.placements).toEqual([
      'Мужской общий номер, 3 места, ячейки назначит система, 3 гостя',
    ]);
    expect(facts.datesText).toBe('10 нояб. → 13 нояб., 3 ночи');
  });

  it('2 номера по два гостя: 2 места и 4 гостя; второе размещение считается своими полями', () => {
    const facts = summarize(
      props,
      ['0', '1'],
      {
        accommodationTypeCode: 'ROOM',
        quantity: '2',
        adults: '2',
        'item.1.accommodationTypeCode': 'MALE',
        'item.1.quantity': '1',
        'item.1.adults': '1',
        'item.1.unitCode': 'M05',
      },
      null,
    );
    expect(facts.placements).toEqual([
      'Двухместный номер, 2 места, ячейки назначит система, 4 гостя',
      'Мужской общий номер, ячейка M05, 1 гость',
    ]);
  });

  it('одно место: гостей столько, сколько в поле', () => {
    const facts = summarize(
      props,
      ['0'],
      { accommodationTypeCode: 'ROOM', quantity: '1', adults: '2', unitCode: '@auto' },
      null,
    );
    expect(facts.placements).toEqual(['Двухместный номер, ячейку назначит система, 2 гостя']);
  });
});
