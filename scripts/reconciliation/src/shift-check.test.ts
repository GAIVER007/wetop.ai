import { describe, expect, it } from 'vitest';
import {
  checkShift,
  discrepancyId,
  logDelta,
  parseDay,
  parseLog,
  parseShiftTable,
  parseTenge,
  parseTime,
  reconcileBookings,
  reconcileCash,
  reconcileChannelIntake,
  reconcileMoney,
  reconcileNights,
  splitRecords,
  tenge,
  LOG_COLUMNS,
  LOG_HEADER,
  type ShiftSnapshot,
  type TableRow,
  type WetopBooking,
} from './shift-check';

/**
 * Сверка смены в ноль (двойная смена 06.10.2026, plans/double-shift-2026-10-06.md). Здесь чистые функции: разбор
 * таблицы смены, три списка (брони, деньги, остатки по ночам) и журнал расхождений между срезами.
 */

const HEADER =
  'время\tсобытие\tбронь\tзаезд\tвыезд\tкатегория\tсумма\tспособ\tканал\tкто\tкомментарий';
const tsv = (...rows: string[]) => [HEADER, ...rows].join('\n');

const row = (over: Partial<TableRow> & Pick<TableRow, 'event'>): TableRow => ({
  line: 2,
  time: null,
  booking: null,
  arrival: null,
  departure: null,
  amountMinor: null,
  method: null,
  channel: null,
  ...over,
});
const booking = (over: Partial<WetopBooking> & Pick<WetopBooking, 'number'>): WetopBooking => ({
  status: 'CONFIRMED',
  arrival: '2026-10-06',
  departure: '2026-10-08',
  source: 'DESK',
  channel: null,
  externalId: null,
  ...over,
});
const map = (...bs: WetopBooking[]) => new Map(bs.map((b) => [b.number, b]));

describe('значения ячеек', () => {
  it('сумма: пробелы, ₸, тиыны через запятую, разделитель тысяч; непонятное даёт null', () => {
    expect(parseTenge('12 000')).toBe(1_200_000n);
    expect(parseTenge('12\u00a0000,50 ₸')).toBe(1_200_050n);
    expect(parseTenge('12000.5')).toBe(1_200_050n);
    expect(parseTenge('12,000')).toBe(1_200_000n);
    expect(parseTenge('1.500')).toBe(150_000n);
    expect(parseTenge('12,000.00')).toBe(1_200_000n);
    expect(parseTenge('−5 000 тг')).toBe(-500_000n);
    expect(parseTenge('12,5')).toBe(1_250n);
    expect(parseTenge('пять тысяч')).toBeNull();
    expect(parseTenge('12.000,5.0')).toBeNull();
    expect(parseTenge('1,000,50')).toBeNull();
    expect(tenge(1_200_050n)).toBe('12 000,50 ₸');
    expect(tenge(150_000n)).toBe('1 500 ₸');
    expect(tenge(-500_000n)).toBe('−5 000 ₸');
  });

  it('дата: ДД.ММ.ГГГГ, ДД.ММ (год смены), ISO; несуществующая даёт null', () => {
    expect(parseDay('06.10.2026', 2026)).toBe('2026-10-06');
    expect(parseDay('6.10.26', 2026)).toBe('2026-10-06');
    expect(parseDay('07.10', 2026)).toBe('2026-10-07');
    expect(parseDay('2026-10-06', 2025)).toBe('2026-10-06');
    expect(parseDay('31.09.2026', 2026)).toBeNull();
    expect(parseDay('завтра', 2026)).toBeNull();
  });

  it('время: ЧЧ:ММ, Ч.ММ, с секундами; 25:00 даёт null', () => {
    expect(parseTime('9:05')).toBe('09:05');
    expect(parseTime('14.30')).toBe('14:30');
    expect(parseTime('14:30:59')).toBe('14:30');
    expect(parseTime('25:00')).toBeNull();
  });

  it('CSV с кавычками: разделитель и перевод строки внутри поля', () => {
    expect(splitRecords('a;"b;c";"d ""e"""\r\n1;"2\n3";4\n', ';')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2\n3', '4'],
    ]);
  });
});

describe('разбор таблицы смены', () => {
  it('копия из Google Таблицы (табуляция): события, суммы, способы и даты', () => {
    const { rows, problems } = parseShiftTable(
      tsv(
        '09:10\tНовая бронь\t20261006-ab2cde\t06.10.2026\t08.10.2026\tКойка\t\t\tСтойка\tАН\t',
        '09:12\tОплата\t20261006-AB2CDE\t\t\t\t12 000\tКаспи\t\tАН\t',
        '09:20\tЗаселение\t20261006-AB2CDE\t\t\t\t\t\t\tАН\t',
        '\t\t\t\t\t\t\t\t\t\t',
        '10:00\tРасход\t\t\t\t\t3 500\tНаличные\t\tАН\tвода',
      ),
      2026,
    );
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.line, r.event, r.booking])).toEqual([
      [2, 'new', '20261006-AB2CDE'],
      [3, 'payment', '20261006-AB2CDE'],
      [4, 'checkIn', '20261006-AB2CDE'],
      [6, 'expense', null],
    ]);
    expect(rows[0]).toMatchObject({
      arrival: '2026-10-06',
      departure: '2026-10-08',
      time: '09:10',
    });
    expect(rows[1]).toMatchObject({ amountMinor: 1_200_000n, method: 'KASPI' });
    expect(rows[3]).toMatchObject({ amountMinor: 350_000n, method: 'CASH' });
  });

  it('выгрузка CSV с «;», BOM и колонками в другом порядке', () => {
    const { rows, problems } = parseShiftTable(
      '\uFEFFСобытие;Сумма, ₸;Способ оплаты;Номер брони\r\nвозврат;"1 000,50";Карта (терминал);LX-1\r\n',
      2026,
    );
    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({
      event: 'refund',
      booking: 'LX-1',
      amountMinor: 100_050n,
      method: 'CARD_TERMINAL',
    });
  });

  it('ошибки ввода называются строкой таблицы, строка в сверку не идёт', () => {
    const { rows, problems } = parseShiftTable(
      tsv(
        '09:00\tзаселился\tA\t\t\t\t\t\t\t\t',
        '09:01\tоплата\tA\t\t\t\t12 000\tперевод\t\t\t',
        '09:02\tоплата\t\t\t\t\t\t\t\t\t',
        '09:03\tновая бронь\tB\t06.10.2026\t\t\t\t\t\t\t',
        '9:99\tотмена\tC\t08.10.2026\t07.10.2026\t\t\t\t\t\t',
      ),
      2026,
    );
    expect(rows).toEqual([]);
    expect(problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 6]);
    expect(problems[0]!.what).toContain('не понял событие «заселился»');
    // «перевод» без уточнения не угадывается: в WETOP физлицо и юрлицо это разные способы
    expect(problems[1]!.what).toContain('не понял способ «перевод»');
    expect(problems[2]!.what).toContain('нет номера брони');
    expect(problems[2]!.what).toContain('нет суммы');
    expect(problems[3]!.what).toContain('нужны даты заезда и выезда');
    expect(problems[4]!.what).toContain('не понял время «9:99»');
    expect(problems[4]!.what).toContain('не позже заезда');
  });

  it('без колонок «событие» и «бронь» сверять нечего: одна ошибка про заголовок', () => {
    const { rows, problems } = parseShiftTable('время\tномер\tсумма\n09:00\t12\t100\n', 2026);
    expect(rows).toEqual([]);
    expect(problems).toHaveLength(2);
    expect(problems[1]!.what).toContain('нет колонки «бронь»');
  });
});

describe('брони: таблица против WETOP', () => {
  it('в ноль: события WETOP есть в таблице, статус и даты совпадают', () => {
    const out = reconcileBookings({
      table: [
        row({
          line: 2,
          event: 'new',
          booking: 'A',
          arrival: '2026-10-06',
          departure: '2026-10-08',
        }),
        row({ line: 3, event: 'checkIn', booking: 'A' }),
      ],
      bookings: map(booking({ number: 'A', status: 'CHECKED_IN' })),
      aliases: new Map(),
      events: [
        { number: 'A', event: 'new', at: '2026-10-06 09:10' },
        { number: 'A', event: 'checkIn', at: '2026-10-06 09:20' },
      ],
    });
    expect(out).toEqual([]);
  });

  it('событие WETOP без строки таблицы; статус, объяснённый этой же строкой, второй раз не называется', () => {
    const out = reconcileBookings({
      table: [
        row({
          line: 2,
          event: 'new',
          booking: 'A',
          arrival: '2026-10-06',
          departure: '2026-10-08',
        }),
      ],
      bookings: map(booking({ number: 'A', status: 'CHECKED_IN' })),
      aliases: new Map(),
      events: [
        { number: 'A', event: 'new', at: '2026-10-06 09:10' },
        { number: 'A', event: 'checkIn', at: '2026-10-06 09:20' },
      ],
    });
    expect(out).toEqual([
      {
        list: 'брони',
        key: 'A',
        wetop: 'заезд 09:20',
        source: 'таблица',
        inSource: 'нет строки «заезд»',
        what: 'событие есть в WETOP, в таблице его нет',
      },
    ]);
  });

  it('бронь таблицы, которой нет в WETOP; статус и даты разные', () => {
    const out = reconcileBookings({
      table: [
        row({
          line: 2,
          event: 'new',
          booking: 'GHOST',
          arrival: '2026-10-06',
          departure: '2026-10-07',
        }),
        row({ line: 3, event: 'cancel', booking: 'B' }),
        row({
          line: 4,
          event: 'change',
          booking: 'C',
          arrival: '2026-10-06',
          departure: '2026-10-09',
        }),
      ],
      bookings: map(booking({ number: 'B' }), booking({ number: 'C' })),
      aliases: new Map(),
      events: [],
    });
    expect(out.map((d) => [d.key, d.what, d.wetop, d.inSource])).toEqual([
      [
        'GHOST',
        'бронь есть в таблице, в WETOP брони с таким номером нет',
        'брони нет',
        'новая бронь (строка 2)',
      ],
      ['B', 'статус брони разный', 'подтверждена', 'отмена (строка 3)'],
      ['C', 'даты проживания разные', '06.10.2026–08.10.2026', '06.10.2026–09.10.2026 (строка 4)'],
    ]);
  });

  it('в таблице номер брони в канале: сверяется с бронью WETOP, на которую он указывает', () => {
    const out = reconcileBookings({
      table: [row({ line: 2, event: 'checkIn', booking: '1556013801' })],
      bookings: map(booking({ number: 'BDC-1556013801', status: 'CHECKED_IN', source: 'OTA' })),
      aliases: new Map([['1556013801', 'BDC-1556013801']]),
      events: [{ number: 'BDC-1556013801', event: 'checkIn', at: '2026-10-06 12:00' }],
    });
    expect(out).toEqual([]);
  });

  it('переселение в WETOP строки таблицы не требует', () => {
    expect(
      reconcileBookings({
        table: [],
        bookings: map(booking({ number: 'A' })),
        aliases: new Map(),
        events: [{ number: 'A', event: 'move', at: '2026-10-06 12:00' }],
      }),
    ).toEqual([]);
  });
});

describe('брони канала: приём ревизий из Channex (без списка всех броней)', () => {
  const now = new Date('2026-10-06T09:30:00Z');
  const ev = (over: Partial<Parameters<typeof reconcileChannelIntake>[0]['events'][number]>) => ({
    revisionId: 'rev-1',
    type: 'booking_new',
    status: 'PROCESSED' as const,
    receivedAt: '2026-10-06T09:00:00Z',
    receivedLocal: '2026-10-06 14:00',
    lastError: null,
    uniqueId: 'BDC-1',
    otaName: 'Booking.com',
    reservationNumber: 'BDC-1',
    ...over,
  });
  const run = (over: Partial<Parameters<typeof reconcileChannelIntake>[0]> = {}) =>
    reconcileChannelIntake({
      events: [],
      feed: [],
      createdInShift: [],
      channelsViaChannex: [],
      linkedNumbers: [],
      now,
      ...over,
    });

  it('в ноль: ревизии обработаны и связаны с бронями, лента Channex пуста', () => {
    expect(
      run({ events: [ev({}), ev({ revisionId: 'rev-2', type: 'booking_cancelled' })] }),
    ).toEqual([]);
  });

  it('лента: ревизия ждёт подтверждения дольше 10 минут, свежая ещё не расхождение', () => {
    const out = run({
      feed: [
        {
          id: 'r1',
          uniqueId: 'BDC-OLD',
          status: 'new',
          insertedAt: '2026-10-06T09:15:00Z',
          insertedLocal: '2026-10-06 14:15',
        },
        {
          id: 'r2',
          uniqueId: 'BDC-NEW',
          status: 'new',
          insertedAt: '2026-10-06T09:25:00Z',
          insertedLocal: '2026-10-06 14:25',
        },
      ],
    });
    expect(out.map((d) => [d.key, d.what])).toEqual([
      ['BDC-OLD', 'Channex держит ревизию неподтверждённой дольше 10 минут: WETOP её не принял'],
    ]);
  });

  it('журнал приёма: упала, застряла, обработана без брони, отмена брони, которой нет', () => {
    const out = run({
      events: [
        ev({ uniqueId: 'BDC-F', status: 'FAILED', lastError: 'room_type_id не сопоставлен' }),
        ev({ uniqueId: 'BDC-S', status: 'PROCESSING', receivedAt: '2026-10-06T09:10:00Z' }),
        ev({ uniqueId: 'BDC-FRESH', status: 'RECEIVED', receivedAt: '2026-10-06T09:25:00Z' }),
        ev({ uniqueId: 'BDC-N', reservationNumber: null }),
        ev({ uniqueId: 'BDC-C', type: 'booking_cancelled', reservationNumber: null }),
      ],
    });
    expect(out.map((d) => [d.key, d.what])).toEqual([
      ['BDC-F', 'ревизия из канала не обработана'],
      ['BDC-S', 'ревизия застряла в обработке дольше 10 минут'],
      ['BDC-N', 'ревизия обработана, а брони в WETOP нет'],
      ['BDC-C', 'пришла отмена брони, которой в WETOP нет: раньше не дошла сама бронь'],
    ]);
    expect(out[0]!.wetop).toBe('ошибка: room_type_id не сопоставлен');
  });

  it('бронь канала, который идёт через Channex, заведена за смену руками: риск двойного ввода', () => {
    const out = run({
      channelsViaChannex: ['BookingCom'],
      linkedNumbers: ['BDC-1'],
      createdInShift: [
        booking({ number: '20261006-MANUAL', source: 'OTA', channel: 'Booking.com' }),
        booking({ number: 'BDC-1', source: 'OTA', channel: 'Booking.com' }),
        booking({ number: '20261006-HW', source: 'OTA', channel: 'Hostelworld' }),
        booking({ number: '20261006-DESK', source: 'DESK' }),
      ],
    });
    expect(out.map((d) => [d.key, d.source])).toEqual([['20261006-MANUAL', 'Channex']]);
    expect(out[0]!.what).toContain('заведена в WETOP руками');
  });
});

describe('деньги', () => {
  const op = (over: Partial<Parameters<typeof reconcileMoney>[1][number]>) => ({
    kind: 'PAYMENT' as const,
    status: 'COMPLETED' as const,
    method: 'CASH',
    amountMinor: 1_200_000n,
    number: 'A',
    localAt: '2026-10-06 10:00',
    ...over,
  });

  it('в ноль: каждая операция в паре; аннулированные и переводы кассы не считаются', () => {
    const { discrepancies, totals } = reconcileMoney(
      [
        row({ line: 2, event: 'payment', booking: 'A', amountMinor: 1_200_000n, method: 'CASH' }),
        row({ line: 3, event: 'expense', amountMinor: 350_000n, method: 'CASH' }),
      ],
      [
        op({}),
        op({ kind: 'EXPENSE', number: null, amountMinor: 350_000n }),
        op({ status: 'VOIDED', amountMinor: 999n }),
        op({ kind: 'TRANSFER', number: null }),
      ],
    );
    expect(discrepancies).toEqual([]);
    expect(totals.voided).toBe(1);
    expect(totals.transfers).toBe(1);
  });

  it('разный способ, разная сумма, лишняя строка с каждой стороны: по строке на причину', () => {
    const { discrepancies } = reconcileMoney(
      [
        row({ line: 2, event: 'payment', booking: 'A', amountMinor: 1_200_000n, method: 'CASH' }),
        row({ line: 3, event: 'payment', booking: 'B', amountMinor: 500_000n, method: 'KASPI' }),
        row({ line: 4, event: 'refund', booking: 'C', amountMinor: 100_000n, method: 'CASH' }),
      ],
      [
        op({ method: 'KASPI' }),
        op({ number: 'B', method: 'KASPI', amountMinor: 50_000n }),
        op({ number: 'D', amountMinor: 700_000n }),
      ],
    );
    expect(discrepancies.map((d) => [d.key, d.what])).toEqual([
      ['A оплата', 'способ оплаты разный'],
      ['B оплата', 'сумма разная'],
      ['C возврат', 'в таблице есть, в WETOP нет'],
      ['D оплата', 'в WETOP есть, в таблице нет'],
    ]);
    expect(discrepancies[0]).toMatchObject({
      wetop: '12 000 ₸, Kaspi, 10:00',
      inSource: '12 000 ₸, Наличные (строка 2)',
    });
  });

  it('предоплата канала, которую WETOP записал сам, без строки таблицы не расхождение', () => {
    const { discrepancies, totals } = reconcileMoney(
      [],
      [op({ method: 'EXTERNAL', number: 'BDC-1' })],
    );
    expect(discrepancies).toEqual([]);
    expect(totals.channelPrepaid).toBe(1_200_000n);
  });

  it('оплата записана в таблице номером канала', () => {
    const { discrepancies } = reconcileMoney(
      [row({ event: 'payment', booking: '1556013801', amountMinor: 1_200_000n, method: 'CASH' })],
      [op({ number: 'BDC-1556013801' })],
      new Map([['1556013801', 'BDC-1556013801']]),
    );
    expect(discrepancies).toEqual([]);
  });

  it('пересчёт кассы: насчитано не равно ожидаемому', () => {
    expect(reconcileCash(null)).toEqual([]);
    expect(
      reconcileCash({ localAt: '2026-10-06 22:00', expectedMinor: 100n, countedMinor: 100n }),
    ).toEqual([]);
    const [d] = reconcileCash({
      localAt: '2026-10-06 22:00',
      expectedMinor: 5_000_000n,
      countedMinor: 4_900_000n,
    });
    expect(d).toMatchObject({
      list: 'деньги',
      key: 'касса, Наличные',
      what: 'в кассе меньше, чем по WETOP, на 1 000 ₸',
    });
  });
});

describe('остатки по ночам', () => {
  const now = new Date('2026-10-06T09:00:00Z');
  it('канал видит больше (опасно), меньше, нет значения; двойная продажа на шахматке', () => {
    const out = reconcileNights(
      [
        { category: 'DORM6', date: '2026-10-06', wetop: 2, channex: 2 },
        { category: 'DORM6', date: '2026-10-07', wetop: 0, channex: 1 },
        { category: 'DORM6', date: '2026-10-08', wetop: 3, channex: 1 },
        { category: 'DBL', date: '2026-10-06', wetop: 1, channex: null },
      ],
      [
        { category: 'DORM6', date: '2026-10-06', units: 6, occupied: 4, blocked: 0, unassigned: 2 },
        { category: 'DBL', date: '2026-10-06', units: 2, occupied: 1, blocked: 1, unassigned: 1 },
      ],
      null,
      now,
    );
    expect(out.map((d) => [d.key, d.what])).toEqual([
      ['DORM6 07.10', 'канал видит больше мест, чем свободно: продаст лишнее'],
      ['DORM6 08.10', 'канал видит меньше мест, чем свободно: недопродажа'],
      ['DBL 06.10', 'в Channex нет остатка на эту ночь'],
      ['DBL 06.10', 'двойная продажа: без ячейки на 1 больше, чем свободных ячеек'],
    ]);
  });

  it('очередь к Channex: упавшие, зависшие дольше 10 минут, выключенный ARI; свежая очередь не расхождение', () => {
    const at = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
    expect(
      reconcileNights(
        [],
        [],
        { pending: 3, failed: 0, oldestPendingAt: at(2), ariStopped: false },
        now,
      ),
    ).toEqual([]);
    const out = reconcileNights(
      [],
      [],
      { pending: 3, failed: 2, oldestPendingAt: at(15), ariStopped: true },
      now,
    );
    expect(out.map((d) => d.what)).toEqual([
      'ARI выключен (scripts/ops/ari.sh stop): каналы не узнают об изменениях',
      'изменения остатков не дошли до Channex',
      'очередь к Channex стоит дольше 10 минут',
    ]);
  });
});

describe('журнал расхождений между срезами', () => {
  const d1 = {
    list: 'брони' as const,
    key: 'A',
    wetop: 'заезд 09:20',
    source: 'таблица',
    inSource: 'нет строки «заезд»',
    what: 'x',
  };
  const d2 = { ...d1, key: 'B' };
  const d3 = { ...d1, key: 'C' };

  it('номер зависит только от содержания и начинается с буквы списка', () => {
    expect(discrepancyId(d1)).toBe(discrepancyId({ ...d1 }));
    expect(discrepancyId(d1)).not.toBe(discrepancyId(d2));
    expect(discrepancyId(d1)).toMatch(/^Б-[0-9a-f]{6}$/);
    expect(discrepancyId({ ...d1, list: 'деньги' })).toMatch(/^Д-/);
  });

  it('открытое второй раз не пишется, разобранное и снова видное пишется заново, пропавшее идёт в «сошлось»', () => {
    const log = parseLog(
      [
        LOG_HEADER.trimEnd(),
        `${discrepancyId(d1)};06.10.2026 10:00;брони;A;;таблица;;x;открыто;;`,
        `${discrepancyId(d2)};06.10.2026 10:00;брони;B;;таблица;;x;Разобрано.;ввод;АН`,
        `${discrepancyId(d3)};06.10.2026 10:00;брони;C;;таблица;;x;открыто;;`,
      ].join('\r\n'),
    );
    const delta = logDelta([d1, d2, { ...d1, key: 'NEW' }], log);
    expect(delta.stillOpen).toEqual([discrepancyId(d1)]);
    expect(delta.fresh.map((f) => [f.key, f.again])).toEqual([
      ['B', true],
      ['NEW', false],
    ]);
    expect(delta.converged).toEqual([discrepancyId(d3)]);
  });
});

describe('срез целиком', () => {
  const snapshot = (over: Partial<ShiftSnapshot> = {}): ShiftSnapshot => ({
    date: '2026-10-06',
    from: '00:00',
    to: '14:05',
    at: '2026-10-06 14:05',
    bookings: map(booking({ number: 'A', status: 'CHECKED_IN' })),
    aliases: new Map(),
    events: [
      { number: 'A', event: 'new', at: '2026-10-06 09:10' },
      { number: 'A', event: 'checkIn', at: '2026-10-06 09:20' },
    ],
    eventsTruncated: false,
    operations: [
      {
        kind: 'PAYMENT',
        status: 'COMPLETED',
        method: 'KASPI',
        amountMinor: 1_200_000n,
        number: 'A',
        localAt: '2026-10-06 09:12',
      },
    ],
    operationsTruncated: false,
    cash: null,
    nights: {
      cells: [{ category: 'DORM6', date: '2026-10-06', wetop: 2, channex: 2 }],
      board: [],
      outbox: { pending: 0, failed: 0, oldestPendingAt: null, ariStopped: false },
      channexSkipped: null,
    },
    intake: {
      events: [],
      feed: [],
      createdInShift: [],
      channelsViaChannex: [],
      linkedNumbers: [],
      feedSkipped: null,
    },
    ...over,
  });
  const table = parseShiftTable(
    tsv(
      '09:10\tновая бронь\tA\t06.10.2026\t08.10.2026\t\t\t\t\t\t',
      '09:12\tоплата\tA\t\t\t\t12 000\tKaspi\t\t\t',
      '09:20\tзаезд\tA\t\t\t\t\t\t\t\t',
    ),
    2026,
  );
  const now = new Date('2026-10-06T09:05:00Z');

  it('в ноль: код 0, журнал не трогается', () => {
    const r = checkShift({ table, snapshot: snapshot(), logText: '', now });
    expect(r.exitCode).toBe(0);
    expect(r.csv).toBe('');
    expect(r.summary).toContain('ИТОГ: в ноль по всем трём спискам');
  });

  it('расхождение: код 1, строка журнала с заголовком в новый файл, без заголовка в старый', () => {
    const s = snapshot({
      operations: [
        {
          kind: 'PAYMENT',
          status: 'COMPLETED',
          method: 'CASH',
          amountMinor: 1_200_000n,
          number: 'A',
          localAt: '2026-10-06 09:12',
        },
      ],
    });
    const first = checkShift({ table, snapshot: s, logText: '', now });
    expect(first.exitCode).toBe(1);
    expect(first.csv.startsWith(LOG_HEADER)).toBe(true);
    const line = first.csv.slice(LOG_HEADER.length);
    expect(line).toMatch(
      /^Д-[0-9a-f]{6};06\.10\.2026 14:05;деньги;A оплата;12 000 ₸, Наличные, 09:12;таблица;12 000 ₸, Kaspi \(строка 3\);способ оплаты разный;открыто;;\r\n$/,
    );
    expect(first.summary).toContain(LOG_COLUMNS.join('\t'));
    const second = checkShift({ table, snapshot: s, logText: first.csv, now });
    expect(second.csv).toBe('');
    expect(second.summary).toContain('Ещё не сошлись');
  });

  it('Channex не сверен: расхождений нет, но код 3 и «не сверено» в строке списка', () => {
    const r = checkShift({
      table,
      snapshot: snapshot({
        intake: {
          events: [],
          feed: null,
          createdInShift: [],
          channelsViaChannex: [],
          linkedNumbers: [],
          feedSkipped: 'нет CHANNEX_API_KEY',
        },
      }),
      logText: '',
      now,
    });
    expect(r.exitCode).toBe(3);
    expect(r.summary).toMatch(/Брони\s+не сверено/);
    expect(r.summary).toContain('лента Channex не прочитана: нет CHANNEX_API_KEY');
  });
});
