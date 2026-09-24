/** Isolated, synthetic API for browser checks. Never connects to a database or provider. */
import { createServer } from 'node:http';
import {
  parseMoney,
  assertAllocationsMatch,
  buildDashboard,
  previousPeriod,
  type DashboardPeriod,
  housekeepingRefusal,
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
  OutboxRow,
  RevisionFacts,
} from '../../apps/web/src/lib/api';

const demo = process.env.WETOP_PREVIEW_MODE === 'demo';
/**
 * Замок как у настоящего API при `AUTH_REQUIRED=1` (ADR-049): без сессии — 401 на всё, кроме входа и
 * публичных путей счётчика и виджета. Нужен набору `tests/ui/playwright.auth.config.ts`, который
 * проверяет стойку такой, какой она станет после включения замка на машине стойки.
 */
const authLock = process.env.FIXTURE_AUTH_LOCK === '1';
/** Пути, открытые и при замке: ими входят, ими управляет сам прогон, их зовёт сайт (ADR-025, ADR-026). */
const openAtLock = (p: string): boolean =>
  p.startsWith('/__test/') ||
  p.startsWith('/a/') ||
  p.startsWith('/w/') ||
  p === '/auth/login' ||
  p === '/auth/options' ||
  p === '/auth/logout' ||
  p === '/auth/code' ||
  p === '/auth/register' ||
  p === '/auth/verify' ||
  p.startsWith('/auth/email/') ||
  p.startsWith('/auth/password-reset/');
let propertyName = 'Luxx Aparts';
let connectionState: DataConnection['state'] = 'READY';
let holdHotel = false;
const hotelWaiters = new Set<() => void>();
function resetUiAuth() {
  registrationEnabled = true;
  uiPassword = 'ui-test-parol';
  uiSessions.clear();
  uiResetTokens.clear();
  uiResetTokens.set('ui-reset-token', { used: false, expired: false });
  uiResetTokens.set('ui-reset-expired', { used: false, expired: true });
}

function setHotelHold(value: boolean) {
  holdHotel = value;
  if (!value) {
    for (const resolve of hotelWaiters) resolve();
    hotelWaiters.clear();
  }
}
// Порт можно задать (`FIXTURE_PORT`): отдельный набор со включённым замком поднимает свой стенд
// и не спорит с обычным прогоном за 4311 (`tests/ui/playwright.auth.config.ts`).
const port = Number(process.env.FIXTURE_PORT) || (demo ? 4312 : 4311);
const names = [
  'Daniel Kim',
  'Maria Lopez',
  'Алия Садыкова',
  'Тимур Ким',
  'Alex Morgan',
  'Камила Асан',
  'James Wilson',
  'София Павлова',
  'Nora Jensen',
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
const categorySeed = [
  { code: 'ROOM', name: 'Двухместный номер', count: 16, prefix: 'R', capacityAdults: 2 },
  { code: 'MALE', name: 'Мужской общий номер', count: 36, prefix: 'M', capacityAdults: 1 },
  { code: 'FEMALE', name: 'Женский общий номер', count: 36, prefix: 'F', capacityAdults: 1 },
];
const categories = structuredClone(categorySeed);
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
  // Вымышленный документ (ADR-010): на нём проверяется вопрос перед удалением
  documents: [
    {
      id: 'ui-document',
      type: 'PASSPORT',
      numberMasked: '•••• 4321',
      issueCountry: 'KAZ',
      issuedAt: null,
      expiresAt: null,
    },
  ],
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
// seedDesign переименовывает категорию ради крайнего случая ширины — reset возвращает имена
const BASE_CATEGORY_NAMES = new Map(categories.map((c) => [c.code, c.name]));
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
  // i = 8 — «не заехал вовремя»: подтверждён, заезд был позавчера, выезд не сегодня. Такой брони не
  // видно ни в заездах, ни в выездах, ни среди живущих — её показывает блок «Требуют внимания»
  for (let i = 1; i < 9; i++) {
    const r = cardSeed();
    const g = structuredClone(guestSeed);
    const label = demo ? names[i]! : ['Посетитель Демо', 'Клиент Пример', 'Гость Учебный'][i % 3]!;
    const words = label.split(' ');
    g.id = `ui-guest-${i}`;
    g.firstName = words.slice(1).join(' ');
    g.lastName = words[0]!;
    r.confirmationNumber = `20260913-TEST${i}`;
    // i = 2 — перенесённая из Exely бронь канала: `TENTATIVE`, то есть «не подтверждена» (Q-135).
    // Смена должна видеть это на клетке словом, не только жёлтым цветом.
    r.status =
      i === 2
        ? 'TENTATIVE'
        : i === 1 || i === 8
          ? 'CONFIRMED'
          : i === 4
            ? 'CHECKED_OUT'
            : 'CHECKED_IN';
    r.arrivalDate = i < 3 ? today : add(today, -2);
    r.departureDate = i === 3 || i === 4 ? today : add(today, 3);
    r.source = i % 2 ? 'OTA' : 'PHONE';
    r.channel = i % 2 ? 'Booking.com' : null;
    r.primaryGuest = { id: g.id, label, citizenship: g.citizenship, phone: g.phone };
    const unit = units.find(
      (u) => u.code === ['R01', 'R02', 'R03', 'R04', 'R05', 'M01', 'M02', 'F01', 'F03'][i],
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
  // Крайний случай ширины: на объекте названия категорий длиннее, чем в базовой фикстуре, и на
  // телефоне выпадающий список фильтра растягивал экран (обход стойки 17.09.2026)
  categories[0]!.name = 'Одноместная комната с окном и балконом';
  for (const u of units)
    if (u.accommodationTypeCode === categories[0]!.code)
      u.accommodationTypeName = categories[0]!.name;
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
      reservationNumber: null,
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
      reservationNumber: '20260913-TEST1',
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
      reservationNumber: '20260913-TEST3',
    },
  ];
}
/**
 * Стенд без единой брони, но с фондом, категориями и ценами — это состояние боевой базы после
 * очистки 19.09.2026 (ADR-052) и до первой живой смены. Экраны обязаны в нём открываться и
 * говорить, что броней нет, а не выглядеть сломанными.
 */
let noBookings = false;
// Новый отель без фонда: гейт уводит на /onboarding. По умолчанию отель настроен (false),
// иначе существующие UI-тесты на рабочих экранах уходили бы на онбординг.
let onboardingNeeded = false;
const allCards = () => (noBookings ? [] : [card, ...extraCards.values()]);
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
/** ADR-072: режим хранения данных гостей; по умолчанию — как в базе в Казахстане, чтобы прежние экраны не менялись */
let piiStorage: 'real' | 'pseudonymized' = 'real';
let failPath = '';
/** Задержка ответа по одному пути: проверка состояния загрузки (B5); 0 — без задержки */
let delayPath = '';
let delayMs = 0;
/** Код ответа для failPath: 503 (сбой) по умолчанию, 400/404 — отклонённый запрос */
let failStatus = 503;
let emptyFixture = false;
/** Несопоставленная с Channex категория: /rates/bulk сохраняет, но в очередь ничего не ставит */
let ratesUnmapped = false;
/** Сколько записей истории отдаёт /guard/incidents?status=all (проверка «список обрезан») */
let incidentHistory = 0;
const housekeeping = new Map<string, UnitCard['housekeepingStatus']>();
/**
 * Статус уборки ячейки: один источник для шахматки и карточки места. До 21.09.2026 карточка брала
 * `?? 'CLEAN'`, а доска — свой набор по умолчанию, и R01 была грязной на доске и убранной в карточке.
 * С 22.09 «убрано» — шаг цикла со значком в строке, поэтому по умолчанию ячейки проверены (доступны):
 * иначе на доске стояло бы 85 значков «ждёт проверки». Требуют уборки R01 и M01.
 */
const housekeepingOf = (code: string): UnitCard['housekeepingStatus'] =>
  housekeeping.get(code) ?? (code === 'R01' || code === 'M01' ? 'DIRTY' : 'INSPECTED');
const blocks = new Map<string, UnitCard['blocks']>();
const blocksFor = (code: string) => blocks.get(code) ?? [];
let priceChanges: Array<{
  dateFrom: string;
  dateTo: string;
  price?: string;
  occupancy?: number;
  stopSell?: boolean;
  minStay?: number;
}> = [];
/**
 * Витрина каналов (срез 7.2, макеты «Integration» и «Inbound»): события с фильтрами и второй страницей,
 * факты ревизий без персональных данных (ADR-018), строки очереди в Channex. Включается `showcase: true`
 * в `POST /__test/control` вместе с витриной конфликтов среза 7.3. Все брони и гости вымышленные (ADR-010).
 */
let showcase = false;
let showcaseEvents: InboundEvent[] = [];
const showcaseRevisions = new Map<string, RevisionFacts>();
let showcaseOutbox: OutboxRow[] = [];
function showcaseCard(
  number: string,
  o: { unit: string; status: string; channel: string; nights: number; price: string },
): ReservationCard {
  const unit = units.find((u) => u.code === o.unit)!;
  const r = cardSeed();
  r.confirmationNumber = number;
  r.source = 'OTA';
  r.channel = o.channel;
  r.status = o.status;
  r.departureDate = add(today, o.nights);
  r.totalAmountMinor = o.price;
  r.primaryGuest = { id: 'ui-guest', label: 'Гость Тестовый', citizenship: 'KAZ', phone: null };
  r.items[0] = {
    ...r.items[0]!,
    id: `ui-item-${number.slice(-6).toLowerCase()}`,
    status: o.status,
    departureDate: r.departureDate,
    unitCode: unit.code,
    accommodationTypeCode: unit.accommodationTypeCode,
    accommodationTypeName: unit.accommodationTypeName,
    priceMinor: o.price,
  };
  return r;
}
function applyChannelShowcase() {
  const t = (n: number) => add(today, n);
  showcase = true;
  // Две перенесённые брони Booking.com с одинаковым составом (Q-109) и отменённая Expedia
  for (const r of [
    showcaseCard('20260913-SHOWTN', {
      unit: 'R06',
      status: 'TENTATIVE',
      channel: 'Booking.com',
      nights: 2,
      price: '1600000',
    }),
    showcaseCard('20260913-SHOWEX', {
      unit: 'M03',
      status: 'CONFIRMED',
      channel: 'Booking.com',
      nights: 2,
      price: '800000',
    }),
    showcaseCard('20260913-SHOWCX', {
      unit: 'R07',
      status: 'CANCELLED',
      channel: 'Expedia',
      nights: 2,
      price: '1600000',
    }),
  ])
    extraCards.set(r.confirmationNumber, r);
  showcaseEvents = [
    {
      externalEventId: 'ui-rev-failed',
      receivedVia: 'WEBHOOK',
      type: 'booking_new',
      status: 'FAILED',
      attempts: 6,
      receivedAt: `${today}T05:12:40Z`,
      processedAt: null,
      lastError:
        'Несколько перенесённых броней подходят: 20260913-SHOWTN, 20260913-SHOWEX — разберите руками (Q-109)',
      uniqueId: 'BDC-4821-7731',
      otaName: 'Booking.com',
      confirmationNumber: null,
    },
    {
      externalEventId: 'ui-rev-modified',
      receivedVia: 'WEBHOOK',
      type: 'booking_modification',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${today}T04:58:03Z`,
      processedAt: `${today}T04:58:05Z`,
      lastError: null,
      uniqueId: 'BDC-5510-2201',
      otaName: 'Booking.com',
      confirmationNumber: '20260913-SHOWTN',
    },
    {
      externalEventId: 'ui-rev-cancelled',
      receivedVia: 'PULL',
      type: 'booking_cancellation',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${today}T03:20:11Z`,
      processedAt: `${today}T03:20:12Z`,
      lastError: null,
      uniqueId: 'EXP-90210',
      otaName: 'Expedia',
      confirmationNumber: '20260913-SHOWCX',
    },
    {
      // Проверка webhook Channex приходит с двоеточиями в номере — экран обязан её открыть
      externalEventId: 'test:2026-09-16T18:35:20.672058Z:74234e98afe7',
      receivedVia: 'WEBHOOK',
      type: 'booking_new',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${today}T02:50:00Z`,
      processedAt: `${today}T02:50:01Z`,
      lastError: null,
      uniqueId: 'BDC-5510-2201',
      otaName: 'Booking.com',
      confirmationNumber: '20260913-SHOWTN',
    },
    {
      externalEventId: 'ui-rev-new-2',
      receivedVia: 'WEBHOOK',
      type: 'booking_new',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${today}T02:41:07Z`,
      processedAt: `${today}T02:41:09Z`,
      lastError: null,
      uniqueId: 'BDC-5510-2201',
      otaName: 'Booking.com',
      confirmationNumber: '20260913-SHOWTN',
    },
    // Хвост обработанных событий — чтобы была вторая страница («показано 20 из 32»)
    ...Array.from({ length: 28 }, (_, i) => ({
      externalEventId: `ui-rev-auto-${String(i + 1).padStart(2, '0')}`,
      receivedVia: (i % 5 === 0 ? 'PULL' : 'WEBHOOK') as 'PULL' | 'WEBHOOK',
      type: i % 7 === 3 ? 'booking_cancellation' : 'booking_new',
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: `${t(-1 - Math.floor(i / 4))}T${String(20 - (i % 4) * 3).padStart(2, '0')}:1${i % 10}:00Z`,
      processedAt: `${t(-1 - Math.floor(i / 4))}T${String(20 - (i % 4) * 3).padStart(2, '0')}:1${i % 10}:02Z`,
      lastError: null,
      uniqueId: `HW-AUTO-${1000 + i}`,
      otaName: 'Hostelworld',
      confirmationNumber: null,
    })),
  ];
  const facts = (o: Partial<RevisionFacts>): RevisionFacts => ({
    uniqueId: null,
    otaName: null,
    otaReservationCode: null,
    status: null,
    arrivalDate: null,
    departureDate: null,
    adults: 1,
    children: 0,
    amount: null,
    currency: 'KZT',
    paymentCollect: 'ota',
    rooms: [],
    ...o,
  });
  const room = {
    checkinDate: today,
    checkoutDate: t(2),
    roomTypeId: 'ui-rt-room',
    ratePlanId: 'ui-rp-room',
    adults: 1,
    amount: '16000.00',
  };
  showcaseRevisions.clear();
  showcaseRevisions.set(
    'ui-rev-failed',
    facts({
      uniqueId: 'BDC-4821-7731',
      otaName: 'Booking.com',
      otaReservationCode: '4821773100',
      status: 'new',
      arrivalDate: today,
      departureDate: t(2),
      amount: '16000.00',
      rooms: [room],
    }),
  );
  for (const id of [
    'ui-rev-new-2',
    'ui-rev-modified',
    'test:2026-09-16T18:35:20.672058Z:74234e98afe7',
  ])
    showcaseRevisions.set(
      id,
      facts({
        uniqueId: 'BDC-5510-2201',
        otaName: 'Booking.com',
        otaReservationCode: '5510220100',
        status: id === 'ui-rev-new-2' ? 'new' : 'modified',
        arrivalDate: today,
        departureDate: t(2),
        amount: '16000.00',
        rooms: [room],
      }),
    );
  showcaseRevisions.set(
    'ui-rev-cancelled',
    facts({
      uniqueId: 'EXP-90210',
      otaName: 'Expedia',
      otaReservationCode: '90210',
      status: 'cancelled',
      arrivalDate: today,
      departureDate: t(2),
      amount: '16000.00',
      paymentCollect: 'property',
    }),
  );
  showcaseOutbox = [
    {
      id: 'ui-out-1',
      kind: 'RESTRICTIONS',
      status: 'SENT',
      attempts: 1,
      taskId: 'ui-task-4f2a',
      lastError: null,
      createdAt: `${today}T04:09:40Z`,
      sentAt: `${today}T04:10:02Z`,
      dateFrom: t(-9),
      dateTo: t(-8),
      roomTypes: ['ROOM'],
      messages: 2,
    },
    {
      id: 'ui-out-2',
      kind: 'AVAILABILITY',
      status: 'PENDING',
      attempts: 0,
      taskId: null,
      lastError: null,
      createdAt: `${today}T04:11:15Z`,
      sentAt: null,
      dateFrom: today,
      dateTo: t(1),
      roomTypes: ['FEMALE'],
      messages: 2,
    },
    {
      id: 'ui-out-3',
      kind: 'AVAILABILITY',
      status: 'FAILED',
      attempts: 3,
      taskId: null,
      lastError: 'Channex ответил 422 «rate plan not found» — проверьте сопоставление тарифов',
      createdAt: `${today}T03:58:30Z`,
      sentAt: null,
      dateFrom: t(1),
      dateTo: t(3),
      roomTypes: ['ROOM'],
      messages: 3,
    },
    {
      id: 'ui-out-4',
      kind: 'RESTRICTIONS',
      status: 'PENDING',
      attempts: 0,
      taskId: null,
      lastError: null,
      createdAt: `${today}T04:12:03Z`,
      sentAt: null,
      dateFrom: t(6),
      dateTo: t(8),
      roomTypes: ['MALE', 'FEMALE'],
      messages: 6,
    },
  ];
}
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
  kind: 'stay.unassigned',
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

/**
 * Смена видит не одну неисправность, а несколько разом (снимок владельца 21.09.2026): срочная
 * техника, ошибка кода и данные, плюс закрытые за сутки. `POST /__test/control {"incidentsMix": true}`
 * даёт это состояние, не трогая одиночный сид, на котором стоят прежние спеки.
 */
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const mixIncidents = (): Incident[] => [
  {
    ...structuredClone(incidentSeed),
    id: 'ui-incident-down',
    kind: 'desk.down',
    class: 'A',
    severity: 'CRITICAL',
    status: 'ESCALATED',
    title: 'Стойка PMS не отвечает',
    subjectType: null,
    subjectId: null,
    occurrences: 1226,
    firstSeenAt: hoursAgo(20.5),
    lastSeenAt: new Date().toISOString(),
    fixAttempts: 2,
    lastFixAt: hoursAgo(20),
    lastFixResult: 'перезапуск стойки на этой машине не настроен (нет launchd)',
    alertedAt: hoursAgo(20.4),
  },
  {
    ...structuredClone(incidentSeed),
    id: 'ui-incident-http',
    kind: 'api.error',
    class: 'C',
    severity: 'WARNING',
    status: 'ESCALATED',
    title: 'Ошибка программы (HTTP 500) на GET /system/freshness',
    subjectType: null,
    subjectId: null,
    occurrences: 47,
    firstSeenAt: hoursAgo(11),
    lastSeenAt: hoursAgo(0.2),
    alertedAt: hoursAgo(4),
  },
  {
    ...structuredClone(incidentSeed),
    id: 'ui-incident-feed',
    kind: 'feed.stale',
    class: 'B',
    severity: 'WARNING',
    status: 'ACKNOWLEDGED',
    title: 'Лента Channex не читалась 3 ч — брони доходят только через webhook',
    subjectType: null,
    subjectId: null,
    occurrences: 998,
    firstSeenAt: hoursAgo(16.6),
    lastSeenAt: new Date().toISOString(),
    alertedAt: hoursAgo(0.5),
    acknowledgedAt: hoursAgo(0.3),
  },
];
const mixClosed = (): Incident[] =>
  [
    ['Webhook Channex под подозрением: адрес не отвечает', 'GUARD', 0.3, 0.25] as const,
    [
      'Адрес webhook Channex не отвечает — брони доходят только опросом ленты',
      'GUARD',
      0.4,
      0.25,
    ] as const,
    ['Стойка PMS не отвечает', 'GUARD', 21, 20.9] as const,
  ].map(([title, by, seen, closed], i) => ({
    ...structuredClone(incidentSeed),
    id: `ui-incident-closed-${i}`,
    kind: 'desk.down',
    class: 'A' as const,
    status: 'RESOLVED' as const,
    title,
    firstSeenAt: hoursAgo(seen),
    lastSeenAt: hoursAgo(closed),
    resolvedAt: hoursAgo(closed),
    resolvedBy: by,
  }));
/** Дополнительные неисправности сверх одиночного сида: пусто, пока режим не включён */
let extraIncidents: Incident[] = [];
/** Журнал за несколько дней: без него все строки фикстуры — сегодняшние, и группы по дням не проверить */
let journalHistory = false;
let guardTick = false;

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
  // Не заехали вовремя — как в apps/api/src/desk/desk.service.ts: заезд был раньше, заселения нет,
  // выезд не сегодня (иначе они уже в списке выездов). API берёт только проживания, которые касаются
  // суток (`departureDate >= date`, desk.repository.ts), — без этой границы фикстура звала «не заехавшими
  // вовремя» брони, закончившиеся месяцы назад, и пустой день 2027-06-01 показывал четыре задачи
  // (найдено разбором «Главной» 23.09.2026)
  const overdueArrivals = active.filter(
    (r) =>
      (r.status === 'CONFIRMED' || r.status === 'TENTATIVE') &&
      r.arrivalDate < date &&
      r.departureDate > date,
  );
  return {
    date,
    arrivals,
    departures,
    inHouse,
    overdueArrivals,
    counts: {
      arrivals: arrivals.length,
      departures: departures.length,
      inHouse: inHouse.length,
      toCheckIn: arrivals.filter((r) => r.status !== 'CHECKED_IN').length,
      toCheckOut: departures.filter((r) => r.status === 'CHECKED_IN').length,
      overdueArrivals: overdueArrivals.length,
    },
    debtMinor: departures
      .filter((r) => r.status === 'CHECKED_IN' && BigInt(r.balanceMinor) > 0n)
      .reduce((sum, r) => sum + BigInt(r.balanceMinor), 0n)
      .toString(),
  };
}
function board(from: string, to: string): Chessboard {
  const days = dates(from, to);
  // Срез 7.1: уборка — свойство ячейки; в фикстуре две грязные и одна проверенная, остальные убраны
  const hk = housekeepingOf;
  const rows = units.map((u) => ({
    unit: { id: u.code, ...u, housekeepingStatus: hk(u.code) },
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
            // канал и остаток к оплате — как отдаёт API после среза 7.1
            source: r.source,
            channel: r.channel,
            balanceMinor: finance(r).balanceMinor,
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
/** Синтетические цены за ночь (срез 7.3): номер 8 000 ₸, койка 4 000 ₸ — как в карточке 20260913-TESTAA */
const nightly = (categoryCode: string) => (categoryCode === 'ROOM' ? 800000n : 400000n);
const nightsOf = (it: { arrivalDate: string; departureDate: string }) =>
  Math.max(1, Math.round((Date.parse(it.departureDate) - Date.parse(it.arrivalDate)) / 86400000));
const LIVE = (status: string) => !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(status);
const tenge = (minor: bigint) =>
  `${(minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
/** Ячейка занята другим проживанием или блоком на ночи [from, to) */
const unitBusy = (code: string, from: string, to: string, except?: { id: string }) =>
  allCards().some((o) =>
    o.items.some(
      (x) =>
        x.id !== except?.id &&
        x.unitCode === code &&
        LIVE(x.status) &&
        x.arrivalDate < to &&
        x.departureDate > from,
    ),
  ) || blocksFor(code).some((b) => b.dateFrom < to && b.dateTo >= from);
const retotal = (r: ReservationCard) => {
  r.totalAmountMinor = r.items.reduce((sum, it) => sum + BigInt(it.priceMinor), 0n).toString();
};
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

/**
 * Вход в стойку для проверок интерфейса (DATA_MODEL §13.8, ADR-049). Настоящих людей здесь нет (ADR-010):
 * один вымышленный сотрудник и пароль, который знает только эта фикстура.
 */
interface UiUser {
  id: string;
  email: string;
  name: string | null;
  organizationId: string;
  organization: { name: string; status: string; trialEndsAt: string | null };
}
const uiUser: UiUser = {
  id: 'ui-user',
  email: 'admin@wetop.test',
  name: 'Дана Тестова',
  organizationId: 'ui-org',
  organization: { name: 'Luxx Aparts', status: 'ACTIVE', trialEndsAt: null },
};
let uiPassword = 'ui-test-parol';
let registrationEnabled = true;
/** Кто уже состоит в организации фикстуры, кроме самого вошедшего — приглашать их повторно нельзя */
const uiMembers = new Set(['admin@wetop.test', 'urij@example.com']);
/** Сессии стенда: ключ → кто вошёл. Вход один — по паролю (ADR-053). */
const uiSessions = new Map<string, UiUser>();

/**
 * Сколько раз стойка спросила каждый путь. Разбор «всё тормозит» (16.09.2026): экран, который делает
 * лишние рейсы к API, на машине владельца стоит лишние сотни миллисекунд — и это видно только счётчиком.
 * Читается тестом (`tests/ui/requests.spec.ts`), обнуляется вместе с остальной фикстурой.
 */
const hits = new Map<string, number>();
const requestHits = new Map<string, number>();
const countHit = (url: URL, method: string): void => {
  const path = url.pathname;
  if (path.startsWith('/__test/')) return;
  hits.set(path, (hits.get(path) ?? 0) + 1);
  const query = new URLSearchParams(url.searchParams);
  query.sort();
  const key = `${method} ${path}${query.size ? `?${query}` : ''}`;
  requestHits.set(key, (requestHits.get(key) ?? 0) + 1);
};
/** Одноразовые ссылки на пароль: токен → годна ли ещё (проверки сброса, DATA_MODEL §13 шаг 1) */
const uiResetTokens = new Map<string, { used: boolean; expired: boolean }>();
/** Ссылки подтверждения почты (ADR-060): выдаются регистрацией, гасятся переходом. */
const uiVerifications = new Map<string, { email: string; name: string; used: boolean }>();
uiResetTokens.set('ui-reset-token', { used: false, expired: false });
uiResetTokens.set('ui-reset-expired', { used: false, expired: true });

function sessionOf(req: { headers: Record<string, unknown> }): string | null {
  const direct = req.headers['x-wetop-session'];
  if (typeof direct === 'string' && direct !== '') return direct;
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer '))
    return header.slice(7).trim();
  return null;
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
    // календарь цен без справочника: экран показывает пустое состояние с причиной (D4)
    if (path === '/rates/options') return { categories: [], ratePlans: [] };
    if (path === '/finance/services') return [];
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
        // как у API: возвраты отдаются всегда, и при пустом периоде тоже (D2 читает их число)
        refunds: { count: 0, amountMinor: '0' },
        accommodationByCategory: [],
      };
  }
  if (path.endsWith('/MISSING')) return undefined;
  if (path === '/guard/status') {
    const live = [incident, ...extraIncidents].filter((i) => i.status !== 'RESOLVED');
    return {
      running: true,
      autofix: guardTick,
      propertyLive: true,
      notifier: { configured: true, recipients: 1 },
      dbDownSince: null,
      lastTick: guardTick
        ? {
            at: new Date(Date.now() - 90_000).toISOString(),
            durationMs: 420,
            dbOk: true,
            checked: Array.from({ length: 13 }, (_, i) => `check-${i + 1}`),
            checkErrors: [],
            alertError: null,
          }
        : null,
      open: {
        total: live.length,
        critical: live.filter((i) => i.severity === 'CRITICAL').length,
        escalated: live.filter((i) => i.status === 'ESCALATED').length,
      },
    };
  }
  if (path === '/guard/incidents') {
    if (q.get('status') !== 'open' && incidentHistory > 0)
      return Array.from(
        { length: Math.min(incidentHistory, Number(q.get('limit')) || 100) },
        (_, i) => ({
          ...incident,
          id: `ui-incident-${i}`,
          status: 'RESOLVED',
          resolvedAt: new Date(Date.now() - i * 60_000).toISOString(),
          resolvedBy: 'STAFF',
        }),
      );
    const rows = [incident, ...extraIncidents];
    return q.get('status') === 'open' ? rows.filter((i) => i.status !== 'RESOLVED') : rows;
  }
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
      needsOnboarding: onboardingNeeded,
    };
  if (path === '/hotel/onboarding')
    return { needed: onboardingNeeded, name: propertyName, currency: 'KZT' };
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
        capacityAdults: c.capacityAdults,
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
  // Срез 7.3: предпросмотр действия — считает так же, как настоящий API, но ничего не меняет
  if (path.startsWith('/reservations/') && path.endsWith('/preview')) {
    const parts = path.split('/');
    const r = getCard(decodeURIComponent(parts[2]!));
    const item = r?.items.find((i) => i.id === decodeURIComponent(parts[4]!));
    if (!r || !item) return undefined;
    const action = q.get('action') ?? '';
    const current = BigInt(item.priceMinor);
    const night = nightly(item.accommodationTypeCode);
    if (action === 'cancel' || action === 'no_show')
      return {
        action,
        currentPriceMinor: item.priceMinor,
        currency: 'KZT',
        voidedMinor: item.priceMinor,
        // отмена заранее бесплатна, незаезд платный всегда (Q-103)
        penaltyMinor: action === 'no_show' ? night.toString() : '0',
        policy: 'FIRST_NIGHT',
      };
    if (action === 'extend')
      return {
        action,
        currentPriceMinor: item.priceMinor,
        currency: 'KZT',
        nights: 1,
        departureDate: add(item.departureDate, 1),
        newPriceMinor: (current + night).toString(),
        differenceMinor: night.toString(),
      };
    const unitCode = q.get('unitCode') ?? '';
    const unit = units.find((u) => u.code === unitCode);
    const changesCategory = !!unit && unit.accommodationTypeCode !== item.accommodationTypeCode;
    const nights = BigInt(
      Math.max(
        1,
        Math.round(
          (Date.parse(`${item.departureDate}T00:00:00Z`) -
            Date.parse(`${item.arrivalDate}T00:00:00Z`)) /
            86_400_000,
        ),
      ),
    );
    const moved = changesCategory ? nights * 1_500_000n : current;
    return {
      action: 'move',
      currentPriceMinor: item.priceMinor,
      currency: 'KZT',
      changesCategory,
      unitCode,
      categoryName: unit?.accommodationTypeName,
      newPriceMinor: moved.toString(),
      differenceMinor: (moved - current).toString(),
    };
  }
  if (path.startsWith('/reservations/') && /-preview$/.test(path)) {
    const parts = path.split('/');
    const tail = parts[parts.length - 1];
    const r = getCard(decodeURIComponent(parts[2]!));
    if (!r) return undefined;
    if (tail === 'cancel-preview') {
      const reason = q.get('reason') === 'no_show' ? 'no_show' : 'cancel';
      const items = r.items
        .filter((it) => (!q.get('itemId') || it.id === q.get('itemId')) && LIVE(it.status))
        .map((it) => {
          // штраф — первая ночь, и только с дня заезда (Q-103); до заезда отмена бесплатна
          const dueNow = it.arrivalDate <= today;
          return {
            itemId: it.id,
            unitCode: it.unitCode,
            policy: 'FIRST_NIGHT',
            dueNow,
            penaltyMinor: (dueNow ? nightly(it.accommodationTypeCode) : 0n).toString(),
          };
        });
      return {
        reason,
        items,
        totalPenaltyMinor: items.reduce((s, i) => s + BigInt(i.penaltyMinor), 0n).toString(),
      };
    }
    const item = r.items.find((it) => it.id === parts[4]);
    if (!item) return undefined;
    const nights = nightsOf(item);
    if (tail === 'move-preview') {
      const unit = units.find((u) => u.code === q.get('unitCode'));
      const from = categories.find((c) => c.code === item.accommodationTypeCode) ?? null;
      if (!unit)
        return {
          unitCode: q.get('unitCode') ?? '',
          changesCategory: false,
          fromCategory: from && { code: from.code, name: from.name },
          toCategory: null,
          nights,
          currentMinor: item.priceMinor,
          newMinor: null,
          ratePlanRequired: false,
          problem: 'Ячейка не найдена',
        };
      const to = categories.find((c) => c.code === unit.accommodationTypeCode)!;
      const changes = to.code !== item.accommodationTypeCode;
      return {
        unitCode: unit.code,
        changesCategory: changes,
        fromCategory: from && { code: from.code, name: from.name },
        toCategory: { code: to.code, name: to.name },
        nights,
        currentMinor: item.priceMinor,
        newMinor: changes ? (nightly(to.code) * BigInt(nights)).toString() : item.priceMinor,
        ratePlanRequired: false,
        problem: null,
      };
    }
    if (tail === 'extend-preview') {
      const n = Math.max(1, Number(q.get('nights') || 1));
      const departure = add(item.departureDate, n);
      const added = nightly(item.accommodationTypeCode) * BigInt(n);
      return {
        nights: n,
        departureDate: departure,
        unitCode: item.unitCode,
        addedMinor: added.toString(),
        newMinor: (BigInt(item.priceMinor) + added).toString(),
        ratePlanRequired: !item.ratePlanCode && !q.get('ratePlanCode'),
        nextNightsFree:
          !item.unitCode || !unitBusy(item.unitCode, item.departureDate, departure, item),
        problem: null,
      };
    }
    return undefined;
  }
  if (path.startsWith('/reservations/')) {
    // Q-156: карточка знает статус уборки ячейки — стойка предупреждает о заселении в непроверенную
    const found = getCard(decodeURIComponent(path.split('/')[2]!));
    return found
      ? {
          ...found,
          items: found.items.map((it) => ({
            ...it,
            unitHousekeepingStatus: it.unitCode ? housekeepingOf(it.unitCode) : null,
          })),
        }
      : found;
  }
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
      housekeepingStatus: housekeepingOf(u.code),
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
      days: dates(q.get('from') || today, q.get('to') || add(today, 13)).map((date, idx) => {
        const forDay = [...priceChanges]
          .reverse()
          .filter((c) => c.dateFrom <= date && c.dateTo >= date);
        // цена на одно число гостей: строка без occupancy — на всех, с occupancy — только на своё
        const price = (occ: number, fallback: string) =>
          parseMoney(
            forDay.find((c) => c.price && (!c.occupancy || c.occupancy === occ))?.price || fallback,
          ).toString();
        const stop = forDay.find((c) => c.stopSell !== undefined)?.stopSell;
        return {
          date,
          prices: { '1': price(1, '8000'), '2': price(2, '10000') },
          minStay: forDay.find((c) => c.minStay !== undefined)?.minStay ?? 1,
          maxStay: null,
          // Витрина: две закрытые ночи, как на макете «Rates» — слово «закрыто» и подсветка строки
          stopSell: stop ?? (showcase && (idx === 5 || idx === 11)),
          closedToArrival: false,
          closedToDeparture: false,
        };
      }),
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
  if (path === '/system/pii-storage') return { storage: piiStorage };
  if (path === '/system/freshness')
    return {
      checkedAt: new Date().toISOString(),
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
    return showcase
      ? {
          pending: 2,
          failed: 1,
          sent: 405,
          lastSentAt: `${today}T09:12:00Z`,
          lastTaskId: 'ui-task-4f2a',
        }
      : { pending: 0, failed: 0, sent: 16, lastSentAt: null, lastTaskId: null };
  if (path === '/channels/channex/outbox/rows') {
    const st = q.get('status');
    return showcaseOutbox.filter((r) => !st || r.status === st);
  }
  if (path === '/channels/channex/events') {
    // как у настоящего API: фильтры, поиск по событию / unique_id / номеру брони, страница
    const source = showcase ? showcaseEvents : designEvents;
    const st = q.get('status'),
      type = q.get('type'),
      needle = (q.get('q') || '').trim().toLowerCase();
    const limit = Number(q.get('limit') || 20),
      offset = Number(q.get('offset') || 0);
    const rows = source.filter(
      (e) =>
        (!st || e.status === st) &&
        (!type || e.type === type) &&
        (!needle ||
          e.externalEventId.toLowerCase().includes(needle) ||
          (e.uniqueId ?? '').toLowerCase().includes(needle) ||
          (e.confirmationNumber ?? '').toLowerCase().includes(needle)),
    );
    return { rows: rows.slice(offset, offset + limit), total: rows.length };
  }
  if (path.startsWith('/channels/channex/events/')) {
    const id = decodeURIComponent(path.split('/')[4]!);
    const event = showcaseEvents.find((e) => e.externalEventId === id);
    const facts = showcaseRevisions.get(id);
    if (!event || !facts) return undefined;
    const reservation = event.confirmationNumber ? getCard(event.confirmationNumber) : undefined;
    const fin = reservation ? finance(reservation) : null;
    return {
      event,
      facts,
      categoryByRoomType: { 'ui-rt-room': 'ROOM', 'ui-rt-male': 'MALE', 'ui-rt-female': 'FEMALE' },
      reservation: reservation ?? null,
      balances: Object.fromEntries(
        (fin?.folios ?? []).map((f) => [f.reservationItemId, f.balanceMinor]),
      ),
    };
  }
  // Срез 7.2: строки очереди — что именно уехало в Channex и чем кончилось
  if (path === '/channels/channex/outbox/messages')
    return [
      {
        id: 'ui-outbox-1',
        kind: 'AVAILABILITY',
        status: 'PENDING',
        attempts: 0,
        taskId: null,
        lastError: null,
        createdAt: `${today}T06:40:00Z`,
        sentAt: null,
        lines: 5,
        dateFrom: today,
        dateTo: add(today, 4),
        roomTypeIds: ['ui-room-type'],
        ratePlanIds: [],
      },
      {
        id: 'ui-outbox-2',
        kind: 'RESTRICTIONS',
        status: 'SENT',
        attempts: 1,
        taskId: 'ui-task-77',
        lastError: null,
        createdAt: `${today}T06:20:00Z`,
        sentAt: `${today}T06:20:03Z`,
        lines: 31,
        dateFrom: today,
        dateTo: add(today, 30),
        roomTypeIds: [],
        ratePlanIds: ['ui-rate-plan'],
      },
      {
        id: 'ui-outbox-3',
        kind: 'AVAILABILITY',
        status: 'FAILED',
        attempts: 3,
        taskId: null,
        lastError: 'Channex: 422 unprocessable entity — room_type_id не найден',
        createdAt: `${today}T05:50:00Z`,
        sentAt: null,
        lines: 2,
        dateFrom: today,
        dateTo: add(today, 1),
        roomTypeIds: ['ui-room-type'],
        ratePlanIds: [],
      },
    ];
  if (path === '/channels/channex/webhook/status')
    return { registered: false, active: false, expectedUrl: null, secretConfigured: false };
  if (path === '/audit') {
    // фильтр по типу объекта фикстура уважает так же, как настоящий API: иначе проверка отбора ничего не проверяет
    const type = q.get('entityType');
    const entries = [
      {
        id: 'ui-audit',
        at: `${today}T08:30:00Z`,
        entityType: 'Reservation',
        entityId: 'ui-item',
        action: 'reservation.checkIn',
        subject: card.confirmationNumber,
        // кто сделал: имя вошедшего (ADR-023, ADR-046). Сотрудник вымышленный, как и всё в фикстуре
        author: uiUser.name,
      },
      {
        id: 'ui-audit-login',
        at: `${today}T08:00:00Z`,
        entityType: 'user',
        entityId: uiUser.id,
        action: 'user.login',
        subject: null,
        author: uiUser.name,
      },
      {
        id: 'ui-audit-system',
        at: `${today}T07:45:00Z`,
        entityType: 'Property',
        entityId: 'ui-property',
        action: 'channex.fullSync',
        subject: null,
        // без автора: так ходят импорт, сторож и скрипты сверки
        author: null,
      },
    ];
    if (journalHistory)
      entries.push(
        {
          id: 'ui-audit-yesterday',
          at: `${add(today, -1)}T11:15:00Z`,
          entityType: 'InventoryUnit',
          entityId: 'ui-unit',
          action: 'unit.block',
          subject: 'R01',
          author: uiUser.name,
        },
        {
          id: 'ui-audit-older',
          at: `${add(today, -3)}T06:05:00Z`,
          entityType: 'Reservation',
          entityId: 'ui-item',
          action: 'reservation.create',
          subject: card.confirmationNumber,
          author: null,
        },
      );
    // поиск — как у настоящего API: по номеру брони (subject); пустой ответ даёт пустое состояние (D4)
    const needle = (q.get('q') || '').trim().toLowerCase();
    return entries
      .filter((e) => !type || e.entityType === type)
      .filter((e) => !needle || (e.subject ?? '').toLowerCase().includes(needle));
  }
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
    countHit(url, req.method ?? 'GET');
    if (path === '/health' && demo) return send(200, { demo: true });
    if (demo && path.startsWith('/__test/')) return send(404, {});
    if (path === '/__test/health') return send(200, { testOnly: true });
    if (path === '/__test/hits')
      return send(200, {
        total: [...hits.values()].reduce((a, b) => a + b, 0),
        byPath: Object.fromEntries([...hits].sort((a, b) => b[1] - a[1])),
        byRequest: Object.fromEntries(requestHits),
      });
    if (
      !path.startsWith('/__test/') &&
      req.headers[demo ? 'x-wetop-demo-client' : 'x-wetop-test-client'] !== '1'
    ) {
      return send(403, { message: 'Fixture API is available only to the test runner' });
    }
    if (authLock && !openAtLock(path)) {
      const token = sessionOf(req as never);
      if (!token || !uiSessions.has(token)) return send(401, { message: 'Войдите в систему' });
    }
    if (path === '/__test/reset') {
      hits.clear();
      requestHits.clear();
      resetUiAuth();
      setHotelHold(false);
      propertyName = 'Luxx Aparts';
      connectionState = 'READY';
      // A long browser run can cross midnight in the property's timezone.
      today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
      categories.splice(0, categories.length, ...structuredClone(categorySeed));
      for (const unit of units)
        unit.accommodationTypeName = categories.find(
          (c) => c.code === unit.accommodationTypeCode,
        )!.name;
      incident = structuredClone(incidentSeed);
      extraIncidents = [];
      guardTick = false;
      journalHistory = false;
      // имена категорий — до cardSeed(): карточка копирует имя при создании (ревью 20.09)
      for (const c of categories) c.name = BASE_CATEGORY_NAMES.get(c.code) ?? c.name;
      for (const u of units)
        u.accommodationTypeName =
          BASE_CATEGORY_NAMES.get(u.accommodationTypeCode) ?? u.accommodationTypeName;
      card = cardSeed();
      guest = structuredClone(guestSeed);
      commands = [];
      rejectCreate = false;
      failPath = '';
      delayPath = '';
      delayMs = 0;
      failStatus = 503;
      ratesUnmapped = false;
      incidentHistory = 0;
      emptyFixture = false;
      noBookings = false;
      onboardingNeeded = false;
      housekeeping.clear();
      blocks.clear();
      designEvents = [];
      initializeRecords();
      priceChanges = [];
      showcase = false;
      showcaseEvents = [];
      showcaseOutbox = [];
      showcaseRevisions.clear();
      site = structuredClone(siteSeed);
      siteDeleted = false;
      groupFixture = false;
      paid = new Map();
      paymentLines = [];
      piiStorage = 'real';
      return send(200, {});
    }
    if (path === '/__test/control') {
      if (typeof body['registrationEnabled'] === 'boolean')
        registrationEnabled = body['registrationEnabled'];
      if (typeof body['holdHotel'] === 'boolean') setHotelHold(body['holdHotel']);
      if (typeof body['propertyName'] === 'string') propertyName = body['propertyName'];
      if (
        ['READY', 'PROPERTY_MISSING', 'DATABASE_UNAVAILABLE'].includes(
          String(body['connectionState']),
        )
      )
        connectionState = body['connectionState'] as DataConnection['state'];
      emptyFixture = body['empty'] === true;
      noBookings = body['noBookings'] === true;
      if (typeof body['onboardingNeeded'] === 'boolean')
        onboardingNeeded = body['onboardingNeeded'];
      // история неисправностей отдаёт ровно столько, сколько просили: экран не знает, есть ли ещё
      groupFixture = body['group'] === true;
      rejectCreate = body['rejectCreate'] === true;
      piiStorage = body['piiStorage'] === 'pseudonymized' ? 'pseudonymized' : 'real';
      failPath = String(body['failPath'] || '');
      delayPath = String(body['delayPath'] || '');
      delayMs = Number(body['delayMs'] || 1500);
      // предварительная бронь (срез 7.3, Д4): статус TENTATIVE у брони и проживания
      if (body['tentative'] === true) {
        card.status = 'TENTATIVE';
        card.items[0]!.status = 'TENTATIVE';
      }
      // витрина конфликтов (срез 7.3, Д3–Д4): бронь без ячейки, ночь сверх мест, неразобранная ревизия
      if (body['showcase'] === true) {
        const show = cardSeed();
        show.confirmationNumber = '20260913-SHOWUN';
        show.source = 'OTA';
        show.channel = 'Booking.com';
        show.departureDate = add(today, 1);
        show.items[0] = {
          ...show.items[0]!,
          id: 'ui-item-showun',
          accommodationTypeCode: 'MALE',
          accommodationTypeName: categories[1]!.name,
          departureDate: add(today, 1),
          unitCode: null,
          priceMinor: '400000',
        };
        show.totalAmountMinor = '400000';
        extraCards.set(show.confirmationNumber, show);
        incident.kind = 'stay.overbooked';
        incident.title = `${categories[1]!.name} продан сверх мест на ночь ${today}: 37 на 36`;
        incident.subjectType = 'AccommodationType';
        incident.subjectId = 'MALE';
        // события, очередь и ревизии витрины каналов (срез 7.2); неразобранная ревизия — `ui-rev-failed`
        applyChannelShowcase();
      }
      failStatus = Number(body['failStatus']) || 503;
      ratesUnmapped = body['ratesUnmapped'] === true;
      incidentHistory = Number(body['incidents']) || 0;
      journalHistory = body['journalHistory'] === true;
      if (body['incidentsMix'] === true) {
        extraIncidents = [...mixIncidents(), ...mixClosed()];
        guardTick = true;
      }
      // долгое проживание: на объекте живут по три месяца, а доступность считается не дальше 62 ночей
      if (body['longStay'] === true) {
        card.departureDate = add(today, 90);
        card.items[0]!.departureDate = card.departureDate;
      }
      // бронь, перенесённая из Exely: у проживаний нет тарифа (Б1, Б8)
      if (body['withoutRatePlan'] === true)
        for (const it of card.items) Object.assign(it, { ratePlanCode: null, ratePlanName: null });
      return send(200, {});
    }
    // Полный дом на сегодня: 40 вымышленных броней (ADR-010) для проверки, что «Гости» не режут
    // список на 25 строк. Как и design-seed, обычные тесты этих броней не видят, пока не позовут.
    if (path === '/__test/crowd-seed') {
      const count = Math.min(Number(url.searchParams.get('n') || 40), units.length);
      for (let i = 0; i < count; i++) {
        const unit = units[i]!;
        const n = `CROWD${String(i + 1).padStart(2, '0')}`;
        const { r, g } = designCard(
          {
            n,
            label: `Гость Многолюдный-${String(i + 1).padStart(2, '0')}`,
            status: 'CHECKED_IN',
            source: 'DESK',
            channel: null,
            unit: unit.code,
            from: 0,
            to: 0,
            price: '1000000',
          },
          add(today, -1),
          add(today, 1),
        );
        extraCards.set(r.confirmationNumber, r);
        extraGuests.set(g.id, g);
      }
      return send(200, { stays: count });
    }
    if (path === '/__test/design-seed') {
      seedDesign();
      return send(200, { stays: DESIGN_STAYS.length, fullMonthUnits: units.length });
    }
    if (path === '/__test/commands') return send(200, commands);
    if (delayPath && path === delayPath)
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    if (path === failPath || failPath === '*')
      return send(
        failStatus,
        failStatus >= 500
          ? { message: 'Синтетический сбой API' }
          : { message: 'Синтетический отказ API: запрос отклонён' },
      );
    if (path === '/hotel/settings' && holdHotel)
      await new Promise<void>((resolve) => hotelWaiters.add(resolve));
    if (path === '/hotel/reservations' && req.method === 'GET') {
      const from = url.searchParams.get('from') || today,
        to = url.searchParams.get('to') || from;
      const status = url.searchParams.get('status') || 'ALL';
      const q = (url.searchParams.get('q') || '').toLocaleLowerCase('ru');
      const inPeriod = allCards().filter(
        (r) =>
          r.arrivalDate <= to &&
          r.departureDate >= from &&
          `${r.primaryGuest?.label} ${r.confirmationNumber}`.toLocaleLowerCase('ru').includes(q),
      );
      // Числа на чипах статусов — как в API: по отбору без самого статуса
      const counts: Record<string, number> = { ALL: emptyFixture ? 0 : inPeriod.length };
      if (!emptyFixture) for (const r of inPeriod) counts[r.status] = (counts[r.status] ?? 0) + 1;
      const rows = inPeriod
        .filter((r) => status === 'ALL' || r.status === status)
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
      const pageSize = Number(url.searchParams.get('pageSize') || 25);
      const page = Number(url.searchParams.get('page') || 1);
      return send(200, {
        from,
        to,
        total: emptyFixture ? 0 : rows.length,
        page,
        pageSize,
        counts,
        rows: emptyFixture ? [] : rows.slice((page - 1) * pageSize, page * pageSize),
      });
    }
    // ── Приглашения (срез 13, этап 7): один живой ключ, остальные — мёртвая ссылка.
    const invitePreview = {
      organizationName: 'Хостел «Пример»',
      email: 'novyj@example.com',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    };
    if (path === '/auth/invites') {
      const token = sessionOf(req as never);
      const who = token ? uiSessions.get(token) : null;
      if (!who?.organization) return send(401, { message: 'Сеанс закончился. Войдите заново.' });
      if (req.method === 'POST') {
        const email = String(body['email'] ?? '')
          .trim()
          .toLowerCase();
        if (!email.includes('@'))
          return send(400, { message: 'Укажите почту человека, которого приглашаете.' });
        // Члены вымышленной организации: вошедший и сотрудник, заведённый входом по коду (urij@…)
        if (email === who.email || uiMembers.has(email))
          return send(400, { message: 'Этот человек уже в организации.' });
        return send(201, {
          id: `inv-${Date.now()}`,
          email,
          expiresAt: invitePreview.expiresAt,
          acceptedAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      return send(200, [
        {
          id: 'inv-fixture',
          email: 'zhdet@example.com',
          expiresAt: invitePreview.expiresAt,
          acceptedAt: null,
          createdAt: new Date(Date.now() - 3600_000).toISOString(),
        },
      ]);
    }
    const inviteMatch = /^\/auth\/invites\/([^/]+)(\/accept)?$/.exec(path);
    if (inviteMatch) {
      if (inviteMatch[1] !== 'fixture-invite-token')
        return send(404, {
          message: 'Приглашение не найдено, уже принято или его срок истёк.',
        });
      // Принятие (ADR-053) отдаёт одноразовый ключ: приглашённый задаёт себе пароль, письма нет.
      // Просмотр ссылки ключа не даёт — смотреть можно сколько угодно.
      if (inviteMatch[2]) {
        const token = 'fixture-set-password-token';
        uiResetTokens.set(token, { used: false, expired: false });
        return send(200, { ...invitePreview, setPasswordToken: token });
      }
      return send(200, invitePreview);
    }
    if (path === '/auth/me') {
      const token = sessionOf(req as never);
      return send(200, { user: (token && uiSessions.get(token)) || null });
    }
    // ── Вход по коду и регистрация (ADR-046): код всегда 123456. Декорация для экрана, не проверка API.
    const noContent = () => {
      res.writeHead(204, { 'x-wetop-data-source': 'synthetic' });
      res.end();
    };
    // ── «Где я вошёл» и «выйти везде» (§13.5): эта сессия и телефон, любым входом; отзыв гасит все ключи.
    if (path === '/auth/sessions') {
      const token = sessionOf(req as never);
      if (!token || !uiSessions.has(token))
        return send(401, { message: 'Сеанс закончился. Войдите заново.' });
      return send(200, [
        {
          id: 'sess-this',
          issuedAt: new Date(Date.now() - 3600_000).toISOString(),
          expiresAt: new Date(Date.now() + 29 * 24 * 3600_000).toISOString(),
          device: 'Chrome, macOS',
          current: true,
        },
        {
          id: 'sess-phone',
          issuedAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
          expiresAt: new Date(Date.now() + 27 * 24 * 3600_000).toISOString(),
          device: 'Safari, iPhone',
          current: false,
        },
      ]);
    }
    if (path === '/auth/logout-all' && req.method === 'POST') {
      uiSessions.clear();
      return noContent();
    }
    // Вход по коду на почту снят 20.09.2026 (ADR-053): /auth/code и /auth/verify стенду не нужны.
    // Реальный API отвечает 404, а не общий 501 для неподдерживаемых операций демо.
    if (path === '/auth/code' || path === '/auth/verify')
      return send(404, { message: 'Not Found' });
    // Регистрация по паролю (ADR-053, ADR-060): почта, имя, пароль, письмо, подтверждение почты.
    if (path === '/auth/options' && req.method === 'GET') return send(200, { registrationEnabled });
    if (path === '/hotel/onboarding' && req.method === 'POST') {
      const cats = Array.isArray(body['categories']) ? (body['categories'] as unknown[]) : [];
      if (cats.length === 0)
        return send(400, { message: 'Добавьте хотя бы одну категорию номеров' });
      let units = 0;
      for (const c of cats) units += Number((c as { units?: unknown }).units ?? 0);
      // Отель настроен — гейт больше не уводит на онбординг
      onboardingNeeded = false;
      return send(200, { ok: true, categories: cats.length, units });
    }
    if (path === '/auth/register' && req.method === 'POST') {
      if (!registrationEnabled)
        return send(403, {
          message:
            'Самостоятельная регистрация закрыта. Попросите владельца объекта прислать приглашение.',
        });
      const email = String(body['email'] ?? '').trim();
      const name = String(body['name'] ?? '').trim();
      const hotelName = String(body['hotelName'] ?? '').trim();
      const password = String(body['password'] ?? '');
      if (!email.includes('@'))
        return send(400, { message: 'Укажите почту — ею же вы будете входить.' });
      if (!name) return send(400, { message: 'Укажите имя, до 200 знаков.' });
      if (!hotelName) return send(400, { message: 'Укажите название организации, до 200 знаков.' });
      if (password.trim().length < 10)
        return send(400, { message: 'Пароль не годится: пароль короче 10 символов' });
      if (email.toLowerCase() === uiUser.email)
        return send(400, {
          message:
            'Этот адрес уже зарегистрирован. Войдите по паролю или восстановите его на экране входа.',
        });
      // Сессии здесь нет: она появится после перехода по ссылке из письма (ADR-060)
      const link = `ui-verify-${uiVerifications.size + 1}`;
      uiVerifications.set(link, { email: email.toLowerCase(), name, used: false });
      return send(200, { pendingVerification: true, email: email.toLowerCase(), name, sent: true });
    }
    if (path === '/auth/email/resend' && req.method === 'POST') {
      // наружу ответ один и тот же, есть такая почта или нет
      return send(200, { ok: true });
    }
    if (path === '/auth/email/verify' && req.method === 'POST') {
      const link = uiVerifications.get(String(body['token'] ?? ''));
      if (!link) return send(401, { message: 'Ссылка не годится: запросите письмо заново.' });
      link.used = true;
      const token = `ui-registered-${uiSessions.size + 1}`;
      const who = { ...uiUser, email: link.email, name: link.name };
      uiSessions.set(token, who);
      return send(200, {
        token,
        expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
        user: who,
      });
    }
    if (path === '/auth/password-reset/request' && req.method === 'POST') {
      // наружу ответ один и тот же, есть такая почта или нет
      return send(200, { ok: true });
    }
    if (path === '/auth/password-reset/confirm' && req.method === 'POST') {
      const token = String(body['token'] ?? '');
      const password = String(body['password'] ?? '');
      const link = uiResetTokens.get(token);
      if (!link) return send(401, { message: 'Ссылка не годится: запросите новую' });
      if (link.used) return send(401, { message: 'Ссылка уже использована: запросите новую' });
      if (link.expired) return send(401, { message: 'Срок ссылки истёк: запросите новую' });
      if (password.trim().length < 10)
        return send(400, { message: 'Пароль не годится: пароль короче 10 символов' });
      link.used = true;
      uiPassword = password;
      uiSessions.clear();
      return send(200, { ok: true });
    }
    if (path === '/auth/login' && req.method === 'POST') {
      if (body['email'] !== uiUser.email || body['password'] !== uiPassword)
        return send(401, { message: 'Неверная почта или пароль' });
      const token = `ui-session-${uiSessions.size + 1}`;
      uiSessions.set(token, uiUser);
      return send(200, {
        token,
        expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
        user: uiUser,
      });
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      const token = sessionOf(req as never);
      if (token) uiSessions.delete(token);
      return send(200, { ok: true });
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
      if (command === 'housekeeping') {
        // как настоящий API: по циклу «требует уборки → убрано → проверено», перепрыгнуть нельзя (409 словами)
        const to = body['status'] as UnitCard['housekeepingStatus'];
        const refusal = housekeepingRefusal(housekeepingOf(code!), to);
        if (refusal) return send(409, { message: refusal });
        housekeeping.set(code!, to);
      } else if (command === 'blocks' && req.method === 'DELETE')
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
      const changes = body['changes'] as Array<{ accommodationTypeCode?: string }>;
      // как настоящий API: категория без сопоставления с Channex в очередь каналов не идёт
      return send(200, {
        applied: changes.length,
        rateRows: 1,
        restrictionRows: 0,
        queued: ratesUnmapped ? 0 : (body['changes'] as unknown[]).length,
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
    if (path.startsWith('/channels/channex/events/') && path.endsWith('/retry')) {
      const id = decodeURIComponent(path.split('/')[4]!);
      const event = showcaseEvents.find((e) => e.externalEventId === id);
      if (!event) return send(404, { message: 'Событие не найдено' });
      return send(200, {
        result: event.status === 'FAILED' ? 'failed' : 'skipped_duplicate',
        confirmationNumber: event.confirmationNumber ?? null,
        ...(event.status === 'FAILED' ? { error: event.lastError } : {}),
      });
    }
    if (path === '/channels/channex/outbox/flush') return send(200, { sent: [], errors: [] });
    if (path === '/channels/channex/sync')
      return send(200, { from: today, to: add(today, 499), tasks: ['ui-task'] });
    if (path === '/channels/channex/setup')
      return send(200, { created: { property: false, roomTypes: 0, ratePlans: 0 } });
    if (path === '/guard/tick') return send(200, { observed: [], resolved: 0 });
    const guardAction = /^\/guard\/incidents\/([^/]+)\/(acknowledge|resolve)$/.exec(path);
    if (guardAction && guardAction[1] !== 'ui-incident') {
      const target = extraIncidents.find((i) => i.id === guardAction[1]);
      if (!target) return send(404, { message: 'Неисправность не найдена' });
      if (guardAction[2] === 'acknowledge') {
        target.status = 'ACKNOWLEDGED';
        target.acknowledgedAt = new Date().toISOString();
      } else {
        target.status = 'RESOLVED';
        target.resolvedBy = 'STAFF';
        target.resolvedAt = new Date().toISOString();
      }
      return send(200, target);
    }
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
    if (path.startsWith('/guests/') && path.split('/')[3] === 'documents') {
      const [, , rawId, , docId] = path.split('/');
      const id = decodeURIComponent(rawId!);
      const g = id === guest.id ? guest : extraGuests.get(id);
      if (!g) return send(404, { message: 'Гость не найден' });
      if (req.method === 'DELETE') {
        g.documents = g.documents.filter((d) => d.id !== docId);
        return send(200, getGuest(id));
      }
      const number = String(body['number'] ?? '');
      g.documents = [
        ...g.documents,
        {
          id: `ui-doc-${g.documents.length + 1}`,
          type: String(body['type'] ?? 'PASSPORT'),
          numberMasked: `****${number.slice(-4)}`,
          issueCountry: body['issueCountry'] ? String(body['issueCountry']) : null,
          issuedAt: body['issuedAt'] ? String(body['issuedAt']) : null,
          expiresAt: body['expiresAt'] ? String(body['expiresAt']) : null,
        },
      ];
      return send(201, getGuest(id));
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
      if (path.split('/')[3] === 'cancel') {
        for (const it of r.items)
          if (LIVE(it.status)) {
            it.status = 'CANCELLED';
            it.unitCode = null;
          }
        r.status = 'CANCELLED';
        return send(200, r);
      }
      if (item && action === 'no-show') {
        item.status = 'NO_SHOW';
        item.unitCode = null;
        if (r.items.every((it) => !LIVE(it.status))) r.status = 'NO_SHOW';
        return send(200, r);
      }
      if (item && action === 'check-out') {
        const folio = finance(r).folios.find((f) => f.reservationItemId === item.id);
        const balance = folio ? BigInt(folio.balanceMinor) : 0n;
        if (balance > 0n && body['withDebt'] !== true)
          return send(409, {
            message: `На счёте долг ${tenge(balance)}: примите оплату или выселите с подтверждением`,
          });
        item.status = 'CHECKED_OUT';
        // Q-155 (ADR-068): как настоящий API — выезд переводит ячейку в «требует уборки»
        if (item.unitCode) housekeeping.set(item.unitCode, 'DIRTY');
        if (r.items.every((it) => !LIVE(it.status))) r.status = 'CHECKED_OUT';
        return send(200, r);
      }
      if (item && action === 'extend') {
        const n = Math.max(1, Number(body['nights'] ?? 1));
        if (!item.ratePlanCode && !body['ratePlanCode'])
          return send(400, { message: 'У проживания нет тарифа: выберите тариф для новой ночи' });
        const departure = add(item.departureDate, n);
        if (item.unitCode && unitBusy(item.unitCode, item.departureDate, departure, item))
          return send(409, { message: `Ячейка ${item.unitCode} занята: сначала переселите` });
        item.priceMinor = (
          BigInt(item.priceMinor) +
          nightly(item.accommodationTypeCode) * BigInt(n)
        ).toString();
        item.departureDate = departure;
        if (departure > r.departureDate) r.departureDate = departure;
        retotal(r);
        return send(200, r);
      }
      if (item && action === 'assign') {
        const unit = units.find((u) => u.code === body['unitCode']);
        if (!unit) return send(404, { message: 'Ячейка не найдена' });
        if (unitBusy(unit.code, item.arrivalDate, item.departureDate, item))
          return send(409, { message: `Ячейка ${unit.code} уже занята` });
        if (unit.accommodationTypeCode !== item.accommodationTypeCode) {
          item.accommodationTypeCode = unit.accommodationTypeCode;
          item.accommodationTypeName = unit.accommodationTypeName;
          item.priceMinor = (
            nightly(unit.accommodationTypeCode) * BigInt(nightsOf(item))
          ).toString();
        }
        item.unitCode = unit.code;
        retotal(r);
        return send(200, r);
      }
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
