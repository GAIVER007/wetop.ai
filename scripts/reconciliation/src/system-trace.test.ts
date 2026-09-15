/**
 * Сквозная проверка слоёв: разбор экранов WETOP и сравнение слоёв. Разметка в образцах — как в живой отдаче
 * next start 14.09.2026 (карточка брони, «Обзор дня», шахматка); гости вымышленные (ADR-010).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STATUS_LABEL,
  deskCounts,
  exelyVerdict,
  htmlText,
  explainedByPending,
  layerMismatches,
  minorFromText,
  parseStayCells,
  parseStayRows,
  stayDiff,
  testIdText,
} from './system-trace';

const CARD = `<table><tbody>
<tr data-testid="stay-row"><td class="mono">8</td><td>Общая мужская комната</td><td>2026-09-14</td><td>2026-09-16</td><td><span class="badge badge--info">подтверждена</span></td><td class="num">11 508,30 ₸</td><td>Гость Тест<span class="hint" data-testid="stay-guests-count"> <!-- -->· <!-- -->1</span></td></tr>
<tr data-testid="stay-row"><td class="mono"><span class="warn-text">не назначена</span></td><td>Одноместная без окон</td><td>2026-09-13</td><td>2026-09-16</td><td><span class="badge badge--warning">заселён</span></td><td class="num">−500,00 ₸</td><td>—</td></tr>
</tbody></table>
<section hidden=""><p class="muted">Операции и изменения по бронированию 20260914-513903-1263693976<!-- -->.</p></section>`;

const TODAY = `<strong class="desk-metric-value" data-testid="c-inhouse">50</strong><div class="desk-metric-hint"><span data-testid="c-tocheckin">19</span> <!-- -->ожидают заселения</div>`;

const BOARD = `<span data-testid="occupied-2026-09-14">68</span>
<a data-testid="stay-cell" data-number="20260911-513903-1262708919" data-item-id="609cd62c-aaa8-4fc8-8819-4433bc3c316a" data-date="2026-09-14" data-unit-code="1" draggable="true" aria-label="Гость Тест · 20260911-513903-1262708919 · заселён" href="/reservations/20260911-513903-1262708919">
<td data-state="FREE" data-date="2026-09-14"></td>`;

describe('разбор экранов WETOP', () => {
  it('строки проживаний: ячейка, категория, даты, статус, цена; «не назначена» → null, минус из U+2212', () => {
    expect(parseStayRows(CARD)).toEqual([
      {
        unitCode: '8',
        category: 'Общая мужская комната',
        arrivalDate: '2026-09-14',
        departureDate: '2026-09-16',
        statusLabel: 'подтверждена',
        priceMinor: '1150830',
      },
      {
        unitCode: null,
        category: 'Одноместная без окон',
        arrivalDate: '2026-09-13',
        departureDate: '2026-09-16',
        statusLabel: 'заселён',
        priceMinor: '-50000',
      },
    ]);
  });

  it('значение по data-testid без комментариев React', () => {
    expect(testIdText(TODAY, 'c-inhouse')).toBe('50');
    expect(testIdText(TODAY, 'c-tocheckin')).toBe('19');
    expect(testIdText(BOARD, 'occupied-2026-09-14')).toBe('68');
    expect(testIdText(TODAY, 'c-free')).toBeNull();
  });

  it('клетки шахматки: номер, проживание, дата и ячейка — атрибуты data-date свободных клеток не путают', () => {
    expect(parseStayCells(BOARD)).toEqual([
      {
        number: '20260911-513903-1262708919',
        itemId: '609cd62c-aaa8-4fc8-8819-4433bc3c316a',
        date: '2026-09-14',
        unitCode: '1',
      },
    ]);
  });

  it('текст и суммы: сущности, неразрывные пробелы, пустое', () => {
    expect(htmlText('<b>a&amp;b</b>&nbsp; c\u202fd')).toBe('a&b c d');
    expect(minorFromText('12 000,00 ₸ · к оплате')).toBe('1200000');
    expect(minorFromText('—')).toBeNull();
  });

  it('подписи статусов совпадают с карточкой брони в коде стойки', () => {
    const page = readFileSync(
      resolve(import.meta.dirname, '../../../apps/web/src/app/reservations/[number]/page.tsx'),
      'utf8',
    );
    for (const [status, label] of Object.entries(STATUS_LABEL))
      expect(page, status).toContain(`${status}: '${label}'`);
  });
});

describe('сравнение слоёв', () => {
  const stay = {
    status: 'CONFIRMED',
    arrivalDate: '2026-09-14',
    departureDate: '2026-09-16',
    categoryCode: 'exely-5074688',
    priceMinor: '1150830',
  };

  it('расхождение называет поле и оба значения', () => {
    expect(stayDiff(stay, stay)).toEqual([]);
    expect(stayDiff(stay, { ...stay, status: 'CHECKED_IN', priceMinor: '1' })).toEqual([
      'статус CONFIRMED ≠ CHECKED_IN',
      'цена 1150830 ≠ 1',
    ]);
  });

  it('бронь, изменённая в Exely после старта синхронизации, «в пути», более ранняя — расхождение', () => {
    const sync = '2026-09-14T07:40:00.000Z';
    expect(exelyVerdict([], '2026-09-14T07:45:00Z', sync)).toBe('ok');
    expect(exelyVerdict(['статус'], '2026-09-14T07:45:00Z', sync)).toBe('pending-sync');
    expect(exelyVerdict(['статус'], '2026-09-14T07:10:00Z', sync)).toBe('mismatch');
    expect(exelyVerdict(['статус'], null, sync)).toBe('mismatch');
  });

  it('счётчики дня по правилам стойки: отмены не считаются, живущий с выездом сегодня — в выездах', () => {
    const day = '2026-09-14';
    expect(
      deskCounts(
        [
          { status: 'CONFIRMED', arrivalDate: day, departureDate: '2026-09-15' },
          { status: 'CHECKED_IN', arrivalDate: day, departureDate: '2026-09-16' },
          { status: 'CHECKED_IN', arrivalDate: '2026-09-12', departureDate: day },
          { status: 'CHECKED_IN', arrivalDate: '2026-09-12', departureDate: '2026-09-20' },
          { status: 'CHECKED_OUT', arrivalDate: '2026-09-10', departureDate: day },
          { status: 'CANCELLED', arrivalDate: day, departureDate: '2026-09-15' },
          { status: 'NO_SHOW', arrivalDate: day, departureDate: '2026-09-15' },
          { status: 'CONFIRMED', arrivalDate: '2026-09-15', departureDate: '2026-09-16' },
        ],
        day,
      ),
    ).toEqual({ arrivals: 2, departures: 2, inHouse: 2, toCheckIn: 1, toCheckOut: 1 });
  });

  it('брони «в пути» объясняют расхождение только по размеру, а не самим фактом', () => {
    const rows = [{ metric: 'проживают', values: { exely: 55, db: 52, api: 52, ui: '52' } }];
    // три брони «в пути» объясняют разницу в три единицы
    expect(explainedByPending(rows, 3)).toBe(true);
    // одна — уже нет: раньше любая бронь «в пути» превращала расхождение в предупреждение
    expect(explainedByPending(rows, 1)).toBe(false);
    expect(explainedByPending(rows, 0)).toBe(false);
  });

  it('нечисловое расхождение бронями «в пути» не объясняется', () => {
    expect(
      explainedByPending([{ metric: 'ячейка', values: { db: 'M03', api: 'M04' } }], 10),
    ).toBe(false);
  });

  it('показатель расходится, только если различаются слои, где он есть', () => {
    expect(
      layerMismatches([
        { metric: 'заезды', values: { exely: 23, db: 23, api: 23, ui: '23' } },
        { metric: 'проживают', values: { exely: null, db: 50, api: 50, ui: '50' } },
        { metric: 'выезды', values: { exely: 29, db: 28, api: 28, ui: '28' } },
      ]).map((r) => r.metric),
    ).toEqual(['выезды']);
  });
});
