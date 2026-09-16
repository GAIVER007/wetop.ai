/** Isolated, synthetic API for browser checks. Never connects to a database or provider. */
import { createServer } from 'node:http';
import {
  parseMoney,
  assertAllocationsMatch,
  buildDashboard,
  previousPeriod,
  type DashboardPeriod,
} from '@pms/domain';
import type { DataConnection } from '@pms/shared';
import type {
  Chessboard,
  DeskDay,
  DeskRow,
  GuestCard,
  InventoryUnit,
  ReservationCard,
  ReservationFinance,
  UnitCard,
  TrackedSite,
  SiteReport,
  Incident,
  InboundEvent,
} from '../../apps/web/src/lib/api';

const demo = process.env.WETOP_PREVIEW_MODE === 'demo';
let propertyName = 'Luxx Aparts';
let connectionState: DataConnection['state'] = 'READY';
let holdHotel = false;
const hotelWaiters = new Set<() => void>();
function setHotelHold(value: boolean) {
  holdHotel = value;
  if (!value) {
    for (const resolve of hotelWaiters) resolve();
    hotelWaiters.clear();
  }
}
const port = demo ? 4312 : 4311;
const names = [
  'Daniel Kim',
  'Maria Lopez',
  'Алия Садыкова',
  'Тимур Ким',
  'Alex Morgan',
  'Камила Асан',
  'James Wilson',
  'София Павлова',
];
let today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dates = (from: string, to: string) => {
  const result: string[] = [];
  for (let d = from; d <= to && result.length < 366; d = add(d, 1)) result.push(d);
  return result;
};
const categories = [
  { code: 'ROOM', name: 'Двухместный номер', count: 16, prefix: 'R', capacityAdults: 2 },
  { code: 'MALE', name: 'Мужской общий номер', count: 36, prefix: 'M', capacityAdults: 1 },
  { code: 'FEMALE', name: 'Женский общий номер', count: 36, prefix: 'F', capacityAdults: 1 },
];
const units: InventoryUnit[] = categories.flatMap((c) =>
  Array.from({ length: c.count }, (_, i) => ({
    code: `${c.prefix}${String(i + 1).padStart(2, '0')}`,
    exelyRoomNumber: null,
    kind: c.code === 'ROOM' ? 'ROOM' : 'BED',
    accommodationTypeCode: c.code,
    accommodationTypeName: c.name,
    roomNumber: `${c.prefix}${Math.floor(i / 6) + 1}`,
    roomCapacity: c.code === 'ROOM' ? 2 : 6,
    isDorm: c.code !== 'ROOM',
  })),
);
const plans = [{ code: 'BASE', name: 'Стандартный', currency: 'KZT', active: true }];
const guestSeed: GuestCard = {
  id: 'ui-guest',
  firstName: 'Тестовый',
  lastName: 'Гость',
  middleName: null,
  birthDate: null,
  citizenship: 'KAZ',
  gender: 'UNKNOWN',
  phone: null,
  email: 'guest@example.invalid',
  notes: 'Вымышленные данные для проверки интерфейса',
  documents: [],
  stays: [
    {
      confirmationNumber: '20260913-TESTAA',
      accommodationTypeName: categories[0]!.name,
      arrivalDate: today,
      departureDate: add(today, 3),
      status: 'CONFIRMED',
      unitCode: 'R01',
    },
  ],
};
function cardSeed(): ReservationCard {
  return {
    confirmationNumber: '20260913-TESTAA',
    source: 'PHONE',
    channel: null,
    status: 'CONFIRMED',
    arrivalDate: today,
    departureDate: add(today, 3),
    adults: 1,
    children: 0,
    currency: 'KZT',
    totalAmountMinor: '2400000',
    notes: 'Пожелание: тихая комната',
    primaryGuest: { id: 'ui-guest', label: 'Гость Тестовый', citizenship: 'KAZ', phone: null },
    items: [
      {
        id: 'ui-item',
        accommodationTypeCode: 'ROOM',
        accommodationTypeName: categories[0]!.name,
        arrivalDate: today,
        departureDate: add(today, 3),
        status: 'CONFIRMED',
        priceMinor: '2400000',
        ratePlanCode: plans[0]!.code,
        ratePlanName: plans[0]!.name,
        adults: 1,
        children: 0,
        unitCode: 'R01',
        guests: [{ label: 'Гость Тестовый', isPrimary: true }],
      },
    ],
  };
}
let card = cardSeed();
let guest = structuredClone(guestSeed);
const extraCards = new Map<string, ReservationCard>();
const extraGuests = new Map<string, GuestCard>();
function initializeRecords() {
  extraCards.clear();
  extraGuests.clear();
  if (demo) {
    const [firstName, lastName] = names[0]!.split(' ');
    guest.firstName = firstName!;
    guest.lastName = lastName!;
    card.primaryGuest!.label = `${lastName} ${firstName}`;
    card.items[0]!.guests[0]!.label = card.primaryGuest!.label;
  }
  for (let i = 1; i < 8; i++) {
    const r = cardSeed();
    const g = structuredClone(guestSeed);
    const label = demo ? names[i]! : ['Посетитель Демо', 'Клиент Пример', 'Гость Учебный'][i % 3]!;
    const words = label.split(' ');
    g.id = `ui-guest-${i}`;
    g.firstName = words.slice(1).join(' ');
    g.lastName = words[0]!;
    r.confirmationNumber = `20260913-TEST${i}`;
    r.status = i === 1 ? 'CONFIRMED' : i === 4 ? 'CHECKED_OUT' : 'CHECKED_IN';
    r.arrivalDate = i < 3 ? today : add(today, -2);
    r.departureDate = i === 3 || i === 4 ? today : add(today, 3);
    r.source = i % 2 ? 'OTA' : 'PHONE';
    r.channel = i % 2 ? 'Booking.com' : null;
    r.primaryGuest = { id: g.id, label, citizenship: g.citizenship, phone: g.phone };
    const unit = units.find(
      (u) => u.code === ['R01', 'R02', 'R03', 'R04', 'R05', 'M01', 'M02', 'F01'][i],
    )!;
    r.items[0] = {
      ...r.items[0]!,
      id: `ui-item-${i}`,
      status: r.status,
      arrivalDate: r.arrivalDate,
      departureDate: r.departureDate,
      unitCode: unit.code,
      accommodationTypeCode: unit.accommodationTypeCode,
      accommodationTypeName: unit.accommodationTypeName,
      guests: [{ label, isPrimary: true }],
    };
    extraCards.set(r.confirmationNumber, r);
    extraGuests.set(g.id, g);
  }
}
initializeRecords();
/**
 * Крайние случаи для дизайн-системы (plans/design-system-2026-09-14.md, шаг 1). Включаются только
 * `POST /__test/design-seed`, обычные UI-тесты их не видят. Все имена вымышленные (ADR-010).
 */
let designEvents: InboundEvent[] = [];
const DESIGN_STAYS: Array<{
  n: string;
  label: string;
  status: string;
  source: string;
  channel: string | null;
  unit: string | null;
  from: number;
  to: number;
  price: string;
}> = [
  {
    n: 'DSG-TENT',
    label: 'Ақбота Нұрсұлтанқызы Әбдіғаппарова',
    status: 'TENTATIVE',
    source: 'OTA',
    channel: 'Trip.com',
    unit: 'R06',
    from: 1,
    to: 4,
    price: '3600000',
  },
  {
    n: 'DSG-CANC',
    label: 'Посетитель Отменённый',
    status: 'CANCELLED',
    source: 'OTA',
    channel: 'Agoda',
    unit: 'R07',
    from: 0,
    to: 2,
    price: '1600000',
  },
  {
    n: 'DSG-NOSH',
    label: 'Клиент Незаезд',
    status: 'NO_SHOW',
    source: 'OTA',
    channel: 'Expedia',
    unit: 'R07',
    from: -1,
    to: 1,
    price: '1600000',
  },
  {
    n: 'DSG-HWL',
    label: 'Constantine-Alexander Featherstonehaugh-Wentworth',
    status: 'CONFIRMED',
    source: 'OTA',
    channel: 'Hostelworld',
    unit: 'M03',
    from: 0,
    to: 6,
    price: '2700000',
  },
  {
    n: 'DSG-OVK',
    label: 'Анна-Мария Константинопольская-Щербатова',
    status: 'CHECKED_IN',
    source: 'OTA',
    channel: 'Ostrovok',
    unit: 'F02',
    from: -3,
    to: 2,
    price: '2250000',
  },
  {
    n: 'DSG-BDC',
    label: 'Гость Букинг',
    status: 'CONFIRMED',
    source: 'OTA',
    channel: 'Booking.com',
    unit: 'M04',
    from: 2,
    to: 3,
    price: '450000',
  },
  {
    n: 'DSG-WEB',
    label: 'Гость Сайт',
    status: 'CONFIRMED',
    source: 'WEBSITE',
    channel: null,
    unit: 'M05',
    from: 1,
    to: 2,
    price: '450000',
  },
  {
    n: 'DSG-DESK',
    label: 'Гость Стойка',
    status: 'CHECKED_IN',
    source: 'DESK',
    channel: null,
    unit: 'R08',
    from: -1,
    to: 1,
    price: '1600000',
  },
  // проживание без ячейки — строка «Без ячейки» над сеткой (Д3)
  {
    n: 'DSG-UNAS',
    label: 'Гость Без-Ячейки',
    status: 'CONFIRMED',
    source: 'OTA',
    channel: 'Booking.com',
    unit: null,
    from: 0,
    to: 2,
    price: '1600000',
  },
];
function designCard(d: (typeof DESIGN_STAYS)[number], arrival: string, departure: string) {
  const unit = d.unit ? units.find((u) => u.code === d.unit)! : null;
  const category = unit
    ? categories.find((c) => c.code === unit.accommodationTypeCode)!
    : categories[0]!;
  const words = d.label.split(' ');
  const g = structuredClone(guestSeed);
  g.id = `ui-guest-${d.n}`;
  g.lastName = words[0]!;
  g.firstName = words.slice(1).join(' ') || 'Гость';
  const r = cardSeed();
  r.confirmationNumber = `20260916-${d.n}`;
  r.status = d.status;
  r.source = d.source;
  r.channel = d.channel;
  r.arrivalDate = arrival;
  r.departureDate = departure;
  r.totalAmountMinor = d.price;
  r.primaryGuest = { id: g.id, label: d.label, citizenship: 'KAZ', phone: null };
  r.items[0] = {
    ...r.items[0]!,
    id: `ui-item-${d.n}`,
    status: d.status,
    arrivalDate: arrival,
    departureDate: departure,
    priceMinor: d.price,
    unitCode: unit?.code ?? null,
    accommodationTypeCode: category.code,
    accommodationTypeName: category.name,
    guests: [{ label: d.label, isPrimary: true }],
  };
  return { r, g };
}
function seedDesign() {
  for (const d of DESIGN_STAYS) {
    const { r, g } = designCard(d, add(today, d.from), add(today, d.to));
    extraCards.set(r.confirmationNumber, r);
    extraGuests.set(g.id, g);
  }
  // месяц, в котором заняты все 88 из 88: следующий календарный месяц, по одному проживанию на ячейку
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const monthFrom = next.toISOString().slice(0, 10);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const monthTo = next.toISOString().slice(0, 10);
  units.forEach((u, i) => {
    const d = {
      n: `FULL${String(i + 1).padStart(2, '0')}`,
      label: `Гость Полный-${String(i + 1).padStart(2, '0')}`,
      status: 'CONFIRMED',
      source: i % 3 ? 'OTA' : 'DESK',
      channel: i % 3 ? (['Booking.com', 'Trip.com', 'Agoda'][i % 3] ?? null) : null,
      unit: u.code,
      from: 0,
      to: 0,
      price: u.kind === 'ROOM' ? '24800000' : '13950000',
    };
    const { r, g } = designCard(d, monthFrom, monthTo);
    extraCards.set(r.confirmationNumber, r);
    extraGuests.set(g.id, g);
  });
  // блокировки с причиной и три статуса уборки
  blocks.set('R09', [
    {
      id: 'dsg-block-1',
      dateFrom: today,
      dateTo: add(today, 3),
      type: 'MAINTENANCE',
      reason: 'ремонт: кондиционер',
    },
  ]);
  blocks.set('M06', [
    {
      id: 'dsg-block-2',
      dateFrom: add(today, -1),
      dateTo: add(today, 1),
      type: 'OUT_OF_ORDER',
      reason: 'нет матраса',
    },
  ]);
  blocks.set('F03', [
    {
      id: 'dsg-block-3',
      dateFrom: add(today, 1),
      dateTo: add(today, 5),
      type: 'MANAGEMENT',
      reason: 'резерв владельца',
    },
  ]);
  housekeeping.set('R01', 'DIRTY');
  housekeeping.set('R02', 'INSPECTED');
  housekeeping.set('M01', 'DIRTY');
  // входящая ревизия с ошибкой (ADR-024, Q-109) и обычная обработанная
  designEvents = [
    {
      externalEventId: 'dsg-revision-failed-0001',
      receivedVia: 'WEBHOOK',
      type: 'booking_new',
      status: 'FAILED',
      attempts: 6,
      receivedAt: `${today}T05:12:40Z`,
      processedAt: null,
      lastError:
        'Несколько перенесённых броней подходят: 20260913-TEST1, 20260913-TEST3 — разобрать руками (Q-109)',
    },
    {
      externalEventId: 'dsg-revision-ok-0002',
      receivedVia: 'WEBHOOK',
      type: 'booking_modification',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${today}T06:01:03Z`,
      processedAt: `${today}T06:01:04Z`,
      lastError: null,
    },
    {
      externalEventId: 'dsg-revision-ok-0003',
      receivedVia: 'PULL',
      type: 'booking_cancellation',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${today}T06:30:00Z`,
      processedAt: `${today}T06:30:01Z`,
      lastError: null,
    },
  ];
}
const allCards = () => [card, ...extraCards.values()];
const getCard = (number: string) =>
  number === card.confirmationNumber ? card : extraCards.get(number);
function getGuest(id: string) {
  const g = id === guest.id ? guest : extraGuests.get(id);
  if (!g) return undefined;
  return {
    ...g,
    stays: allCards()
      .filter((r) => r.primaryGuest?.id === id)
      .flatMap((r) =>
        r.items.map((it) => ({
          confirmationNumber: r.confirmationNumber,
          accommodationTypeName: it.accommodationTypeName,
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
          unitCode: it.unitCode,
        })),
      ),
  };
}
let rejectCreate = false;
let failPath = '';
let emptyFixture = false;
const housekeeping = new Map<string, UnitCard['housekeepingStatus']>();
const blocks = new Map<string, UnitCard['blocks']>();
const blocksFor = (code: string) => blocks.get(code) ?? [];
let priceChanges: Array<{ dateFrom: string; dateTo: string; price?: string }> = [];
let siteDeleted = false;
let groupFixture = false;
let paid = new Map<string, bigint>();
let paymentLines: Array<{
  folioId: string;
  amountMinor: string;
  method: string;
  note: string | null;
  id: string;
}> = [];
let commands: Array<{ method: string; path: string; body: unknown }> = [];
const incidentSeed: Incident = {
  id: 'ui-incident',
  kind: 'booking.unassigned',
  class: 'B',
  severity: 'WARNING',
  status: 'OPEN',
  title: 'Тестовая бронь без назначенной ячейки',
  subjectType: 'Reservation',
  subjectId: 'ui-item',
  occurrences: 1,
  firstSeenAt: `${today}T07:00:00Z`,
  lastSeenAt: `${today}T07:00:00Z`,
  fixAttempts: 0,
  lastFixAt: null,
  lastFixResult: null,
  alertedAt: null,
  acknowledgedAt: null,
  resolvedAt: null,
  resolvedBy: null,
};
let incident = structuredClone(incidentSeed);

function desk(date: string): DeskDay {
  const rows = allCards().flatMap((r) =>
    r.items.map(
      (it) =>
        ({
          itemId: it.id,
          confirmationNumber: r.confirmationNumber,
          guestLabel: r.primaryGuest?.label ?? 'Гость',
          guestPhone: r.primaryGuest?.phone ?? null,
          unitCode: it.unitCode,
          accommodationTypeName: it.accommodationTypeName,
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
          balanceMinor: finance(r).balanceMinor,
          citizenship: r.primaryGuest?.citizenship ?? null,
          adults: it.adults,
          guestsRecorded: it.guests.length,
          blockedReason: null,
        }) satisfies DeskRow,
    ),
  );
  const active = rows.filter((r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW');
  const arrivals = active.filter((r) => r.arrivalDate === date);
  const departures = active.filter((r) => r.departureDate === date);
  const inHouse = active.filter(
    (r) => r.status === 'CHECKED_IN' && r.arrivalDate <= date && r.departureDate > date,
  );
  return {
    date,
    arrivals,
    departures,
    inHouse,
    counts: {
      arrivals: arrivals.length,
      departures: departures.length,
      inHouse: inHouse.length,
      toCheckIn: arrivals.filter((r) => r.status !== 'CHECKED_IN').length,
      toCheckOut: departures.filter((r) => r.status === 'CHECKED_IN').length,
    },
    debtMinor: departures
      .filter((r) => r.status === 'CHECKED_IN' && BigInt(r.balanceMinor) > 0n)
      .reduce((sum, r) => sum + BigInt(r.balanceMinor), 0n)
      .toString(),
  };
}
function board(from: string, to: string): Chessboard {
  const days = dates(from, to);
  const rows = units.map((u) => ({
    unit: { id: u.code, ...u },
    cells: days.map((date) => {
      const block = blocksFor(u.code).find((b) => b.dateFrom <= date && date <= b.dateTo);
      if (block)
        return {
          date,
          state: 'BLOCKED' as const,
          blockType: block.type,
          blockReason: block.reason,
        };
      for (const r of allCards()) {
        const it = r.items.find(
          (it) =>
            it.unitCode === u.code &&
            !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(it.status) &&
            it.arrivalDate <= date &&
            it.departureDate > date,
        );
        if (it)
          return {
            date,
            state: 'OCCUPIED' as const,
            itemId: it.id,
            confirmationNumber: r.confirmationNumber,
            guestLabel: r.primaryGuest?.label ?? 'Гость',
            itemStatus: it.status,
            isArrival: date === it.arrivalDate,
            isLastNight: date === add(it.departureDate, -1),
          };
      }
      return { date, state: 'FREE' as const };
    }),
  }));
  const byCategory = Object.fromEntries(
    days.map((date, j) => [
      date,
      Object.fromEntries(
        categories.map((c) => {
          const cells = rows
            .filter((r) => r.unit.accommodationTypeCode === c.code)
            .map((r) => r.cells[j]!);
          return [
            c.code,
            {
              units: c.count,
              occupied: cells.filter((c) => c.state === 'OCCUPIED').length,
              free: cells.filter((c) => c.state === 'FREE').length,
              blocked: cells.filter((c) => c.state === 'BLOCKED').length,
            },
          ];
        }),
      ),
    ]),
  );
  const summary = Object.fromEntries(
    days.map((date) => [
      date,
      Object.values(byCategory[date]!).reduce(
        (a, c) => ({
          occupied: a.occupied + c.occupied,
          blocked: a.blocked + c.blocked,
          free: a.free + c.free,
        }),
        { occupied: 0, blocked: 0, free: 0 },
      ),
    ]),
  );
  return {
    from,
    to,
    dates: days,
    rows,
    byCategory,
    summary,
    unassigned: allCards().flatMap((r) =>
      r.items
        .filter(
          (it) =>
            !it.unitCode &&
            !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(it.status) &&
            it.arrivalDate <= to &&
            it.departureDate > from,
        )
        .map((it) => ({
          confirmationNumber: r.confirmationNumber,
          categoryCode: it.accommodationTypeCode,
          categoryName: it.accommodationTypeName,
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
        })),
    ),
  };
}
/**
 * Главная за период (срез 14): тот же расчёт, что в API, на данных фикстуры — шахматка, брони, платежи.
 * Начисление за проживание датировано заездом, платежи фикстуры проведены сегодня.
 */
function dashboardPeriod(from: string, to: string): DashboardPeriod {
  const b = board(from, to);
  const active = (status: string) => !['CANCELLED', 'NO_SHOW'].includes(status);
  return buildDashboard({
    from,
    to,
    categories: categories.map((c) => ({ code: c.code, name: c.name, units: c.count })),
    days: b.dates.map((date) => ({
      date,
      ...(b.summary[date] ?? { occupied: 0, free: 0, blocked: 0 }),
      byCategory: b.byCategory[date] ?? {},
    })),
    unassigned: b.unassigned.length,
    stays: allCards().flatMap((r) =>
      r.items.map((it) => ({
        arrivalDate: it.arrivalDate,
        departureDate: it.departureDate,
        status: it.status,
        adults: it.adults,
        children: it.children,
        priceMinor: BigInt(it.priceMinor),
        source: r.source,
        channel: r.channel,
        categoryCode: it.accommodationTypeCode,
      })),
    ),
    charges: allCards().flatMap((r) =>
      r.items
        .filter((it) => active(it.status) && it.arrivalDate >= from && it.arrivalDate <= to)
        .map((it) => ({
          kind: 'ACCOMMODATION' as const,
          amountMinor: BigInt(it.priceMinor),
          categoryCode: it.accommodationTypeCode,
        })),
    ),
    payments:
      from <= today && today <= to
        ? paymentLines.map((p) => ({ method: p.method, amountMinor: BigInt(p.amountMinor) }))
        : [],
    refundsMinor: 0n,
  });
}
function dashboard(from: string, to: string) {
  const prev = previousPeriod(from, to);
  return { current: dashboardPeriod(from, to), previous: dashboardPeriod(prev.from, prev.to) };
}
function finance(reservation: ReservationCard = card): ReservationFinance {
  const folios: ReservationFinance['folios'] = reservation.items.map((it, index) => {
    const id =
      reservation === card ? (index ? `ui-folio-${index + 1}` : 'ui-folio') : `folio-${it.id}`;
    const nights = Math.max(
      1,
      Math.round((Date.parse(it.departureDate) - Date.parse(it.arrivalDate)) / 86400000),
    );
    const prepaid = reservation.confirmationNumber.includes('-NEW')
      ? 0n
      : /TEST[1357]$/.test(reservation.confirmationNumber)
        ? BigInt(it.priceMinor)
        : 800000n;
    const amount = BigInt(it.priceMinor);
    const payments = paymentLines
      .filter((p) => p.folioId === id)
      .map((p) => ({
        paymentId: p.id,
        method: p.method,
        status: 'COMPLETED' as const,
        paidAt: `${today}T10:00:00Z`,
        note: p.note,
        externalReference: null,
        paymentAmountMinor: p.amountMinor,
        allocatedMinor: p.amountMinor,
        refundedMinor: '0',
      }));
    if (prepaid)
      payments.unshift({
        paymentId: `prepaid-${id}`,
        method: 'CASH',
        status: 'COMPLETED',
        paidAt: `${today}T07:00:00Z`,
        note: null,
        externalReference: null,
        paymentAmountMinor: prepaid.toString(),
        allocatedMinor: prepaid.toString(),
        refundedMinor: '0',
      });
    return {
      id,
      reservationItemId: it.id,
      status: 'OPEN',
      currency: reservation.currency,
      stay: {
        accommodationTypeName: it.accommodationTypeName,
        arrivalDate: it.arrivalDate,
        departureDate: it.departureDate,
        status: it.status,
      },
      charges: [
        {
          id: `charge-${it.id}`,
          kind: 'ACCOMMODATION',
          serviceCode: null,
          description: `Проживание · ${nights} ноч.`,
          quantity: nights,
          unitPriceMinor: (amount / BigInt(nights)).toString(),
          amountMinor: amount.toString(),
          serviceDate: it.arrivalDate,
          createdAt: `${today}T07:00:00Z`,
          voidedAt: null,
        },
      ],
      payments,
      refunds: [],
      chargedMinor: amount.toString(),
      paidMinor: (prepaid + (paid.get(id) ?? 0n)).toString(),
      refundedMinor: '0',
      balanceMinor: (amount - prepaid - (paid.get(id) ?? 0n)).toString(),
    };
  });
  if (groupFixture && reservation === card) {
    const f = structuredClone(folios[0]!);
    f.id = 'ui-folio-2';
    f.reservationItemId = 'ui-item-2';
    f.paidMinor = (800000n + (paid.get(f.id) ?? 0n)).toString();
    f.balanceMinor = (BigInt(f.chargedMinor) - BigInt(f.paidMinor)).toString();
    folios.push(f);
  }
  const sum = (key: 'chargedMinor' | 'paidMinor' | 'refundedMinor' | 'balanceMinor') =>
    folios.reduce((total, f) => total + BigInt(f[key]), 0n).toString();
  return {
    confirmationNumber: reservation.confirmationNumber,
    currency: reservation.currency,
    folios,
    chargedMinor: sum('chargedMinor'),
    paidMinor: sum('paidMinor'),
    refundedMinor: sum('refundedMinor'),
    balanceMinor: sum('balanceMinor'),
  };
}

const siteSeed: TrackedSite = {
  id: 'ui-site',
  name: 'Учебный сайт',
  hosts: ['example.invalid'],
  publicKey: 'public-ui-fixture',
  status: 'ACTIVE',
  createdAt: `${today}T00:00:00Z`,
  timezone: 'Asia/Almaty',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  bookingEnabled: true,
  bookingRatePlan: { id: 'ui-rate', code: 'BASE', name: 'Стандартный' },
};
let site = structuredClone(siteSeed);
function report(): SiteReport {
  return {
    site: { id: site.id, name: site.name },
    period: { from: add(today, -6), to: today, timezone: 'Asia/Almaty' },
    summary: {
      sessions: 125,
      visitors: 104,
      pageviews: 270,
      pagesPerSession: 2.16,
      avgDurationSeconds: 82,
      mobileSessions: 80,
      mobileShare: 0.64,
      bounces: 30,
      bounceRate: 0.24,
      bookings: 12,
    },
    daily: dates(add(today, -6), today).map((date, i) => ({
      date,
      sessions: 12 + i * 2,
      visitors: 10 + i,
      pageviews: 30 + i * 3,
      mobile: 8 + i,
    })),
    sources: [
      {
        kind: 'DIRECT',
        source: null,
        sessions: 125,
        visitors: 104,
        pageviews: 270,
        avgDurationSeconds: 82,
        share: 1,
        bookings: 12,
      },
    ],
    pages: [{ path: '/', views: 270, share: 1 }],
    demand: [],
    events: [],
    devices: { devices: [], browsers: [], os: [] },
  };
}
function read(path: string, q: URLSearchParams): unknown {
  if (path === '/system/connection') {
    const ready = connectionState === 'READY';
    return {
      source: demo ? 'demo' : 'synthetic',
      state: connectionState,
      message: ready ? 'Изолированные данные интерфейса' : 'База данных недоступна',
      checkedAt: new Date().toISOString(),
      database: { connected: false, provider: 'unknown' },
      property: ready ? { name: propertyName, timezone: 'Asia/Almaty', currency: 'KZT' } : null,
      counts: ready
        ? {
            units: emptyFixture ? 0 : units.length,
            categories: emptyFixture ? 0 : categories.length,
            reservations: emptyFixture ? 0 : allCards().length,
            ratePlans: emptyFixture ? 0 : plans.length,
            services: emptyFixture ? 0 : 1,
            sites: emptyFixture || siteDeleted ? 0 : 1,
          }
        : null,
    } satisfies DataConnection;
  }
  if (emptyFixture) {
    if (path === '/hotel/channel-report')
      return { from: q.get('from'), to: q.get('to'), status: q.get('status'), rows: [] };
    if (['/guests', '/analytics/sites', '/inventory/units'].includes(path)) return [];
    if (path === '/inventory/summary')
      return {
        property: { name: 'Luxx Aparts', timezone: 'Asia/Almaty', currency: 'KZT' },
        totalUnits: 0,
        rooms: 0,
        beds: 0,
        maxGuests: 0,
        physicalRooms: 0,
        blocks: 0,
        byCategory: [],
      };
    if (path === '/desk/dashboard') {
      const from = q.get('from') || today,
        to = q.get('to') || today;
      const zero = (f: string, t: string) =>
        buildDashboard({
          from: f,
          to: t,
          categories: [],
          days: dates(f, t).map((date) => ({
            date,
            occupied: 0,
            free: 0,
            blocked: 0,
            byCategory: {},
          })),
          unassigned: 0,
          stays: [],
          charges: [],
          payments: [],
          refundsMinor: 0n,
        });
      const prev = previousPeriod(from, to);
      return { current: zero(from, to), previous: zero(prev.from, prev.to) };
    }
    if (path === '/finance/report')
      return {
        currency: 'KZT',
        chargedMinor: '0',
        paidMinor: '0',
        refundedMinor: '0',
        balanceMinor: '0',
        chargesByKind: [],
        paymentsByMethod: [],
        accommodationByCategory: [],
      };
  }
  if (path.endsWith('/MISSING')) return undefined;
  if (path === '/guard/status')
    return {
      running: true,
      autofix: false,
      propertyLive: true,
      notifier: { configured: true, recipients: 1 },
      dbDownSince: null,
      lastTick: null,
      open: { total: incident.status === 'RESOLVED' ? 0 : 1, critical: 0, escalated: 0 },
    };
  if (path === '/guard/incidents')
    return q.get('status') === 'open' && incident.status === 'RESOLVED' ? [] : [incident];
  if (path === '/hotel/settings')
    return {
      property: {
        id: 'test-property',
        name: propertyName,
        legalName: null,
        address: 'Тестовый адрес, 1',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
      ratePlans: plans.map((p) => ({ ...p, active: true, cancellationPenalty: 'FIRST_NIGHT' })),
    };
  if (path === '/hotel/channel-report') {
    const status = q.get('status') || 'ALL';
    const empty = status !== 'ALL';
    return {
      from: q.get('from'),
      to: q.get('to'),
      status,
      dateBasis: 'ARRIVAL',
      rows: empty
        ? []
        : [
            {
              source: 'OTA',
              channel: 'Booking.com',
              currency: 'KZT',
              count: 24,
              cancelled: 2,
              noShow: 0,
              amountMinor: '96000000',
            },
            {
              source: 'OTA',
              channel: 'Trip.com',
              currency: 'KZT',
              count: 12,
              cancelled: 1,
              noShow: 1,
              amountMinor: '48000000',
            },
            {
              source: 'WEBSITE',
              channel: null,
              currency: 'KZT',
              count: 8,
              cancelled: 0,
              noShow: 0,
              amountMinor: '32000000',
            },
            {
              source: 'DESK',
              channel: null,
              currency: 'KZT',
              count: 4,
              cancelled: 0,
              noShow: 0,
              amountMinor: '16000000',
            },
          ],
    };
  }
  if (path === '/inventory/summary')
    return {
      property: { name: 'Luxx Aparts', timezone: 'Asia/Almaty', currency: 'KZT' },
      totalUnits: 88,
      rooms: 16,
      beds: 72,
      maxGuests: 104,
      physicalRooms: 28,
      blocks: 1,
      byCategory: categories.map((c) => ({
        code: c.code,
        name: c.name,
        units: c.count,
        maxGuests: c.count * c.capacityAdults,
      })),
    };
  if (path === '/inventory/units')
    return units.filter((u) => !q.get('category') || q.get('category') === u.accommodationTypeCode);
  if (path === '/desk/today') return desk(q.get('date') || today);
  if (path === '/desk/dashboard') return dashboard(q.get('from') || today, q.get('to') || today);
  if (path === '/chessboard') return board(q.get('from') || today, q.get('to') || add(today, 13));
  if (path === '/rate-plans') return plans;
  if (path === '/availability') {
    const arrival = q.get('arrival') || today,
      departure = q.get('departure') || add(arrival, 1);
    const available = units.filter(
      (u) =>
        !allCards().some((r) =>
          r.items.some(
            (it) =>
              it.unitCode === u.code &&
              !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(it.status) &&
              it.arrivalDate < departure &&
              it.departureDate > arrival,
          ),
        ) && !blocksFor(u.code).some((b) => b.dateFrom < departure && b.dateTo >= arrival),
    );
    return {
      arrivalDate: arrival,
      departureDate: departure,
      nights: Math.round((Date.parse(departure) - Date.parse(arrival)) / 86400000),
      byCategory: Object.fromEntries(
        categories.map((c) => {
          const free = available.filter((u) => u.accommodationTypeCode === c.code);
          return [
            c.code,
            { units: c.count, available: free.length, availableUnitCodes: free.map((u) => u.code) },
          ];
        }),
      ),
      total: { units: 88, available: available.length },
    };
  }
  if (path.startsWith('/reservations/')) return getCard(decodeURIComponent(path.split('/')[2]!));
  if (path === '/guests')
    return [guest, ...extraGuests.values()]
      .map((g) => getGuest(g.id)!)
      .filter((g) =>
        `${g.lastName} ${g.firstName} ${g.phone ?? ''} ${g.email ?? ''}`
          .toLocaleLowerCase('ru')
          .includes((q.get('q') || '').toLocaleLowerCase('ru')),
      )
      .map((g) => ({
        ...g,
        staysCount: g.stays.length,
        lastStay: g.stays[0]?.arrivalDate ?? null,
      }));
  if (path.startsWith('/guests/')) return getGuest(decodeURIComponent(path.split('/')[2]!));
  if (path.startsWith('/units/')) {
    const u = units.find((u) => u.code === decodeURIComponent(path.split('/')[2]!));
    if (!u) return undefined;
    return {
      ...u,
      id: u.code,
      active: true,
      housekeepingStatus: housekeeping.get(u.code) ?? 'CLEAN',
      blocks: blocksFor(u.code),
      stays: allCards().flatMap((r) =>
        r.items
          .filter((it) => it.unitCode === u.code)
          .map((it) => ({
            confirmationNumber: r.confirmationNumber,
            startDate: it.arrivalDate,
            endDate: it.departureDate,
            status: it.status,
            guestLabel: r.primaryGuest?.label ?? 'Гость',
          })),
      ),
      housekeepingHistory: [],
    } satisfies UnitCard;
  }
  if (path === '/rates/options') return { categories, ratePlans: plans };
  if (path === '/rates')
    return {
      accommodationTypeCode: q.get('accommodationTypeCode'),
      ratePlanCode: 'BASE',
      currency: 'KZT',
      capacityAdults:
        categories.find((c) => c.code === q.get('accommodationTypeCode'))?.capacityAdults ?? 1,
      days: dates(q.get('from') || today, q.get('to') || add(today, 13)).map((date) => ({
        date,
        prices: {
          '1': parseMoney(
            [...priceChanges].reverse().find((c) => c.dateFrom <= date && c.dateTo >= date)
              ?.price || '8000',
          ).toString(),
          '2': '1000000',
        },
        minStay: 1,
        maxStay: null,
        stopSell: false,
        closedToArrival: false,
        closedToDeparture: false,
      })),
    };
  if (path.startsWith('/finance/reservations/')) {
    const r = getCard(decodeURIComponent(path.split('/')[3]!));
    return r ? finance(r) : undefined;
  }
  if (path === '/finance/services')
    return [{ code: 'LAUNDRY', nameRu: 'Стирка', nameKz: null, priceMinor: '150000', group: null }];
  if (path === '/finance/report')
    return {
      ...finance(),
      from: q.get('from'),
      to: q.get('to'),
      chargesByKind: [{ kind: 'ACCOMMODATION', count: 3, amountMinor: '2400000' }],
      paymentsByMethod: [{ method: 'CASH', count: 1, amountMinor: '800000' }],
      refunds: { count: 0, amountMinor: '0' },
      accommodationByCategory: [
        { category: 'Двухместный номер', count: 3, amountMinor: '2400000' },
      ],
    };
  // Свежесть данных и контент объекта из Channex (план wetop-live-data: шаг 4, ADR-033)
  if (path === '/system/freshness')
    return {
      checkedAt: new Date().toISOString(),
      exely: { lastSyncAt: new Date().toISOString(), mode: 'auto' },
      channex: { lastEventAt: null, outboxPending: 0, outboxFailed: 0, oldestPendingAt: null },
    };
  if (path === '/channels/channex/content')
    return {
      checkedAt: new Date().toISOString(),
      source: 'channex',
      environment: 'staging',
      state: 'READY',
      message: 'Контент объекта прочитан из Channex',
      property: {
        title: 'Тестовый хостел',
        description: 'Вымышленное описание для проверки экрана',
        importantInformation: null,
        phone: '+7 700 000 00 00',
        email: 'ui@example.test',
        website: null,
        address: 'ул. Тестовая, 1',
        city: 'Алматы',
        country: 'KZ',
      },
      policy: {
        checkInTime: '14:00',
        checkOutTime: '12:00',
        maxGuests: 10,
        pets: 'not_allowed',
        smoking: 'no_smoking',
        internet: 'wifi',
        parking: 'none',
      },
      facilities: [{ title: 'WiFi', category: 'general' }],
      photos: [
        {
          url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
          description: 'Фасад',
          forRoomType: false,
        },
      ],
    };
  if (path === '/channels/channex/connection')
    return {
      checkedAt: new Date().toISOString(),
      environment: 'staging',
      apiConfigured: true,
      propertyId: 'ui-property',
      propertyAccessible: true,
      mappedCategories: 3,
      mappedRatePlans: 3,
      lastWebhookAt: null,
      lastPullAt: null,
      state: 'READY',
      message: 'Соединение установлено',
    };
  if (path === '/channels/channex/mapping') return [];
  if (path === '/channels/channex/outbox')
    return { pending: 0, failed: 0, sent: 16, lastSentAt: null, lastTaskId: null };
  if (path === '/channels/channex/events') return designEvents;
  if (path === '/channels/channex/webhook/status')
    return { registered: false, active: false, expectedUrl: null, secretConfigured: false };
  if (path === '/audit')
    return [
      {
        id: 'ui-audit',
        at: `${today}T08:30:00Z`,
        entityType: 'Reservation',
        entityId: 'ui-item',
        action: 'CREATE',
        subject: card.confirmationNumber,
      },
    ];
  if (path === '/analytics/sites') return siteDeleted ? [] : [site];
  if (path.endsWith('/report') && path.startsWith('/analytics/')) return report();
  if (path === '/analytics/sites/ui-site')
    return {
      site,
      status: { lastEventAt: null, sessionsToday: 20, pageviewsToday: 38 },
      snippet: {
        key: site.publicKey,
        scriptUrl: '/w/tracker.js',
        code: '<script data-site="public-ui-fixture"></script>',
        demoUrl: '/demo',
        bookingCode: '<div data-booking></div>',
        bookingDemoUrl: '/demo-booking',
      },
    };
  return undefined;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const path = url.pathname;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = chunks.length
      ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>)
      : {};
    const send = (status: number, data: unknown) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'x-wetop-data-source': demo ? 'demo' : 'synthetic',
      });
      res.end(JSON.stringify(data));
    };
    if (path === '/health' && demo) return send(200, { demo: true });
    if (demo && path.startsWith('/__test/')) return send(404, {});
    if (path === '/__test/health') return send(200, { testOnly: true });
    if (
      !path.startsWith('/__test/') &&
      req.headers[demo ? 'x-wetop-demo-client' : 'x-wetop-test-client'] !== '1'
    ) {
      return send(403, { message: 'Fixture API is available only to the test runner' });
    }
    if (path === '/__test/reset') {
      setHotelHold(false);
      propertyName = 'Luxx Aparts';
      connectionState = 'READY';
      // A long browser run can cross midnight in the property's timezone.
      today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
      incident = structuredClone(incidentSeed);
      card = cardSeed();
      guest = structuredClone(guestSeed);
      commands = [];
      rejectCreate = false;
      failPath = '';
      emptyFixture = false;
      housekeeping.clear();
      blocks.clear();
      designEvents = [];
      initializeRecords();
      priceChanges = [];
      site = structuredClone(siteSeed);
      siteDeleted = false;
      groupFixture = false;
      paid = new Map();
      paymentLines = [];
      return send(200, {});
    }
    if (path === '/__test/control') {
      if (typeof body['holdHotel'] === 'boolean') setHotelHold(body['holdHotel']);
      if (typeof body['propertyName'] === 'string') propertyName = body['propertyName'];
      if (
        ['READY', 'PROPERTY_MISSING', 'DATABASE_UNAVAILABLE'].includes(
          String(body['connectionState']),
        )
      )
        connectionState = body['connectionState'] as DataConnection['state'];
      emptyFixture = body['empty'] === true;
      groupFixture = body['group'] === true;
      rejectCreate = body['rejectCreate'] === true;
      failPath = String(body['failPath'] || '');
      // бронь, перенесённая из Exely: у проживаний нет тарифа (Б1, Б8)
      if (body['withoutRatePlan'] === true)
        for (const it of card.items) Object.assign(it, { ratePlanCode: null, ratePlanName: null });
      return send(200, {});
    }
    if (path === '/__test/design-seed') {
      seedDesign();
      return send(200, { stays: DESIGN_STAYS.length, fullMonthUnits: units.length });
    }
    if (path === '/__test/commands') return send(200, commands);
    if (path === failPath || failPath === '*')
      return send(503, { message: 'Синтетический сбой API' });
    if (path === '/hotel/settings' && holdHotel)
      await new Promise<void>((resolve) => hotelWaiters.add(resolve));
    if (path === '/hotel/reservations' && req.method === 'GET') {
      const from = url.searchParams.get('from') || today,
        to = url.searchParams.get('to') || from;
      const status = url.searchParams.get('status') || 'ALL';
      const q = (url.searchParams.get('q') || '').toLocaleLowerCase('ru');
      const rows = allCards()
        .filter(
          (r) =>
            r.arrivalDate <= to &&
            r.departureDate >= from &&
            (status === 'ALL' || r.status === status) &&
            `${r.primaryGuest?.label} ${r.confirmationNumber}`.toLocaleLowerCase('ru').includes(q),
        )
        .map((r) => ({
          confirmationNumber: r.confirmationNumber,
          status: r.status,
          source: r.source,
          channel: r.channel,
          arrivalDate: r.arrivalDate,
          departureDate: r.departureDate,
          currency: r.currency,
          totalAmountMinor: r.totalAmountMinor,
          paidMinor: finance(r).paidMinor,
          balanceMinor: finance(r).balanceMinor,
          hasFolios: true,
          unitCodes: r.items.flatMap((it) => (it.unitCode ? [it.unitCode] : [])),
          primaryGuest: r.primaryGuest
            ? { ...r.primaryGuest, email: getGuest(r.primaryGuest.id)?.email ?? null }
            : null,
        }));
      return send(200, {
        from,
        to,
        total: emptyFixture ? 0 : rows.length,
        page: 1,
        pageSize: 25,
        rows: emptyFixture ? [] : rows,
      });
    }
    if (req.method === 'GET') {
      const result = read(path, url.searchParams);
      return send(
        result === undefined ? 404 : 200,
        result ?? { message: `No UI fixture for ${path}` },
      );
    }
    commands.push({ method: req.method || '', path, body });
    if (path.startsWith('/units/')) {
      const [, , code, command, blockId] = path.split('/');
      if (!units.some((u) => u.code === code)) return send(404, { message: 'Ячейка не найдена' });
      if (command === 'housekeeping')
        housekeeping.set(code!, body['status'] as UnitCard['housekeepingStatus']);
      else if (command === 'blocks' && req.method === 'DELETE')
        blocks.set(
          code!,
          blocksFor(code!).filter((b) => b.id !== blockId),
        );
      else if (command === 'blocks')
        blocks.set(code!, [
          ...blocksFor(code!),
          {
            id: blocksFor(code!).length ? `ui-block-${commands.length}` : 'ui-block',
            dateFrom: String(body['dateFrom']),
            dateTo: String(body['dateTo']),
            type: String(body['type']),
            reason: String(body['reason'] ?? ''),
          },
        ]);
      else return send(404, { message: 'Операция не найдена' });
      return send(200, read(`/units/${code}`, url.searchParams));
    }
    if (path === '/rates/bulk') {
      priceChanges.push(...(body['changes'] as typeof priceChanges));
      return send(200, {
        applied: (body['changes'] as unknown[]).length,
        rateRows: 1,
        restrictionRows: 0,
      });
    }
    if (path === '/analytics/sites' && req.method === 'POST') {
      site = { ...site, name: String(body['name']), hosts: body['hosts'] as string[] };
      siteDeleted = false;
      return send(201, read('/analytics/sites/ui-site', url.searchParams));
    }
    if (path === '/analytics/sites/ui-site') {
      if (req.method === 'DELETE') {
        siteDeleted = true;
        return send(200, { deleted: true });
      }
      site = { ...site, ...body };
      return send(200, read(path, url.searchParams));
    }
    if (path === '/channels/channex/pull')
      return send(200, { received: 0, acknowledged: 0, outcomes: [] });
    if (path === '/channels/channex/outbox/flush') return send(200, { sent: [], errors: [] });
    if (path === '/channels/channex/sync')
      return send(200, { from: today, to: add(today, 499), tasks: ['ui-task'] });
    if (path === '/channels/channex/setup')
      return send(200, { created: { property: false, roomTypes: 0, ratePlans: 0 } });
    if (path === '/guard/tick') return send(200, { observed: [], resolved: 0 });
    if (path === '/guard/incidents/ui-incident/acknowledge') {
      incident.status = 'ACKNOWLEDGED';
      incident.acknowledgedAt = new Date().toISOString();
      return send(200, incident);
    }
    if (path === '/guard/incidents/ui-incident/resolve') {
      incident.status = 'RESOLVED';
      incident.resolvedBy = 'STAFF';
      incident.resolvedAt = new Date().toISOString();
      return send(200, incident);
    }
    if (path === '/finance/payments') {
      try {
        const rows = body['allocations'] as Array<{ folioId: string; amount: string }>;
        const allocations = rows.map((a) => ({
          folioId: a.folioId,
          amountMinor: parseMoney(a.amount),
        }));
        assertAllocationsMatch(parseMoney(String(body['amount'])), allocations);
        for (const a of allocations) {
          paid.set(a.folioId, (paid.get(a.folioId) ?? 0n) + a.amountMinor);
          paymentLines.push({
            folioId: a.folioId,
            amountMinor: a.amountMinor.toString(),
            method: String(body['method']),
            note: typeof body['note'] === 'string' ? body['note'] : null,
            id: `ui-payment-${commands.length}`,
          });
        }
        return send(201, finance());
      } catch {
        return send(422, { message: 'Сумма платежа и распределения должны совпадать' });
      }
    }
    if (path === '/reservations') {
      if (rejectCreate) return send(409, { message: 'Место уже занято. Выберите другую ячейку.' });
      const r = cardSeed();
      const g = {
        ...structuredClone(guestSeed),
        ...(body['guest'] as Record<string, unknown>),
      } as GuestCard;
      g.id = `ui-new-guest-${commands.length}`;
      r.confirmationNumber = `20260913-NEW${commands.length}`;
      r.arrivalDate = String(body['arrivalDate']);
      r.departureDate = String(body['departureDate']);
      r.source = String(body['source']);
      r.notes = typeof body['notes'] === 'string' ? body['notes'] : null;
      r.primaryGuest = {
        id: g.id,
        label: `${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim(),
        citizenship: g.citizenship,
        phone: g.phone,
      };
      const nights = Math.round(
        (Date.parse(r.departureDate) - Date.parse(r.arrivalDate)) / 86400000,
      );
      const items = body['items'] as Array<{
        accommodationTypeCode: string;
        quantity: number;
        adults: number;
        unitCode: string | null;
      }>;
      r.items = items.flatMap((item, index) =>
        Array.from({ length: item.quantity || 1 }, (_, position) => {
          const category = categories.find((c) => c.code === item.accommodationTypeCode)!;
          return {
            ...cardSeed().items[0]!,
            id: `${r.confirmationNumber}-${index}-${position}`,
            accommodationTypeCode: category.code,
            accommodationTypeName: category.name,
            arrivalDate: r.arrivalDate,
            departureDate: r.departureDate,
            unitCode: item.unitCode,
            adults: item.adults,
            guests: [{ label: r.primaryGuest!.label, isPrimary: true }],
            priceMinor: (800000n * BigInt(nights)).toString(),
          };
        }),
      );
      r.totalAmountMinor = r.items.reduce((sum, it) => sum + BigInt(it.priceMinor), 0n).toString();
      r.adults = r.items.reduce((sum, it) => sum + it.adults, 0);
      extraCards.set(r.confirmationNumber, r);
      extraGuests.set(g.id, g);
      return send(201, r);
    }
    if (path.startsWith('/guests/') && req.method === 'PATCH') {
      const id = decodeURIComponent(path.split('/')[2]!);
      const g = id === guest.id ? guest : extraGuests.get(id);
      if (!g) return send(404, { message: 'Гость не найден' });
      Object.assign(g, body);
      for (const r of allCards().filter((r) => r.primaryGuest?.id === id)) {
        const label = `${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim();
        r.primaryGuest = { id, label, phone: g.phone, citizenship: g.citizenship };
        for (const it of r.items) it.guests = [{ label, isPrimary: true }];
      }
      return send(200, getGuest(id));
    }
    if (path.startsWith('/reservations/')) {
      const [, , number, , itemId, action] = path.split('/');
      const r = getCard(decodeURIComponent(number!));
      if (!r) return send(404, { message: 'Бронь не найдена' });
      const item = r.items.find((it) => it.id === itemId);
      if (item && action === 'check-in') {
        item.status = 'CHECKED_IN';
        r.status = 'CHECKED_IN';
        return send(200, r);
      }
      if (item && req.method === 'PATCH') {
        Object.assign(item, body);
        return send(200, r);
      }
      if (req.method === 'PATCH' && !itemId && path.split('/').length === 3) {
        Object.assign(r, body);
        return send(200, r);
      }
    }
    return send(501, {
      message:
        'Эта операция пока недоступна в демонстрации. Для работы с ней подключите основной API.',
    });
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Некорректный запрос к демонстрационному API' }));
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`WETOP ${demo ? 'demo' : 'test'} API on 127.0.0.1:${port} (no DB/providers)`),
);
