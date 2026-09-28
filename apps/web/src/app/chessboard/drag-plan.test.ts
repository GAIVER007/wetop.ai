import { describe, expect, it } from 'vitest';
import {
  DRAG_MIME,
  checkDrop,
  decodeDrag,
  encodeDrag,
  moveQuestion,
  type DragSource,
  type DropRow,
} from './drag-plan';

/** Переселение перетаскиванием по шахматке: что уезжает в dataTransfer и что спрашиваем у стойки. */
const payload = {
  number: '20260911-ABC123',
  itemId: 'item-1',
  date: '2026-09-15',
  unitCode: 'B-07',
};

/** Плашка в окне: три ночи 14–16 сент., тянут за вторую (15-е); категория — общий номер */
const source: DragSource = {
  ...payload,
  guest: 'Иван Петров',
  categoryCode: 'DORM',
  plateFrom: '2026-09-14',
  plateTo: '2026-09-16',
  startsBefore: false,
  endsAfter: false,
};

const free = (date: string) => ({ date, state: 'FREE' });
const row = (unitCode: string, categoryCode: string, cells: DropRow['cells']): DropRow => ({
  unitCode,
  categoryCode,
  cells,
});
const days = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'];

describe('drag-plan: перетаскивание брони по шахматке', () => {
  it('тип данных свой — чужой drop (файл, текст, ссылка) не читается как бронь', () => {
    expect(DRAG_MIME).toBe('application/x-pms-stay');
  });
  it('payload проходит через dataTransfer без потерь', () => {
    expect(decodeDrag(encodeDrag(payload))).toEqual(payload);
  });
  it('битый или чужой payload не превращается в переселение', () => {
    expect(decodeDrag('')).toBeNull();
    expect(decodeDrag('not json')).toBeNull();
    expect(decodeDrag(JSON.stringify({ number: 'x' }))).toBeNull();
    expect(decodeDrag(JSON.stringify({ ...payload, date: '15.09.2026' }))).toBeNull();
  });
});

/**
 * ТЗ «Шахматка v2» §26: во время перетаскивания допустимые места подсвечены, недопустимые drop не
 * принимают. Проверка — по тем же клеткам сетки, что видит администратор; сервер проверяет ещё раз
 * (§50), здесь только то, что видно заранее, без запросов на каждую строку.
 */
describe('checkDrop: куда можно бросить бронь', () => {
  it('своя строка — не действие: ни подсветки, ни вопроса, ни вызова API', () => {
    expect(checkDrop(source, row('B-07', 'DORM', days.map(free)))).toEqual({ kind: 'noop' });
  });
  it('та же категория, ночи свободны — переселение с даты взятой клетки до конца плашки', () => {
    expect(checkDrop(source, row('B-12', 'DORM', days.map(free)))).toEqual({
      kind: 'ok',
      fromDate: '2026-09-15',
      toDate: '2026-09-16',
      changesCategory: false,
    });
  });
  it('ночь до даты переезда может быть занята: гость переезжает только с этой даты', () => {
    const cells = [
      { date: '2026-09-14', state: 'OCCUPIED', itemId: 'other' },
      ...days.slice(1).map(free),
    ];
    expect(checkDrop(source, row('B-12', 'DORM', cells)).kind).toBe('ok');
  });
  it('чужая бронь на ночах переезда — drop закрыт, причина с датой словами', () => {
    const cells = [
      free(days[0]!),
      free(days[1]!),
      { date: days[2]!, state: 'OCCUPIED', itemId: 'x' },
    ];
    expect(checkDrop(source, row('B-12', 'DORM', cells))).toEqual({
      kind: 'blocked',
      fromDate: '2026-09-15',
      toDate: '2026-09-16',
      reason: 'Занято с 16 сент.',
    });
  });
  it('блокировка — drop закрыт, в причине тип блокировки', () => {
    const cells = [
      free(days[0]!),
      { date: days[1]!, state: 'BLOCKED', blockType: 'MAINTENANCE' },
      free(days[2]!),
    ];
    const verdict = checkDrop(source, row('B-12', 'DORM', cells));
    expect(verdict.kind).toBe('blocked');
    expect(verdict.kind === 'blocked' && verdict.reason).toMatch(/^Недоступно с 15 сент\.: /);
  });
  it('та же бронь в целевой строке (прежний переезд) — не конфликт', () => {
    const cells = [
      free(days[0]!),
      { date: days[1]!, state: 'OCCUPIED', itemId: 'item-1' },
      free(days[2]!),
    ];
    expect(checkDrop(source, row('B-12', 'DORM', cells)).kind).toBe('ok');
  });
  it('другая категория — переезжает всё проживание: с первой ночи плашки, а не с взятой клетки', () => {
    expect(checkDrop(source, row('R-01', 'ROOM', days.map(free)))).toEqual({
      kind: 'ok',
      fromDate: '2026-09-14',
      toDate: '2026-09-16',
      changesCategory: true,
    });
  });
  it('другая категория, а заезд раньше окна — drop закрыт: весь срок на экране не проверить', () => {
    const verdict = checkDrop(
      { ...source, startsBefore: true },
      row('R-01', 'ROOM', days.map(free)),
    );
    expect(verdict.kind).toBe('blocked');
    expect(verdict.kind === 'blocked' && verdict.reason).toContain('заезд раньше');
  });
});

/**
 * ТЗ §27: окно перед переселением — гость, откуда и куда, даты, разница в деньгах. Номер брони
 * остаётся в заголовке (DESIGN.md §14: заголовок — вопрос с номером брони), сырых дат нет.
 */
describe('moveQuestion: окно подтверждения переселения', () => {
  const same = {
    kind: 'ok',
    fromDate: '2026-09-15',
    toDate: '2026-09-16',
    changesCategory: false,
  } as const;
  it('та же категория: «стоимость не изменится», даты отрезком и число ночей', () => {
    const q = moveQuestion(source, 'B-12', same, {
      action: 'move',
      currentPriceMinor: '1200000',
      currency: 'KZT',
      changesCategory: false,
      differenceMinor: '0',
    });
    expect(q).toEqual({
      title: 'Переселить бронь 20260911-ABC123?',
      guest: 'Иван Петров',
      route: 'B-07 → B-12',
      dates: '15 сент. → 17 сент., 2 ночи',
      money: 'Стоимость не изменится',
      note: 'С 15 сент. ячейка B-07 освободится.',
    });
  });
  it('другая категория дороже: «+», сумма целиком, что станет с ценой', () => {
    const q = moveQuestion(
      source,
      'R-01',
      { ...same, fromDate: '2026-09-14', changesCategory: true },
      {
        action: 'move',
        currentPriceMinor: '1200000',
        currency: 'KZT',
        changesCategory: true,
        newPriceMinor: '2700000',
        differenceMinor: '1500000',
        categoryName: 'Двухместный номер',
      },
    );
    expect(q.dates).toBe('14 сент. → 17 сент., 3 ночи');
    expect(q.money).toBe('Разница стоимости: +15 000 ₸');
    expect(q.note).toBe(
      'Проживание станет 27 000 ₸ вместо 12 000 ₸: категория «Двухместный номер».',
    );
  });
  it('дешевле — минус «−» (U+2212), не дефис', () => {
    const q = moveQuestion(
      source,
      'R-01',
      { ...same, changesCategory: true },
      {
        action: 'move',
        currentPriceMinor: '2700000',
        currency: 'KZT',
        changesCategory: true,
        newPriceMinor: '1200000',
        differenceMinor: '-1500000',
      },
    );
    expect(q.money).toBe('Разница стоимости: −15 000 ₸');
  });
  it('проживание идёт дальше окна: выезд не угадываем', () => {
    const q = moveQuestion({ ...source, endsAfter: true }, 'B-12', same, null);
    expect(q.dates).toBe('с 15 сент. до выезда');
    // предпросмотр не ответил: действие не запрещаем, но о деньгах не молчим
    expect(q.money).toBe('Сумму посчитать не удалось — проверьте счёт после переселения.');
  });
});
