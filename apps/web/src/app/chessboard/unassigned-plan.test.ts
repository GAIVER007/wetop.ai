import { describe, expect, it } from 'vitest';
import type { StayAvailability, UnassignedStay } from '../../lib/api';
import {
  crossCategoryQuestion,
  freeChoice,
  unassignedCard,
  unassignedSummary,
} from './unassigned-plan';

/**
 * Ящик «Брони без размещения» (ТЗ «Шахматка v2» §11–12, §64): над сеткой одна строка «⚠ 2 брони без
 * назначенного места», по «Разместить» — ящик с карточкой на каждое проживание без ячейки. Свободные
 * места берутся из `/availability` по датам выбранной брони (условие владельца: без N+1), назначение —
 * существующая команда `assign`; в другую категорию — с вопросом и разницей стоимости. Гости вымышленные.
 */
const stay = (over: Partial<UnassignedStay> = {}): UnassignedStay => ({
  confirmationNumber: '20260921-AAAAAA',
  itemId: 'item-1',
  guestLabel: 'Тест Безместный',
  categoryCode: 'ROOM',
  categoryName: 'Одноместный номер',
  arrivalDate: '2026-09-21',
  departureDate: '2026-09-23',
  status: 'CONFIRMED',
  ...over,
});

describe('unassignedSummary — строка над сеткой (§11)', () => {
  it('считает брони, а не проживания: одна бронь, две, пять', () => {
    expect(unassignedSummary([stay()]).text).toBe('1 бронь без назначенного места');
    expect(
      unassignedSummary([stay(), stay({ confirmationNumber: 'B', itemId: 'item-2' })]).text,
    ).toBe('2 брони без назначенного места');
    const five = [1, 2, 3, 4, 5].map((n) => stay({ confirmationNumber: `N${n}`, itemId: `i${n}` }));
    expect(unassignedSummary(five).text).toBe('5 броней без назначенного места');
  });
  it('у групповой брони проживаний больше, чем броней, — число мест называется отдельно', () => {
    const group = [1, 2, 3].map((n) => stay({ itemId: `g${n}` }));
    expect(unassignedSummary(group)).toEqual({
      reservations: 1,
      stays: 3,
      text: '1 бронь без назначенного места',
      detail: '3 места ждут назначения',
    });
    expect(unassignedSummary([stay()]).detail).toBeNull();
  });
});

describe('unassignedCard — карточка в ящике (§12)', () => {
  it('гость, даты с ночами, категория и слово о брони', () => {
    expect(unassignedCard(stay())).toMatchObject({
      key: '20260921-AAAAAA/item-1',
      number: '20260921-AAAAAA',
      itemId: 'item-1',
      guest: 'Тест Безместный',
      dates: '21 сент. → 23 сент., 2 ночи',
      nights: '2 ночи',
      category: 'Одноместный номер',
      status: 'подтверждена',
    });
  });
  it('без гостя — словами, без itemId — назначать нечем', () => {
    const old = stay({ guestLabel: '' });
    delete old.itemId; // ответ API до PR 6
    const card = unassignedCard(old);
    expect(card.guest).toBe('Гость не указан');
    expect(card.itemId).toBeNull();
  });
});

const availability = (byCategory: Record<string, string[]>): StayAvailability => ({
  arrivalDate: '2026-09-21',
  departureDate: '2026-09-23',
  nights: 2,
  byCategory: Object.fromEntries(
    Object.entries(byCategory).map(([code, units]) => [
      code,
      { units: 16, available: units.length, availableUnitCodes: units },
    ]),
  ),
  total: { units: 88, available: 0 },
});
const categories = [
  { code: 'ROOM', name: 'Одноместный номер' },
  { code: 'MALE', name: 'Мужской общий номер' },
  { code: 'FEMALE', name: 'Женский общий номер' },
];

describe('freeChoice — свободные места на весь срок брони', () => {
  it('свои — из категории брони; чужие — по порядку категорий сетки, пустые не показываются', () => {
    const choice = freeChoice(
      stay(),
      availability({ ROOM: ['R04', 'R07'], MALE: [], FEMALE: ['F02'] }),
      categories,
    );
    expect(choice).toEqual({
      own: ['R04', 'R07'],
      others: [{ code: 'FEMALE', name: 'Женский общий номер', units: ['F02'] }],
    });
  });
  it('категории нет в ответе — своих мест нет, а не ошибка', () => {
    expect(freeChoice(stay(), availability({ MALE: ['M03'] }), categories).own).toEqual([]);
  });
});

describe('crossCategoryQuestion — переезд в другую категорию спрашивается с деньгами', () => {
  const card = unassignedCard(stay());
  const preview = (differenceMinor: string, newPriceMinor = '3000000') => ({
    action: 'move' as const,
    currentPriceMinor: '1600000',
    currency: 'KZT',
    changesCategory: true,
    newPriceMinor,
    differenceMinor,
    categoryName: 'Мужской общий номер',
  });
  it('разница вверх и вниз со знаком, новая цена словами', () => {
    const up = crossCategoryQuestion(card, 'M03', 'Мужской общий номер', preview('1400000'));
    expect(up).toEqual({
      title: 'Разместить бронь 20260921-AAAAAA в M03?',
      guest: 'Тест Безместный',
      route: 'Одноместный номер → Мужской общий номер',
      dates: '21 сент. → 23 сент., 2 ночи',
      money: 'Разница стоимости: +14 000 ₸',
      note: 'Проживание станет 30 000 ₸ вместо 16 000 ₸.',
    });
    const down = crossCategoryQuestion(
      card,
      'M03',
      'Мужской общий номер',
      preview('-400000', '1200000'),
    );
    expect(down.money).toBe('Разница стоимости: −4 000 ₸');
  });
  it('без разницы — «Стоимость не изменится»; предпросмотр не ответил — о деньгах не молчим', () => {
    expect(crossCategoryQuestion(card, 'M03', 'Мужской', preview('0', '1600000')).money).toBe(
      'Стоимость не изменится',
    );
    expect(crossCategoryQuestion(card, 'M03', 'Мужской', null).money).toBe(
      'Сумму посчитать не удалось — проверьте счёт после размещения.',
    );
  });
});
