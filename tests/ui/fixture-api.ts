/** Isolated, synthetic API for browser checks. Never connects to a database or provider. */
import { createServer } from 'node:http';
import { parseMoney, assertAllocationsMatch } from '@pms/domain';
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
} from '../../apps/web/src/lib/api';

const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
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
let rejectCreate = false;
let failPath = '';
let groupFixture = false;
let paid = new Map<string, bigint>();
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
  const row = (i: number, status: string): DeskRow => ({
    itemId: `desk-${i}`,
    confirmationNumber: i === 0 ? card.confirmationNumber : `20260913-TEST${i}`,
    guestLabel: ['Гость Тестовый', 'Посетитель Демо', 'Клиент Пример', 'Гость Учебный'][i % 4]!,
    guestPhone: null,
    unitCode: units[i]!.code,
    accommodationTypeName: units[i]!.accommodationTypeName,
    arrivalDate: status === 'CONFIRMED' ? date : add(date, -2),
    departureDate: status === 'CONFIRMED' ? add(date, 3) : date,
    status,
    balanceMinor: i % 2 ? '0' : '800000',
    citizenship: 'KAZ',
    adults: 1,
    guestsRecorded: 1,
    blockedReason: null,
  });
  return {
    date,
    arrivals: [row(0, 'CONFIRMED'), row(1, 'CONFIRMED'), row(2, 'CHECKED_IN')],
    departures: [row(3, 'CHECKED_IN'), row(4, 'CHECKED_OUT')],
    inHouse: [row(5, 'CHECKED_IN'), row(6, 'CHECKED_IN'), row(7, 'CHECKED_IN')],
    counts: { arrivals: 3, departures: 2, inHouse: 3, toCheckIn: 2, toCheckOut: 1 },
    debtMinor: '2400000',
  };
}
function board(from: string, to: string): Chessboard {
  const days = dates(from, to);
  const rows = units.map((u, i) => ({
    unit: { id: u.code, ...u },
    cells: days.map((date, j) => {
      if (i === 3 && j < 4)
        return {
          date,
          state: 'BLOCKED' as const,
          blockType: 'MAINTENANCE',
          blockReason: 'Проверка комнаты',
        };
      if (i % 3 !== 2 && (j + i) % 9 < 5)
        return {
          date,
          state: 'OCCUPIED' as const,
          itemId: `board-${i}-${Math.floor((j + i) / 9)}`,
          confirmationNumber: card.confirmationNumber,
          guestLabel: ['Гость Тестовый', 'Посетитель Демо', 'Клиент Пример'][i % 3]!,
          itemStatus: i % 2 ? 'CHECKED_IN' : 'CONFIRMED',
          isArrival: (j + i) % 9 === 0,
          isLastNight: (j + i) % 9 === 4,
        };
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
  return { from, to, dates: days, rows, byCategory, summary, unassigned: [] };
}
function finance(): ReservationFinance {
  const result: ReservationFinance = {
    confirmationNumber: card.confirmationNumber,
    currency: 'KZT',
    chargedMinor: '2400000',
    paidMinor: '800000',
    refundedMinor: '0',
    balanceMinor: '1600000',
    folios: [
      {
        id: 'ui-folio',
        reservationItemId: 'ui-item',
        status: 'OPEN',
        currency: 'KZT',
        stay: {
          accommodationTypeName: categories[0]!.name,
          arrivalDate: today,
          departureDate: add(today, 3),
          status: card.items[0]!.status,
        },
        charges: [
          {
            id: 'ui-charge',
            kind: 'ACCOMMODATION',
            serviceCode: null,
            description: 'Проживание · 3 ночи',
            quantity: 3,
            unitPriceMinor: '800000',
            amountMinor: '2400000',
            serviceDate: today,
            createdAt: `${today}T07:00:00Z`,
            voidedAt: null,
          },
        ],
        payments: [],
        refunds: [],
        chargedMinor: '2400000',
        paidMinor: '800000',
        refundedMinor: '0',
        balanceMinor: '1600000',
      },
    ],
  };
  if (groupFixture)
    result.folios.push({
      ...structuredClone(result.folios[0]!),
      id: 'ui-folio-2',
      reservationItemId: 'ui-item-2',
    });
  for (const f of result.folios) {
    f.paidMinor = (BigInt(f.paidMinor) + (paid.get(f.id) ?? 0n)).toString();
    f.balanceMinor = (BigInt(f.chargedMinor) - BigInt(f.paidMinor)).toString();
  }
  for (const key of ['chargedMinor', 'paidMinor', 'balanceMinor'] as const) {
    result[key] = result.folios.reduce((sum, f) => sum + BigInt(f[key]), 0n).toString();
  }
  return result;
}

const site: TrackedSite = {
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
  if (path === '/chessboard') return board(q.get('from') || today, q.get('to') || add(today, 13));
  if (path === '/rate-plans') return plans;
  if (path === '/availability')
    return {
      arrivalDate: q.get('arrival'),
      departureDate: q.get('departure'),
      nights: 3,
      byCategory: Object.fromEntries(
        categories.map((c) => [
          c.code,
          {
            units: c.count,
            available: c.count,
            availableUnitCodes: units
              .filter((u) => u.accommodationTypeCode === c.code)
              .map((u) => u.code),
          },
        ]),
      ),
      total: { units: 88, available: 88 },
    };
  if (path.startsWith('/reservations/')) return card;
  if (path === '/guests') return [{ ...guest, staysCount: guest.stays.length, lastStay: today }];
  if (path === '/guests/ui-guest') return guest;
  if (path.startsWith('/units/')) {
    const u = units.find((u) => u.code === decodeURIComponent(path.split('/')[2]!)) ?? units[0]!;
    return {
      ...u,
      id: u.code,
      active: true,
      housekeepingStatus: 'CLEAN',
      blocks: [],
      stays: [
        {
          confirmationNumber: card.confirmationNumber,
          startDate: today,
          endDate: add(today, 3),
          status: 'CONFIRMED',
          guestLabel: 'Гость Тестовый',
        },
      ],
      housekeepingHistory: [],
    } satisfies UnitCard;
  }
  if (path === '/rates/options') return { categories, ratePlans: plans };
  if (path === '/rates')
    return {
      accommodationTypeCode: q.get('accommodationTypeCode'),
      ratePlanCode: 'BASE',
      currency: 'KZT',
      capacityAdults: 2,
      days: dates(q.get('from') || today, q.get('to') || add(today, 13)).map((date) => ({
        date,
        prices: { '1': '800000', '2': '1000000' },
        minStay: 1,
        maxStay: null,
        stopSell: false,
        closedToArrival: false,
        closedToDeparture: false,
      })),
    };
  if (path.startsWith('/finance/reservations/')) return finance();
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
  if (path === '/channels/channex/mapping') return [];
  if (path === '/channels/channex/outbox')
    return { pending: 0, failed: 0, sent: 16, lastSentAt: null, lastTaskId: null };
  if (path === '/channels/channex/events') return [];
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
  if (path === '/analytics/sites') return [site];
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
  const url = new URL(req.url || '/', 'http://127.0.0.1:4311');
  const path = url.pathname;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = chunks.length
    ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>)
    : {};
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (path === '/__test/reset') {
    incident = structuredClone(incidentSeed);
    card = cardSeed();
    guest = structuredClone(guestSeed);
    commands = [];
    rejectCreate = false;
    failPath = '';
    groupFixture = false;
    paid = new Map();
    return send(200, {});
  }
  if (path === '/__test/control') {
    groupFixture = body['group'] === true;
    rejectCreate = body['rejectCreate'] === true;
    failPath = String(body['failPath'] || '');
    return send(200, {});
  }
  if (path === '/__test/commands') return send(200, commands);
  if (path === failPath) return send(503, { message: 'Синтетический сбой API' });
  if (req.method === 'GET') {
    const result = read(path, url.searchParams);
    return send(
      result === undefined ? 404 : 200,
      result ?? { message: `No UI fixture for ${path}` },
    );
  }
  commands.push({ method: req.method || '', path, body });
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
      for (const a of allocations) paid.set(a.folioId, (paid.get(a.folioId) ?? 0n) + a.amountMinor);
      return send(201, finance());
    } catch {
      return send(422, { message: 'Сумма платежа и распределения должны совпадать' });
    }
  }
  if (path === '/reservations') {
    if (rejectCreate) return send(409, { message: 'Место уже занято. Выберите другую ячейку.' });
    return send(201, card);
  }
  if (path === '/guests/ui-guest' && req.method === 'PATCH') {
    guest = { ...guest, ...body };
    return send(200, guest);
  }
  if (path.startsWith('/reservations/') && path.endsWith('/check-in')) {
    card.items[0]!.status = 'CHECKED_IN';
    card.status = 'CHECKED_IN';
    return send(200, card);
  }
  if (path.endsWith('/items/ui-item') && req.method === 'PATCH') {
    card.items[0] = { ...card.items[0]!, ...body };
    return send(200, card);
  }
  return send(501, { message: `Unsupported fixture command: ${req.method} ${path}` });
}).listen(4311, '127.0.0.1', () =>
  console.log('Synthetic UI API on 127.0.0.1:4311 (no DB/providers)'),
);
