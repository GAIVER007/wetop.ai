import { describe, expect, it } from 'vitest';
import { ExelyImportError } from './errors';
import type { ReservationImportRecord, ReservationStatusCode } from './normalize-reservation';
import { markerCheckLine, normalizeEach, screenRecords, wetopMarker } from './sync-screen';

const record = (
  n: string,
  opts: { notes?: string | null; type?: string; room?: string | null; status?: ReservationStatusCode } = {},
): ReservationImportRecord => ({
  confirmationNumber: n,
  source: 'OTA',
  channel: 'booking.com',
  externalId: null,
  status: opts.status ?? 'CONFIRMED',
  arrivalDate: '2026-11-01',
  departureDate: '2026-11-03',
  adults: 1,
  children: 0,
  currency: 'KZT',
  totalAmountMinor: 1_800_000n,
  notes: opts.notes ?? null,
  customer: {
    exelyPersonId: `P-${n}`,
    firstName: 'Гость',
    lastName: 'Вымышленный',
    middleName: null,
    birthDate: null,
    citizenship: null,
    gender: 'UNKNOWN',
    email: null,
    phone: null,
    notes: null,
  },
  items: [
    {
      exelyRoomStayId: `S-${n}`,
      accommodationTypeCode: opts.type ?? 'exely-1',
      exelyRoomNumber: opts.room === undefined ? '101' : opts.room,
      arrivalDate: '2026-11-01',
      departureDate: '2026-11-03',
      priceMinor: 1_800_000n,
      paidMinor: 0n,
      refundMinor: 0n,
      status: opts.status ?? 'CONFIRMED',
      adults: 1,
      children: 0,
      guestExelyIds: [`P-${n}`],
    },
  ],
});
const known = {
  accommodationTypeCodes: new Set(['exely-1']),
  exelyRoomNumbers: new Set(['101']),
};

describe('метка ручной брони в Exely: «WETOP <номер брони PMS>» (ADR-064)', () => {
  it('находит номер PMS и в начале комментария, и после текста', () => {
    expect(wetopMarker('WETOP 20261101-7')).toBe('20261101-7');
    expect(wetopMarker('Гость просит нижнюю полку. WETOP BDC-4412345')).toBe('BDC-4412345');
  });

  it('код канала «BDC-WETOP-…», строчные буквы и слово без номера меткой не считаются', () => {
    expect(wetopMarker('BDC-WETOP-MU9GFRA8')).toBeNull();
    expect(wetopMarker('wetop 20261101-7')).toBeNull();
    expect(wetopMarker('WETOP')).toBeNull();
    expect(wetopMarker('WETOPX 20261101')).toBeNull();
    expect(wetopMarker(null)).toBeNull();
    expect(wetopMarker('')).toBeNull();
  });
});

describe('разбор карточек по одной: непонятная карточка не роняет прогон (Q-165)', () => {
  it('ошибка разбора пропускает только свою карточку и называет причину', () => {
    const out = normalizeEach(
      ['A', 'B', 'C'],
      (c) => c,
      (c) => {
        if (c === 'B') throw new ExelyImportError('Бронь B: неизвестный источник создания «Робот»');
        return record(c);
      },
    );
    expect(out.records.map((r) => r.confirmationNumber)).toEqual(['A', 'C']);
    expect(out.skipped).toEqual([
      { booking: 'B', reason: 'Бронь B: неизвестный источник создания «Робот»' },
    ]);
  });

  it('ошибка не разбора (сеть, код) по-прежнему останавливает прогон', () => {
    expect(() =>
      normalizeEach(
        ['A'],
        (c) => c,
        () => {
          throw new Error('ECONNRESET');
        },
      ),
    ).toThrow('ECONNRESET');
  });
});

describe('отбор записей до транзакции', () => {
  it('запись с меткой не переносится — бронь уже в PMS', () => {
    const out = screenRecords([record('E-1', { notes: 'WETOP 20261101-7' }), record('E-2')], known);
    expect(out.mirrored).toEqual([{ booking: 'E-1', pmsNumber: '20261101-7' }]);
    expect(out.importable.map((r) => r.confirmationNumber)).toEqual(['E-2']);
    expect(out.skipped).toEqual([]);
  });

  it('категория или единица, которых нет в фонде, пропускают запись с причиной (Q-165)', () => {
    const out = screenRecords(
      [record('E-3', { type: 'exely-999' }), record('E-4', { room: '999' }), record('E-5')],
      known,
    );
    expect(out.skipped).toEqual([
      { booking: 'E-3', reason: 'Бронь E-3: категории exely-999 нет в фонде PMS' },
      { booking: 'E-4', reason: 'Бронь E-4: единицы «999» нет в фонде PMS' },
    ]);
    expect(out.importable.map((r) => r.confirmationNumber)).toEqual(['E-5']);
  });

  it('у отменённого проживания неизвестная единица не мешает: импорт ячейку ему не ищет', () => {
    const out = screenRecords(
      [record('E-6', { room: '999', status: 'CANCELLED' }), record('E-7', { room: null })],
      known,
    );
    expect(out.importable.map((r) => r.confirmationNumber)).toEqual(['E-6', 'E-7']);
    expect(out.skipped).toEqual([]);
  });
});

describe('проверка метки на одной брони Exely — лист смены (шаг 9)', () => {
  it('метка есть — бронь не перенесётся второй раз', () => {
    expect(markerCheckLine('E-1', 'WETOP BDC-4412345')).toBe(
      'Бронь E-1: метка найдена — WETOP BDC-4412345. Досинхронизация эту бронь не перенесёт: она уже в PMS.',
    );
  });

  it('метки нет — называет причину и не печатает текст комментария', () => {
    expect(markerCheckLine('E-2', null)).toContain('комментарий заказчика пуст');
    const wrong = markerCheckLine('E-3', 'Гость Иванов, wetop bdc-1');
    expect(wrong).toContain('не в формате метки');
    expect(wrong).not.toContain('Иванов');
    const none = markerCheckLine('E-4', 'Гость Иванов просит нижнюю полку');
    expect(none).toContain('метки нет');
    expect(none).not.toContain('Иванов');
  });
});
