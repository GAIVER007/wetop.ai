/** Isolated, synthetic API for browser checks. Never connects to a database or provider. */
import { agentFixture, resetAgentFixture } from './fixture-agents';
import { createServer } from 'node:http';
import {
  parseMoney,
  assertAllocationsMatch,
  buildDashboard,
  DASHBOARD_FUNDS,
  previousPeriod,
  type DashboardFund,
  type DashboardPeriod,
  housekeepingRefusal,
  DEFAULT_SELLER_PROFILE,
  buildSellerFacts,
  parseSellerProfile,
  sellerCategoryPrices,
  sellerFactsHash,
  type SellerFactsSource,
  extensionAccess,
  extensionDaysLeft,
  identityRole,
  parseExtensionChange,
  INVITE_STAFF_ONLY_MESSAGE,
  INVITE_MANAGER_OWNER_ONLY_MESSAGE,
  INVITE_ROLE_MESSAGE,
  MEMBER_MANAGER_REMOVES_STAFF_MESSAGE,
  MEMBER_NOT_FOUND_MESSAGE,
  MEMBER_OWNER_MESSAGE,
  MEMBER_ROLE_MESSAGE,
  MEMBER_ROLE_OWNER_ONLY_MESSAGE,
  MEMBER_SELF_MESSAGE,
  RATE_PLAN_CHANGE_MESSAGE,
  RATE_PLAN_SOFT_MESSAGE,
  accessDeniedMessage,
  can,
  canInvite,
  canManageStaff,
  canRemoveMember,
  canSetRoleAtDesk,
  mayAssignPlanWithoutRates,
  parseInviteRole,
  parseHotelSettingsPatch,
  parseServiceInput,
  type ExtensionStatus,
  type InviteRole,
  type MembershipRole,
  countGuestNights,
  summarizeGuestStays,
  parseCancellationPenalty,
} from '@pms/domain';
import type { DataConnection } from '@pms/shared';
import { financeState } from '../../apps/web/src/app/reservations/finance-state';
import { assistant } from '@pms/integrations';
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
const categorySeed: {
  code: string;
  name: string;
  count: number;
  prefix: string;
  capacityAdults: number;
  /** У созданных через POST: тип из формы и привязанные тарифы по именам (ТЗ «Категории v2», ADR-109, ADR-119) */
  kind?: string;
  rateNames?: string[];
  /** Что использует категорию (C4): у засеянных — брони и Channex, у созданных через POST — ничего */
  usage?: { reservations: number; upcomingReservations: number; channexMapped: boolean };
}[] = [
  {
    code: 'ROOM',
    name: 'Двухместный номер',
    count: 16,
    prefix: 'R',
    capacityAdults: 2,
    usage: { reservations: 123, upcomingReservations: 5, channexMapped: true },
  },
  {
    code: 'MALE',
    name: 'Мужской общий номер',
    count: 36,
    prefix: 'M',
    capacityAdults: 1,
    usage: { reservations: 312, upcomingReservations: 14, channexMapped: true },
  },
  {
    code: 'FEMALE',
    name: 'Женский общий номер',
    count: 36,
    prefix: 'F',
    capacityAdults: 1,
    usage: { reservations: 287, upcomingReservations: 11, channexMapped: true },
  },
];
const categories = structuredClone(categorySeed);
/** Структура места; живое состояние (уборка, блокировка) подставляется на каждый запрос */
type SeedUnit = Omit<InventoryUnit, 'housekeepingStatus' | 'active' | 'block'>;
const units: SeedUnit[] = categories.flatMap((c) =>
  Array.from({ length: c.count }, (_, i) => ({
    code: `${c.prefix}${String(i + 1).padStart(2, '0')}`,
    kind: c.code === 'ROOM' ? 'ROOM' : 'BED',
    accommodationTypeCode: c.code,
    accommodationTypeName: c.name,
    roomNumber: `${c.prefix}${Math.floor(i / 6) + 1}`,
    roomCapacity: c.code === 'ROOM' ? 2 : 6,
    isDorm: c.code !== 'ROOM',
    buildingName: 'Основной',
    floorName: `${Math.floor(i / 24) + 1}`,
  })),
);
const plans = [
  {
    code: 'BASE',
    name: 'Стандартный',
    currency: 'KZT',
    active: true,
    cancellationPenalty: 'FIRST_NIGHT' as const,
  },
];
/** Тариф без штрафа за отмену — `POST /__test/control { softPlan: true }`, сбрасывается `reset` (Q-201) */
const softPlanSeed = {
  code: 'FLEX',
  name: 'Гибкий без штрафа',
  currency: 'KZT',
  active: true,
  cancellationPenalty: 'NONE' as const,
};
let softPlan = false;
/** Тарифы, названные в «Категориях» (ADR-119): живут до `reset` */
const extraPlans: {
  code: string;
  name: string;
  currency: string;
  active: boolean;
  cancellationPenalty: 'FIRST_NIGHT' | 'NONE';
}[] = [];
const ratePlanList = () => [...plans, ...(softPlan ? [softPlanSeed] : []), ...extraPlans];
/** Правило отмены, изменённое на «Тарифных планах» (SET4): живёт до `reset` */
const planPenalty = new Map<string, 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY'>();
/** Строки «Тарифных планов» как у API: категории по названию и брони, которые задевает правка правила */
function ratePlanRows() {
  const cards = [card, ...extraCards.values()];
  return ratePlanList().map((p) => ({
    code: p.code,
    name: p.name,
    currency: p.currency,
    active: p.active,
    cancellationPenalty: planPenalty.get(p.code) ?? p.cancellationPenalty,
    categories: categories
      .filter((c) => (c.rateNames ?? [plans[0]!.name]).includes(p.name))
      .map((c) => c.name),
    upcomingReservations: cards.filter((r) =>
      r.items.some(
        (i) =>
          i.ratePlanCode === p.code &&
          (i.status === 'TENTATIVE' || i.status === 'CONFIRMED') &&
          i.departureDate >= today,
      ),
    ).length,
  }));
}
/** Выбор тарифа из тела запроса: undefined — не выбран, null — такого кода нет; новый тариф заводится */
function fixturePlanChoice(body: Record<string, unknown>) {
  if (body.ratePlanCode) return ratePlanList().find((p) => p.code === body.ratePlanCode) ?? null;
  if (typeof body.newRatePlanName === 'string' && body.newRatePlanName.trim()) {
    const plan = {
      code: `rate-${extraPlans.length + 1}`,
      name: body.newRatePlanName.trim(),
      currency: 'KZT',
      active: true,
      // как умолчание схемы у RatePlan
      cancellationPenalty: 'FIRST_NIGHT' as const,
    };
    extraPlans.push(plan);
    return plan;
  }
  return undefined;
}
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
      source: 'PHONE',
      channel: null,
      currency: 'KZT',
      chargedMinor: null,
      paidMinor: null,
      refundedMinor: null,
      balanceMinor: null,
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
/** Порядок появления карточек — «новые брони» (R2): у карточек подставного API нет момента создания */
const cardSeen = new Map<string, number>();
function initializeRecords() {
  extraCards.clear();
  cardSeen.clear();
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
    // i = 2 — перенесённая из внешней системы бронь канала: `TENTATIVE`, то есть «не подтверждена» (Q-135).
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
  // оплачено полностью (ТЗ «Шахматка v2» §22): 800 000 тиын — ровно предоплата finance(), остаток 0
  {
    n: 'DSG-PAID',
    label: 'Гость Оплаченный',
    status: 'CONFIRMED',
    source: 'OTA',
    channel: 'Agoda',
    unit: 'R05',
    from: 1,
    to: 3,
    price: '800000',
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
  // Финансы отменённой брони (ТЗ «Брони v2» §16, ADR-106): четыре состояния колонки «Финансы» —
  // «к возврату» (платёж остался после сторно), «возвращено», «оплачено» (начисление осталось и
  // оплачено полностью — почему именно, список не знает; DSG-CANC выше остаётся пустым счётом «—»).
  // Деньги задаёт finance().
  {
    n: 'DSG-RFND',
    label: 'Гость К-Возврату',
    status: 'CANCELLED',
    source: 'OTA',
    channel: 'Trip.com',
    unit: 'R10',
    from: 0,
    to: 2,
    price: '1600000',
  },
  {
    n: 'DSG-RETD',
    label: 'Гость Возвращено',
    status: 'CANCELLED',
    source: 'WEBSITE',
    channel: null,
    unit: 'R11',
    from: 0,
    to: 2,
    price: '1600000',
  },
  {
    n: 'DSG-CPAID',
    label: 'Гость Оплачено',
    status: 'CANCELLED',
    source: 'OTA',
    channel: 'Ostrovok',
    unit: 'R12',
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
  // блокировки с причиной и три статуса уборки; «по» не включается, как у API (с 28.09.2026)
  blocks.set('R09', [
    {
      id: 'dsg-block-1',
      dateFrom: today,
      dateTo: add(today, 4),
      type: 'MAINTENANCE',
      reason: 'ремонт: кондиционер',
    },
  ]);
  blocks.set('M06', [
    {
      id: 'dsg-block-2',
      dateFrom: add(today, -1),
      dateTo: add(today, 2),
      type: 'OUT_OF_ORDER',
      reason: 'нет матраса',
    },
  ]);
  blocks.set('F03', [
    {
      id: 'dsg-block-3',
      dateFrom: add(today, 1),
      dateTo: add(today, 6),
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
 * История для «Аналитики» (ADR-114, срез AN1): вымышленные проживания (ADR-010) с начала позапрошлого
 * месяца до конца текущего, чтобы у «Обзора» была база сравнения. Номера в этом месяце загружены плотнее,
 * чем в прошлом, койки — слабее: на одном экране видны и рост, и падение. Детерминированно; только по флагу
 * `analyticsHistory` — по умолчанию стенд прежний.
 */
let analyticsHistory = false;
function seedAnalyticsHistory() {
  analyticsHistory = true;
  const monthStart = (shift: number) => {
    const [y, m] = today.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(y, m - 1 + shift, 1)).toISOString().slice(0, 10);
  };
  const start = monthStart(-2);
  const end = monthStart(1);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  // ячейки броней стенда около сегодняшнего дня — история на них кончается раньше
  const busy = new Set(['R01', 'R02', 'R03', 'R04', 'R05', 'M01', 'M02', 'F01', 'F03']);
  const sources: Array<[string, string | null]> = [
    ['OTA', 'Booking.com'],
    ['DESK', null],
    ['OTA', 'Booking.com'],
    ['WEBSITE', null],
    ['OTA', 'Agoda'],
    ['WHATSAPP', null],
    ['PHONE', null],
  ];
  const labels = ['Гость Учебный', 'Клиент Пример', 'Посетитель Демо'];
  let n = 0;
  for (const u of units) {
    const room = u.kind === 'ROOM';
    let d = add(start, Math.floor(rnd() * 3));
    while (d < end) {
      const shift = d < monthStart(-1) ? 0 : d < monthStart(0) ? 1 : 2;
      const fill = room ? [0.5, 0.6, 0.8][shift]! : [0.75, 0.7, 0.55][shift]!;
      const nights = 1 + Math.floor(rnd() * 4);
      const dep = add(d, nights);
      const roll = rnd();
      const free = busy.has(u.code) && dep > add(today, -3);
      const stay = roll < fill && !free;
      const lost = !stay && !free && roll > 0.93;
      if (stay || lost) {
        n += 1;
        const r = cardSeed();
        const [source, channel] = sources[n % sources.length]!;
        const status = stay
          ? dep <= today
            ? 'CHECKED_OUT'
            : d <= today
              ? 'CHECKED_IN'
              : 'CONFIRMED'
          : d < today && n % 4 === 0
            ? 'NO_SHOW'
            : 'CANCELLED';
        const price = (room ? 800000n : 400000n) * BigInt(nights);
        r.confirmationNumber = `20260900-HIST${String(n).padStart(4, '0')}`;
        r.source = source;
        r.channel = channel;
        r.status = status;
        r.arrivalDate = d;
        r.departureDate = dep;
        r.totalAmountMinor = price.toString();
        r.notes = null;
        r.primaryGuest = { id: 'ui-guest', label: labels[n % 3]!, citizenship: 'KAZ', phone: null };
        const item = r.items[0]!;
        item.id = `hist-item-${n}`;
        item.accommodationTypeCode = u.accommodationTypeCode;
        item.accommodationTypeName = u.accommodationTypeName;
        item.arrivalDate = d;
        item.departureDate = dep;
        item.status = status;
        item.priceMinor = price.toString();
        item.unitCode = stay ? u.code : null;
        item.guests = [{ label: labels[n % 3]!, isPrimary: true }];
        extraCards.set(r.confirmationNumber, r);
      }
      d = dep;
    }
  }
}
/**
 * Стенд без единой брони, но с фондом, категориями и ценами — это состояние боевой базы после
 * очистки 19.09.2026 (ADR-052) и до первой живой смены. Экраны обязаны в нём открываться и
 * говорить, что броней нет, а не выглядеть сломанными.
 */
let noBookings = false;
/** Правки «Общих» настроек владельцем (ТЗ ux-retention п. 3.1) поверх сведений стенда */
let hotelOverrides: Record<string, string | null> = {};
/**
 * Каталог услуг «Настроек объекта» (SET3): как `GET /hotel/services` — весь, с архивными. Выбор услуги в счёте
 * (`/finance/services`) видит только активные и в том же порядке — «Стирка» первой, как было до каталога.
 */
type FixtureService = { code: string; name: string; group: string | null; priceMinor: string; active: boolean };
const serviceSeed: FixtureService[] = [
  { code: 'LAUNDRY', name: 'Стирка', group: null, priceMinor: '150000', active: true },
  { code: 'WATER', name: 'Вода 0,5', group: 'Минибар', priceMinor: '70000', active: true },
  { code: 'BAIKAL', name: 'Байкал в стекле', group: 'Минибар', priceMinor: '70000', active: true },
  { code: 'TRANSFER-OLD', name: 'Трансфер (старая цена)', group: 'Трансфер', priceMinor: '600000', active: false },
];
let serviceCatalog: FixtureService[] = structuredClone(serviceSeed);
const catalogOrder = (a: FixtureService, b: FixtureService) =>
  Number(b.active) - Number(a.active) ||
  (a.group === null ? 1 : 0) - (b.group === null ? 1 : 0) ||
  (a.group ?? '').localeCompare(b.group ?? '', 'ru') ||
  a.name.localeCompare(b.name, 'ru');
/** Бронь создана на стенде после «пустой базы» — для «Первых шагов» (ТЗ ux-retention п. 2.1) */
let createdReservation = false;
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
      .flatMap((r) => {
        // счёт проживания — тот же, что показывает карточка брони; у отменённых и незаездов
        // фикстура счёта не строит (как в предпросмотре): их суммы — null
        const folios = finance(r).folios;
        return r.items.map((it) => {
          const folio =
            it.status === 'CANCELLED' || it.status === 'NO_SHOW'
              ? undefined
              : folios.find((f) => f.reservationItemId === it.id);
          return {
            confirmationNumber: r.confirmationNumber,
            accommodationTypeName: it.accommodationTypeName,
            arrivalDate: it.arrivalDate,
            departureDate: it.departureDate,
            status: it.status,
            unitCode: it.unitCode,
            source: r.source,
            channel: r.channel ?? null,
            currency: r.currency,
            chargedMinor: folio?.chargedMinor ?? null,
            paidMinor: folio?.paidMinor ?? null,
            refundedMinor: folio?.refundedMinor ?? null,
            balanceMinor: folio?.balanceMinor ?? null,
          };
        });
      }),
  };
}
let rejectCreate = false;
/** ADR-072: режим хранения данных гостей; по умолчанию — как в базе в Казахстане, чтобы прежние экраны не менялись */
let piiStorage: 'real' | 'pseudonymized' = 'real';
let failPath = '';
/** Поля поверх ответов каналов (снимки состояний модуля «Каналы продаж», ADR-112) */
let channelsOverrides: {
  connection?: Record<string, unknown>;
  webhook?: Record<string, unknown>;
  outbox?: Record<string, unknown>;
} = {};
/** Задержка ответа по одному пути: проверка состояния загрузки (B5); 0 — без задержки */
let delayPath = '';
let delayMs = 0;
/** Код ответа для failPath: 503 (сбой) по умолчанию, 400/404 — отклонённый запрос */
let failStatus = 503;
/**
 * Состояние Channex для «Интеграций» (INT1, ADR-116): '' — прежний ответ; 'ok' — объект доступен, webhook включён и
 * отвечает, обмен минуты назад; 'attention' — webhook не отвечает, ошибки отправки, обмен два часа назад;
 * 'foreign' — интеграция установки у другой организации (403, ADR-095); 'no-key' — ключ не задан.
 * INT2 (ADR-121): 'stale' — очередь в каналы стоит 40 мин, обмен три часа назад, webhook в порядке; 'webhook' — адрес
 * webhook не отвечает, остальное в порядке. Во всех режимах с подключением все три категории сопоставлены
 */
type ChannexMode = '' | 'ok' | 'attention' | 'stale' | 'webhook' | 'foreign' | 'no-key';
const CHANNEX_MODES: ChannexMode[] = ['ok', 'attention', 'stale', 'webhook', 'foreign', 'no-key'];
let channexMode: ChannexMode = '';
/** Режимы, где Channex подключён и отвечает: у них webhook включён и категории сопоставлены */
const channexLive = () =>
  channexMode === 'ok' ||
  channexMode === 'attention' ||
  channexMode === 'stale' ||
  channexMode === 'webhook';
const CHANNEX_FOREIGN = new Set([
  '/channels/channex/connection',
  '/channels/channex/webhook/status',
  '/channels/channex/outbox',
  '/channels/channex/mapping',
]);
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
/**
 * Сопоставления Channex для вкладки «Сопоставление» (ADR-112): по умолчанию их нет, как у стенда без
 * `setup`; 'partial' — объект создан, две категории из трёх сопоставлены с тарифом BASE, третья нет.
 */
let channelMapping: 'none' | 'partial' = 'none';
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
      // как настоящий API: «по» не включается — ночь dateTo свободна (build.ts, units.service.ts)
      const block = blocksFor(u.code).find((b) => b.dateFrom <= date && date < b.dateTo);
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
            // выехавшие занимают прошлые ночи, как в API; стенд по умолчанию их не рисует (прежние снимки)
            !['CANCELLED', 'NO_SHOW', ...(analyticsHistory ? [] : ['CHECKED_OUT'])].includes(
              it.status,
            ) &&
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
function dashboardPeriod(from: string, to: string, fund: DashboardFund = 'all'): DashboardPeriod {
  const b = board(from, to);
  const active = (status: string) => !['CANCELLED', 'NO_SHOW'].includes(status);
  const unassignedByCategory: Record<string, number> = {};
  for (const u of b.unassigned)
    unassignedByCategory[u.categoryCode] = (unassignedByCategory[u.categoryCode] ?? 0) + 1;
  return buildDashboard(
    {
      from,
      to,
      // тип категории — по её единицам, как в API (Аналитика v2, тип фонда)
      categories: categories.map((c) => ({
        code: c.code,
        name: c.name,
        units: c.count,
        kind: units.find((u) => u.accommodationTypeCode === c.code)?.kind ?? 'ROOM',
      })),
      days: b.dates.map((date) => ({
        date,
        ...(b.summary[date] ?? { occupied: 0, free: 0, blocked: 0 }),
        byCategory: b.byCategory[date] ?? {},
      })),
      unassignedByCategory,
      stays: allCards().flatMap((r) =>
        r.items.map((it) => ({
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
          // Q-209: бронь — это Reservation (номер брони стенда), статус — её собственный
          reservationId: r.confirmationNumber,
          reservationStatus: r.status,
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
            serviceDate: it.arrivalDate,
          })),
      ),
      payments:
        from <= today && today <= to
          ? paymentLines.map((p) => ({ method: p.method, amountMinor: BigInt(p.amountMinor) }))
          : [],
      refundsMinor: 0n,
    },
    fund,
  );
}
function dashboard(from: string, to: string, fund: DashboardFund = 'all') {
  const prev = previousPeriod(from, to);
  return {
    current: dashboardPeriod(from, to, fund),
    previous: dashboardPeriod(prev.from, prev.to, fund),
  };
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
  ) || blocksFor(code).some((b) => b.dateFrom < to && b.dateTo > from);
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
    // Витрина финансов отмены (только design-seed): CANC — счёт пуст, RFND — платёж остался,
    // RETD — возвращён, CPAID — начисление осталось и оплачено; остальные карточки — как раньше
    const showcase =
      /DSG-(CANC|RFND|RETD|CPAID)$/.exec(reservation.confirmationNumber)?.[1] ?? null;
    const voided = showcase !== null && showcase !== 'CPAID';
    const prepaid =
      showcase === 'CANC'
        ? 0n
        : showcase
          ? BigInt(it.priceMinor)
          : reservation.confirmationNumber.includes('-NEW')
            ? 0n
            : /TEST[1357]$/.test(reservation.confirmationNumber)
              ? BigInt(it.priceMinor)
              : 800000n;
    const refunded = showcase === 'RETD' ? BigInt(it.priceMinor) : 0n;
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
          voidedAt: voided ? `${today}T09:00:00Z` : null,
        },
      ],
      payments,
      refunds: refunded
        ? [
            {
              id: `refund-${id}`,
              paymentId: `prepaid-${id}`,
              amountMinor: refunded.toString(),
              reason: 'Отмена брони',
              createdAt: `${today}T09:30:00Z`,
            },
          ]
        : [],
      chargedMinor: (voided ? 0n : amount).toString(),
      paidMinor: (prepaid + (paid.get(id) ?? 0n)).toString(),
      refundedMinor: refunded.toString(),
      balanceMinor: ((voided ? 0n : amount) - prepaid - (paid.get(id) ?? 0n) + refunded).toString(),
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
/** Последнее событие счётчика — `POST /__test/control { siteLastEventAt }`: состояние «Работает» на обзоре сайта */
let siteLastEventAt: string | null = null;
/**
 * Адрес демо виджета. По умолчанию относительный — стойка пишет «Демо виджета не подключено»; настоящий, как у API
 * на сервере, — `POST /__test/control { bookingDemoUrl }` (WEB3), сбрасывается `reset`
 */
let siteBookingDemoUrl = '/demo-booking';
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
    // WEB4: воронка по сессиям и брони с сайта (Q-212) — числа учебные, сверяются в tests/ui/website.spec.ts
    funnel: { visits: 125, searches: 40, started: 18, booked: 12, conversion: 0.096 },
    siteReservations: {
      count: 14,
      cancelled: 1,
      noShow: 1,
      charged: [{ currency: 'KZT', chargedMinor: '142000000' }],
    },
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
// ── Роли, главный администратор и расширение «ИИ-продавец» (ADR-083) — как отвечает API. Меняются через
// `POST /__test/control { role, platformAdmin, sellerExtension, sellerDaysLeft, sellerTrial }`, сбрасываются `reset`.
let uiRole: MembershipRole = 'OWNER';
/**
 * Тариф брони у роли стенда — как в API: администратор пересчитывает только в тарифе брони (Q-200); брони без тарифа
 * (из внешней системы) назначает тариф со штрафом не мягче «первых суток» (Q-201). `null` — можно.
 */
function planRefusal(current: string | null | undefined, requested: unknown): string | null {
  if (can(uiRole, 'rates') || typeof requested !== 'string' || !requested) return null;
  if (current) return requested !== current ? RATE_PLAN_CHANGE_MESSAGE : null;
  const plan = ratePlanList().find((p) => p.code === requested);
  return plan && !mayAssignPlanWithoutRates(plan.cancellationPenalty)
    ? RATE_PLAN_SOFT_MESSAGE
    : null;
}
/** Бронь без тарифа получает выбранный тариф — как в API: дальше пересчёт в нём (Q-201) */
function recordPlan(
  item: { ratePlanCode?: string | null; ratePlanName?: string | null },
  requested: unknown,
) {
  const plan = ratePlanList().find((p) => p.code === requested);
  if (plan && (!item.ratePlanCode || can(uiRole, 'rates')))
    Object.assign(item, { ratePlanCode: plan.code, ratePlanName: plan.name });
}
let uiPlatformAdmin = false;
/**
 * Люди вымышленной организации и её ожидающие приглашения (ADR-107): вошедшая Дана — с ролью `uiRole`, остальные —
 * как в базе после приглашений. Вымышленные (ADR-010), сбрасываются `reset`.
 */
interface FixtureMember {
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: string;
}
interface FixtureInvite {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  createdAt: string;
}
let uiTeam: FixtureMember[] = [];
let uiInvites: FixtureInvite[] = [];
function resetTeam() {
  uiTeam = [
    {
      userId: 'ui-manager',
      email: 'marat@example.invalid',
      name: 'Марат Тестов',
      role: 'MANAGER',
      joinedAt: '2026-09-02T09:00:00.000Z',
    },
    {
      userId: 'ui-admin',
      email: 'urij@example.com',
      name: 'Юрий Тестов',
      role: 'STAFF',
      joinedAt: '2026-09-03T09:00:00.000Z',
    },
  ];
  uiInvites = [
    {
      id: 'inv-fixture',
      email: 'zhdet@example.com',
      role: 'STAFF',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
    },
    {
      id: 'inv-fixture-manager',
      email: 'boss@example.com',
      role: 'MANAGER',
      expiresAt: new Date(Date.now() + 6 * 24 * 3600_000).toISOString(),
      createdAt: new Date(Date.now() - 7200_000).toISOString(),
    },
  ];
}
resetTeam();
/** Люди организации глазами вошедшего: он сам с ролью `uiRole` и что он может с каждым */
function teamView(me: UiUser) {
  const people: FixtureMember[] = [
    {
      userId: me.id,
      email: me.email,
      name: me.name,
      role: uiRole,
      joinedAt: '2026-09-01T09:00:00.000Z',
    },
    ...uiTeam,
  ];
  const order: MembershipRole[] = ['OWNER', 'MANAGER', 'STAFF'];
  return people
    .sort(
      (a, b) =>
        order.indexOf(a.role) - order.indexOf(b.role) || a.joinedAt.localeCompare(b.joinedAt),
    )
    .map((m) => {
      const you = m.userId === me.id;
      return {
        ...m,
        you,
        removable: !you && canRemoveMember(uiRole, m.role),
        roleEditable:
          !you && canSetRoleAtDesk(uiRole, m.role, m.role === 'STAFF' ? 'MANAGER' : 'STAFF'),
      };
    });
}
interface FixtureExtension {
  status: ExtensionStatus;
  activeUntil: Date | null;
  note: string | null;
  updatedAt: Date;
}
/** Строки `organization_extensions` стенда: у своей гостиницы — «оплачен, бессрочно», как после шага выкладки Э2 */
const platformExtensions = new Map<string, FixtureExtension>();
const DAY_MS = 86_400_000;
function setSellerExtension(state: unknown, days: unknown, trial: boolean) {
  const status: ExtensionStatus = trial ? 'TRIAL' : 'ACTIVE';
  const now = Date.now();
  if (state === 'off') platformExtensions.delete('ui-org');
  else if (state === 'expired')
    platformExtensions.set('ui-org', {
      status,
      activeUntil: new Date(now - DAY_MS),
      note: null,
      updatedAt: new Date(),
    });
  else
    platformExtensions.set('ui-org', {
      status,
      // «осталось N дней»: конец срока чуть раньше N полных суток — неполный день считается днём
      activeUntil:
        typeof days === 'number'
          ? new Date(now + days * DAY_MS - 3_600_000)
          : trial
            ? new Date(now + 7 * DAY_MS)
            : null,
      note: null,
      updatedAt: new Date(),
    });
}
/** Пробный период своей организации (ТЗ ux-retention п. 2.7): число — осталось дней, 'ended' — срок вышел, иначе оплачена */
// Подписка, подтверждённая руками главного администратора (ADR-102): статус поверх начального
const platformStatuses = new Map<string, string>();
function setOrgTrial(days: unknown) {
  const now = Date.now();
  uiUser.organization =
    days === 'ended'
      ? {
          ...uiUser.organization,
          status: 'TRIAL',
          trialEndsAt: new Date(now - DAY_MS).toISOString(),
        }
      : typeof days === 'number'
        ? {
            ...uiUser.organization,
            status: 'TRIAL',
            trialEndsAt: new Date(now + days * DAY_MS - 3_600_000).toISOString(),
          }
        : { ...uiUser.organization, status: 'ACTIVE', trialEndsAt: null };
}
function resetAccess() {
  setOrgTrial(null);
  uiRole = 'OWNER';
  resetTeam();
  uiPlatformAdmin = false;
  platformExtensions.clear();
  platformStatuses.clear();
  setSellerExtension('active', null, false);
}
resetAccess();
const aiSellerView = (organizationId: string) => {
  const row = platformExtensions.get(organizationId) ?? null;
  const now = new Date();
  return {
    access: extensionAccess(row, now),
    status: row?.status ?? null,
    activeUntil: row?.activeUntil?.toISOString() ?? null,
    daysLeft: extensionDaysLeft(row, now),
  };
};
/** Вошедший так, как его отдаёт API после ADR-083: с ролью и отметкой главного администратора */
const signedInView = (who: UiUser) => ({ ...who, role: uiRole, platformAdmin: uiPlatformAdmin });
/** Гостиницы платформы глазами главного администратора — вымышленные (ADR-010) */
const platformOrganizations = () => [
  {
    id: 'ui-org',
    name: uiUser.organization.name,
    status: platformStatuses.get('ui-org') ?? 'ACTIVE',
    trialEndsAt: null,
    createdAt: '2026-09-01T04:00:00.000Z',
    members: uiMembers.size,
    owners: ['admin@wetop.test'],
  },
  {
    id: 'ui-org-2',
    name: 'Хостел «Пример»',
    status: platformStatuses.get('ui-org-2') ?? 'TRIAL',
    trialEndsAt: new Date(Date.now() + 5 * DAY_MS).toISOString(),
    createdAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
    members: 1,
    owners: ['owner@example.com'],
  },
];
// ── «Платформа → Техподдержка» (ADR-083, Э3): подставная панель ИИ-помощника. Кто пишет — вымышленные (ADR-010) ─────
const SUPPORT_DIALOG_A = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SUPPORT_DIALOG_B = '7b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e';
const supportDialogSeed = () => [
  {
    id: SUPPORT_DIALOG_A,
    channel: 'widget',
    clientName: 'd***',
    mode: 'needs_human',
    stage: 'new',
    lastActivityAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    hasContact: false,
    // так API отдаёт подпись стойки из `lead_data.platform_user` вместе с названием организации
    platformUser: {
      userId: 'ui-user-staff',
      email: 'dana@example.invalid',
      organizationId: 'ui-org',
      organizationName: 'Luxx Aparts',
      role: 'staff' as 'owner' | 'staff' | null,
    },
    messages: [
      {
        role: 'user',
        text: 'Не сохраняется бронь: пишет «Нет связи с API».',
        at: new Date(Date.now() - 20 * 60_000).toISOString(),
        sentByUs: false,
      },
      {
        role: 'assistant',
        text: 'Вижу ошибку в журнале. Позову человека.',
        at: new Date(Date.now() - 19 * 60_000).toISOString(),
        sentByUs: true,
      },
    ],
  },
  {
    id: SUPPORT_DIALOG_B,
    channel: 'widget',
    clientName: '—',
    mode: 'bot_active',
    stage: 'new',
    lastActivityAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    hasContact: false,
    platformUser: null,
    messages: [
      {
        role: 'user',
        text: 'Сколько стоит WETOP для хостела?',
        at: new Date(Date.now() - 2 * 3600_000).toISOString(),
        sentByUs: false,
      },
      {
        role: 'assistant',
        text: 'Расскажу о тарифах: оставьте почту — ответит менеджер.',
        at: new Date(Date.now() - 2 * 3600_000).toISOString(),
        sentByUs: true,
      },
    ],
  },
];
let supportDialogs = supportDialogSeed();
const supportKnowledgeSeed = () => [
  { source: 'справочник-ошибок.md', chunks: 5, createdAt: '2026-09-24T06:00:00.000Z' },
];
let supportKnowledge = supportKnowledgeSeed();
/** Подключена ли панель помощника — `POST /__test/control { supportState: 'not-configured' }` */
let supportState: 'ready' | 'not-configured' = 'ready';
/** Правила и модель помощника (ADR-084): песочница отвечает по сохранённым правилам — так видно, что они дошли */
const SUPPORT_PROMPT_SEED = 'Ты — ИИ-помощник WETOP. Отвечай на «вы», коротко и по делу.';
let supportPrompt = SUPPORT_PROMPT_SEED;
const SUPPORT_MODELS = ['модель-а', 'модель-б'];
let supportModel = SUPPORT_MODELS[0]!;
function resetSupport() {
  supportDialogs = supportDialogSeed();
  supportKnowledge = supportKnowledgeSeed();
  supportState = 'ready';
  supportPrompt = SUPPORT_PROMPT_SEED;
  supportModel = SUPPORT_MODELS[0]!;
}

const platformOrganizationJson = (o: ReturnType<typeof platformOrganizations>[number]) => {
  const row = platformExtensions.get(o.id);
  return {
    ...o,
    aiSeller: {
      ...aiSellerView(o.id),
      note: row?.note ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    },
  };
};

/** Секрет подписи помощника на стенде (ТЗ П1): вымышленный, как и всё в фикстуре */
const FIXTURE_IDENTITY_SECRET = 'fixture-identity-secret';

// ── ИИ-продавец (ТЗ П5–П8): подставной продавец стенда. Гости и переписка — вымышленные (ADR-010) ──────
// профиль и факты — теми же функциями домена, что у API (ADR-081): стенд не расходится со схемой бота
const sellerProfileSeed = structuredClone(DEFAULT_SELLER_PROFILE);
/** Факты стенда: двухместный номер — одна цена весь срок, общие — по субботам дороже (цена меняется) */
const sellerFactsSource = (): SellerFactsSource => ({
  property: {
    name: propertyName,
    address: 'Алматы, ул. Тестовая, 1',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  },
  categories: categories.map((c) => ({
    code: c.code,
    name: c.name,
    kind: c.code === 'ROOM' ? 'PRIVATE_ROOM' : 'DORM_BED',
    capacityAdults: c.capacityAdults,
    units: c.count,
  })),
  ratePlan: { code: 'BASE', name: 'Базовый тариф', currency: 'KZT' },
  rates: categories.flatMap((c) =>
    Array.from({ length: 60 }, (_, i) => ({
      categoryCode: c.code,
      date: add(today, i),
      occupancy: c.capacityAdults,
      priceMinor: c.code === 'ROOM' ? 1_500_000n : i % 7 === 5 ? 520_000n : 450_000n,
    })),
  ),
  window: { from: today, to: add(today, 59) },
});
const SELLER_DIALOG_A = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';
const SELLER_DIALOG_B = '8c7d6e5f-4a3b-4c2d-9e1f-0a9b8c7d6e5f';
const sellerDialogSeed = () => [
  {
    id: SELLER_DIALOG_A,
    channel: 'widget',
    clientName: 'А***',
    mode: 'needs_human',
    stage: 'closing',
    lastActivityAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    hasContact: true,
    contact: {
      name: 'Алия Тестова',
      phone: '+7 700 000 00 01',
      email: null,
      channel: 'widget',
      externalId: 'ui-a',
    },
    // как `LeadFields` бота: ядро (имя, телефон, интерес, сроки) и свободная сумка `extra`
    leadData: {
      name: 'Алия Тестова',
      phone: '+7 700 000 00 01',
      interest: 'двухместный номер',
      timeframe: '1–3 октября',
      extra: { guests: 2 },
    },
    messages: [
      {
        role: 'user',
        text: 'Здравствуйте, есть двухместный на 1–3 октября?',
        at: new Date(Date.now() - 25 * 60_000).toISOString(),
        sentByUs: false,
      },
      {
        role: 'assistant',
        text: 'Здравствуйте! Уточню у администратора и вернусь.',
        at: new Date(Date.now() - 24 * 60_000).toISOString(),
        sentByUs: true,
      },
    ],
  },
  {
    id: SELLER_DIALOG_B,
    channel: 'widget',
    clientName: null as string | null,
    mode: 'bot_active',
    stage: 'new',
    lastActivityAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    hasContact: false,
    contact: {
      name: null as string | null,
      phone: null,
      email: null,
      channel: 'widget',
      externalId: 'ui-b',
    },
    leadData: {},
    messages: [
      {
        role: 'user',
        text: 'Во сколько заезд?',
        at: new Date(Date.now() - 3 * 3600_000).toISOString(),
        sentByUs: false,
      },
      {
        role: 'assistant',
        text: 'Заезд с 14:00, выезд до 12:00.',
        at: new Date(Date.now() - 3 * 3600_000).toISOString(),
        sentByUs: true,
      },
    ],
  },
];
let sellerProfile = structuredClone(sellerProfileSeed);
let sellerAppliedProfile = structuredClone(sellerProfileSeed);
let sellerSaved = false;
let sellerApplied = false;
let sellerUpdatedAt: string | null = null;
/** Инструкция продавцу одним текстом (ADR-097): сохранённая и та, что продавец получил последним «Применить» */
let sellerPrompt: string | null = null;
let sellerAppliedPrompt: string | null = null;
let sellerDialogs = sellerDialogSeed();
const sellerKnowledgeSeed = () => [
  { source: 'platform:facts.md', chunks: 2, createdAt: '2026-09-24T06:00:00.000Z' },
  { source: 'правила.md', chunks: 3, createdAt: '2026-09-20T06:00:00.000Z' },
];
let sellerKnowledge = sellerKnowledgeSeed();
// С2: ключ модели партнёра — подставной бот хранит только последние 4 знака
let sellerLlmKey: string | null = null;
// С3: подключение WhatsApp — подставной бот выдаёт слово вебхука, токен не хранится
let sellerWhatsApp: { phoneNumberId: string; verifyToken: string } | null = null;
const sellerWhatsAppView = () => ({
  set: sellerWhatsApp !== null,
  phoneNumberId: sellerWhatsApp?.phoneNumberId ?? null,
  verifyToken: sellerWhatsApp?.verifyToken ?? null,
  webhookUrl: sellerWhatsApp
    ? `https://seller.wetop.example/channels/whatsapp/webhook/ui-org`
    : null,
});
/** Состояние продавца и его последний отказ — `POST /__test/control { sellerState, sellerLastError, sellerRetrying }`.
 * Э4: продавец общий для всех гостиниц, состояния `other-organization` больше нет. */
let sellerState: 'ready' | 'not-configured' = 'ready';
/** Домены сайтов гостиницы для экрана «Код для сайта» (Э4): пусто — экран говорит завести сайт */
let sellerHosts: string[] = ['hotel-a.example.invalid'];
let sellerLastError: string | null = null;
let sellerRetrying = false;
function resetSeller() {
  sellerProfile = structuredClone(sellerProfileSeed);
  sellerAppliedProfile = structuredClone(sellerProfileSeed);
  sellerSaved = false;
  sellerApplied = false;
  sellerLlmKey = null;
  sellerWhatsApp = null;
  sellerUpdatedAt = null;
  sellerPrompt = null;
  sellerAppliedPrompt = null;
  sellerDialogs = sellerDialogSeed();
  sellerKnowledge = sellerKnowledgeSeed();
  sellerState = 'ready';
  sellerHosts = ['hotel-a.example.invalid'];
  sellerLastError = null;
  sellerRetrying = false;
}

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
    if (path === '/rates/plans') return [];
    if (path === '/finance/services') return [];
    if (path === '/hotel/services') return [];
    if (path === '/hotel/channel-report')
      return { from: q.get('from'), to: q.get('to'), status: q.get('status'), rows: [] };
    if (['/guests', '/analytics/sites', '/inventory/units', '/inventory/categories'].includes(path))
      return [];
    if (path === '/guests/directory')
      return {
        total: 0,
        page: 1,
        pageSize: 25,
        counts: { ALL: 0, INHOUSE: 0, EXPECTED: 0, RECENT: 0 },
        rows: [],
      };
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
          unassignedByCategory: {},
          stays: [],
          charges: [],
          payments: [],
          refundsMinor: 0n,
        });
      const prev = previousPeriod(from, to);
      return { current: zero(from, to), previous: zero(prev.from, prev.to) };
    }
    if (path === '/finance/operations')
      return {
        from: q.get('from'),
        to: q.get('to'),
        currency: 'KZT',
        total: 0,
        paidMinor: '0',
        refundedMinor: '0',
        methods: [],
        rows: [],
        truncated: false,
      };
    if (path === '/finance/debts')
      return {
        from: q.get('from'),
        to: q.get('to'),
        currency: 'KZT',
        count: 0,
        balanceMinor: '0',
        overdue: { count: 0, balanceMinor: '0' },
        rows: [],
        truncated: false,
      };
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
        bin: null,
        address: 'Тестовый адрес, 1',
        // контакты объекта для печатных форм (v1.7, ADR-082)
        phone: '+7 700 000 00 00',
        email: 'hostel@example.invalid',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        ...hotelOverrides,
      },
      ratePlans: plans.map((p) => ({ ...p, active: true })),
      needsOnboarding: onboardingNeeded,
    };
  if (path === '/hotel/onboarding')
    return { needed: onboardingNeeded, name: propertyName, currency: 'KZT' };
  if (path === '/hotel/first-steps')
    return { hasReservations: createdReservation || (!noBookings && !emptyFixture) };
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
  if (path === '/inventory/categories')
    return categories.map((c) => ({
      code: c.code,
      name: c.name,
      kind:
        c.kind ??
        (units.some((u) => u.accommodationTypeCode === c.code && u.kind === 'BED')
          ? 'DORM_BED'
          : 'PRIVATE_ROOM'),
      capacityAdults: c.capacityAdults,
      active: true,
      ratePlans: (c.rateNames ?? [plans[0]!.name]).length,
      ratePlanNames: c.rateNames ?? [plans[0]!.name],
      ...(c.usage ?? { reservations: 0, upcomingReservations: 0, channexMapped: false }),
    }));
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
    return units
      .filter((u) => !q.get('category') || q.get('category') === u.accommodationTypeCode)
      .map((u) => {
        // как countActiveBlocks: действует блокировка, у которой dateFrom <= сегодня < dateTo
        const block = blocksFor(u.code).find((b) => b.dateFrom <= today && today < b.dateTo);
        return {
          ...u,
          housekeepingStatus: housekeepingOf(u.code),
          active: true,
          block: block ? { dateTo: block.dateTo, type: block.type, reason: block.reason } : null,
        } satisfies InventoryUnit;
      });
  if (path === '/desk/today') return desk(q.get('date') || today);
  if (path === '/desk/dashboard') {
    const fund = q.get('fund') || 'all';
    // обработчик отвечает на исключение 400, как API на неизвестный тип фонда
    if (!DASHBOARD_FUNDS.includes(fund as DashboardFund))
      throw new Error('fund — all, rooms или beds');
    return dashboard(q.get('from') || today, q.get('to') || today, fund as DashboardFund);
  }
  if (path === '/chessboard') return board(q.get('from') || today, q.get('to') || add(today, 13));
  if (path === '/rate-plans') return ratePlanList();
  // «Свободные места», AV2 (ADR-110): один тариф BASE по синтетическим ценам ночи; койки — на каждого гостя
  if (path === '/availability/offers') {
    const arrival = q.get('arrival') || today,
      departure = q.get('departure') || add(arrival, 1),
      guests = Number(q.get('guests') || '1');
    const nights = BigInt(nightsOf({ arrivalDate: arrival, departureDate: departure }));
    return {
      arrivalDate: arrival,
      departureDate: departure,
      nights: Number(nights),
      guests,
      currency: 'KZT',
      byCategory: Object.fromEntries(
        categories.map((c) => {
          const bed = c.code !== 'ROOM';
          if (!bed && guests > c.capacityAdults) return [c.code, null];
          const night = nightly(c.code);
          return [
            c.code,
            {
              plans: 1,
              totalMinor: (night * nights * BigInt(bed ? guests : 1)).toString(),
              perNightMinor: night.toString(),
              ratePlanCode: 'BASE',
            },
          ];
        }),
      ),
    };
  }
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
        ) && !blocksFor(u.code).some((b) => b.dateFrom < departure && b.dateTo > arrival),
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
    if (action === 'extend') {
      const nights = Number(q.get('nights') ?? 1);
      return {
        action,
        currentPriceMinor: item.priceMinor,
        currency: 'KZT',
        nights,
        departureDate: add(item.departureDate, nights),
        newPriceMinor: (current + night * BigInt(nights)).toString(),
        differenceMinor: (night * BigInt(nights)).toString(),
      };
    }
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
      const refused = changes ? planRefusal(item.ratePlanCode, q.get('ratePlanCode')) : null;
      if (refused)
        return {
          unitCode: unit.code,
          changesCategory: true,
          fromCategory: from && { code: from.code, name: from.name },
          toCategory: { code: to.code, name: to.name },
          nights,
          currentMinor: item.priceMinor,
          newMinor: null,
          ratePlanRequired: false,
          problem: refused,
        };
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
      const refused = planRefusal(item.ratePlanCode, q.get('ratePlanCode'));
      if (refused)
        return {
          nights: n,
          departureDate: departure,
          unitCode: item.unitCode,
          addedMinor: null,
          newMinor: null,
          ratePlanRequired: false,
          nextNightsFree:
            !item.unitCode || !unitBusy(item.unitCode, item.departureDate, departure, item),
          problem: refused,
        };
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
  // Справочник «Гости v2»: гости собираются из карточек броней — «пустая база» остаётся пустой
  if (path === '/guests/directory') {
    const state = q.get('state') || 'ALL';
    const search = (q.get('q') || '').trim().toLocaleLowerCase('ru');
    const page = Math.max(1, Number(q.get('page') || 1));
    const pageSize = Math.max(1, Number(q.get('pageSize') || 25));
    const ids = [
      ...new Set(allCards().flatMap((r) => (r.primaryGuest ? [r.primaryGuest.id] : []))),
    ];
    const all = ids
      .flatMap((id) => {
        const g = getGuest(id);
        return g ? [g] : [];
      })
      .filter(
        (g) =>
          !search ||
          `${g.lastName} ${g.firstName} ${g.phone ?? ''} ${g.email ?? ''}`
            .toLocaleLowerCase('ru')
            .includes(search),
      )
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'ru'),
      )
      .map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        middleName: g.middleName,
        phone: g.phone,
        email: g.email,
        ...summarizeGuestStays(
          g.stays.map((s) => ({
            status: s.status,
            arrivalDate: s.arrivalDate,
            departureDate: s.departureDate,
            unitCode: s.unitCode,
            accommodationTypeName: s.accommodationTypeName,
          })),
          today,
        ),
      }));
    // G7: отборы и порядок — те же правила, что SQL настоящего API (последний визит — выезд
    // последнего состоявшегося визита; визиты — заселён или выехал)
    const last = q.get('last') || '';
    const window: [string, string] | null =
      last === 'today'
        ? [today, today]
        : last === '7d'
          ? [add(today, -7), today]
          : last === '30d'
            ? [add(today, -30), today]
            : last === 'period'
              ? [q.get('from') || '', q.get('to') || '']
              : null;
    const visits = q.get('visits') || '';
    const filtered = all.filter(
      (g) =>
        (!window ||
          (g.last !== null &&
            g.last.departureDate >= window[0] &&
            g.last.departureDate <= window[1])) &&
        (visits === '1'
          ? g.staysCount === 1
          : visits === '2-5'
            ? g.staysCount >= 2 && g.staysCount <= 5
            : visits === '6+'
              ? g.staysCount >= 6
              : true),
    );
    const sort = q.get('sort') || 'name';
    const tail = '9999-12-31';
    if (sort === 'next')
      filtered.sort((a, b) => (a.next?.arrivalDate ?? tail).localeCompare(b.next?.arrivalDate ?? tail));
    else if (sort === 'last')
      filtered.sort((a, b) => (b.last?.departureDate ?? '').localeCompare(a.last?.departureDate ?? ''));
    else if (sort === 'visits') filtered.sort((a, b) => b.staysCount - a.staysCount);
    const counts = { ALL: filtered.length, INHOUSE: 0, EXPECTED: 0, RECENT: 0, NONE: 0 };
    for (const g of filtered) counts[g.state] += 1;
    const rows = state === 'ALL' ? filtered : filtered.filter((g) => g.state === state);
    return {
      total: rows.length,
      page,
      pageSize,
      counts,
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
    };
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
  // Предпросмотр панелью (G3): история и долг из «счетов» карточек — как в настоящем API из Folio
  const previewMatch = /^\/guests\/([^/]+)\/preview$/.exec(path);
  if (previewMatch) {
    const g = getGuest(decodeURIComponent(previewMatch[1]!));
    if (!g) return undefined;
    const cards = allCards().filter((r) => r.primaryGuest?.id === g.id);
    // у отменённых и незаездов счёт в фикстуре не строится: их «долг» — не долг гостя
    const billed = cards.filter((r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW');
    const debt = billed.reduce((sum, r) => sum + BigInt(finance(r).balanceMinor), 0n);
    return {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      middleName: g.middleName,
      phone: g.phone,
      email: g.email,
      ...summarizeGuestStays(g.stays, today),
      nightsTotal: countGuestNights(g.stays),
      hasFolios: billed.length > 0,
      debtMinor: debt.toString(),
      currency: 'KZT',
    };
  }
  if (path.startsWith('/guests/')) return getGuest(decodeURIComponent(path.split('/')[2]!));
  if (path.startsWith('/units/')) {
    const u = units.find((u) => u.code === decodeURIComponent(path.split('/')[2]!));
    if (!u) return undefined;
    return {
      ...u,
      id: u.code,
      buildingName: u.buildingName ?? '',
      floorName: u.floorName ?? '',
      capacity: u.kind === 'BED' ? 1 : u.roomCapacity,
      active: true,
      housekeepingStatus: housekeepingOf(u.code),
      blocks: blocksFor(u.code),
      stays: allCards().flatMap((r) =>
        r.items
          // как PrismaUnitsRepository.card: отменённые и незаезды место не держат
          .filter((it) => it.unitCode === u.code && !['CANCELLED', 'NO_SHOW'].includes(it.status))
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
  if (path === '/rates/plans') return ratePlanRows();
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
          // Витрина: ночь без цены (idx 20) — календарь называет её словами «Нет цены» (ТЗ v2 §21)
          prices: showcase && idx === 20 ? {} : { '1': price(1, '8000'), '2': price(2, '10000') },
          minStay:
            forDay.find((c) => c.minStay !== undefined)?.minStay ??
            (showcase && idx >= 15 && idx <= 17 ? 2 : 1),
          maxStay: showcase && idx === 18 ? 4 : null,
          // Витрина: две закрытые ночи, как на макете «Rates» — слово «закрыто» и подсветка ячейки;
          // с 27.09 (ADR-111) ещё CTA/CTD, «мин. 2» и «до 4 ночей» — для календаря месяца и снимков RT1
          stopSell: stop ?? (showcase && (idx === 5 || idx === 11)),
          closedToArrival: showcase && idx === 8,
          closedToDeparture: showcase && idx === 9,
        };
      }),
    };
  if (path.startsWith('/finance/reservations/')) {
    const r = getCard(decodeURIComponent(path.split('/')[3]!));
    return r ? finance(r) : undefined;
  }
  if (path === '/finance/services')
    return serviceCatalog
      .filter((x) => x.active)
      .map((x) => ({ code: x.code, nameRu: x.name, nameKz: null, priceMinor: x.priceMinor, group: x.group }));
  if (path === '/hotel/services') return [...serviceCatalog].sort(catalogOrder);
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
  if (path === '/finance/operations') {
    // Как у API (ADR-113, F2): оплаты и возвраты из счетов броней, день и время — по часам объекта (UTC+5),
    // новыми первыми; отбор по типу и способу — к строкам и суммам, числа способов — без отбора по способу
    const from = q.get('from') || today;
    const to = q.get('to') || from;
    const type = q.get('type');
    const method = q.get('method');
    const limit = Number(q.get('limit') || 50);
    const local = (iso: string) =>
      new Date(Date.parse(iso) + 5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
    type Op = {
      kind: 'PAYMENT' | 'REFUND';
      id: string;
      at: string;
      localAt: string;
      method: string;
      amountMinor: string;
      status: 'COMPLETED' | 'VOIDED';
      confirmationNumber: string | null;
      reservations: number;
      guestLabel: string | null;
    };
    const ops = new Map<string, Op>();
    for (const r of allCards())
      for (const f of finance(r).folios) {
        const base = {
          confirmationNumber: r.confirmationNumber,
          guestLabel: r.primaryGuest?.label ?? null,
        };
        for (const p of f.payments) {
          const known = ops.get(p.paymentId);
          if (known) {
            if (known.confirmationNumber !== r.confirmationNumber) known.reservations += 1;
            continue;
          }
          ops.set(p.paymentId, {
            kind: 'PAYMENT',
            id: p.paymentId,
            at: p.paidAt,
            localAt: local(p.paidAt),
            method: p.method,
            amountMinor: p.paymentAmountMinor,
            status: p.status,
            reservations: 1,
            ...base,
          });
        }
        for (const x of f.refunds)
          ops.set(x.id, {
            kind: 'REFUND',
            id: x.id,
            at: x.createdAt,
            localAt: local(x.createdAt),
            method: f.payments.find((p) => p.paymentId === x.paymentId)?.method ?? 'CASH',
            amountMinor: x.amountMinor,
            status: 'COMPLETED',
            reservations: 1,
            ...base,
          });
      }
    const inPeriod = [...ops.values()]
      .filter((o) => o.localAt.slice(0, 10) >= from && o.localAt.slice(0, 10) <= to)
      .filter((o) => !type || o.kind === type)
      .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
    const counts = new Map<string, number>();
    for (const o of inPeriod) counts.set(o.method, (counts.get(o.method) ?? 0) + 1);
    const picked = inPeriod.filter((o) => !method || o.method === method);
    const sum = (xs: Op[]) => xs.reduce((acc, o) => acc + BigInt(o.amountMinor), 0n).toString();
    return {
      from,
      to,
      currency: 'KZT',
      total: picked.length,
      paidMinor: sum(picked.filter((o) => o.kind === 'PAYMENT' && o.status === 'COMPLETED')),
      refundedMinor: sum(picked.filter((o) => o.kind === 'REFUND')),
      methods: [...counts]
        .map(([m, count]) => ({ method: m, count }))
        .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method)),
      rows: picked.slice(0, limit),
      truncated: picked.length > limit,
    };
  }
  if (path === '/finance/debts') {
    // Как у API (ADR-113): бронь с начислением в периоде — проживание начисляется датой заезда; остаток — по всему
    // счёту брони, в список только > 0, крупные первыми, равные — по дате заезда
    const from = q.get('from') || today;
    const to = q.get('to') || from;
    const debts = allCards()
      .filter((r) => r.arrivalDate >= from && r.arrivalDate <= to)
      .map((r) => ({ r, money: finance(r) }))
      .filter(({ money }) => BigInt(money.balanceMinor) > 0n)
      .sort(
        (a, b) =>
          Number(BigInt(b.money.balanceMinor) - BigInt(a.money.balanceMinor)) ||
          a.r.arrivalDate.localeCompare(b.r.arrivalDate) ||
          a.r.confirmationNumber.localeCompare(b.r.confirmationNumber),
      );
    const sum = (xs: typeof debts) =>
      xs.reduce((acc, x) => acc + BigInt(x.money.balanceMinor), 0n).toString();
    // Q-207, как у API: гость выехал или дата выезда и час выезда объекта (12:00, UTC+5) уже прошли;
    // отменённые и незаезды не просрочиваются
    const nowLocal = new Date(Date.now() + 5 * 3600_000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');
    const overdue = (r: ReservationCard) =>
      !['CANCELLED', 'NO_SHOW'].includes(r.status) &&
      (r.status === 'CHECKED_OUT' || `${r.departureDate} 12:00` <= nowLocal);
    const late = debts.filter(({ r }) => overdue(r));
    return {
      from,
      to,
      currency: 'KZT',
      count: debts.length,
      balanceMinor: sum(debts),
      overdue: { count: late.length, balanceMinor: sum(late) },
      rows: debts.map(({ r, money }) => ({
        confirmationNumber: r.confirmationNumber,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
        guestLabel: r.primaryGuest?.label ?? null,
        chargedMinor: money.chargedMinor,
        paidMinor: money.paidMinor,
        refundedMinor: money.refundedMinor,
        balanceMinor: money.balanceMinor,
        overdue: overdue(r),
      })),
      truncated: false,
    };
  }
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
  if (path === '/channels/channex/connection') {
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const base = {
      checkedAt: new Date().toISOString(),
      environment: 'staging',
      apiConfigured: true,
      propertyId: 'ui-property',
      propertyAccessible: true,
      // частичное сопоставление: две категории из трёх — как строки `/channels/channex/mapping`
      mappedCategories: channelMapping === 'partial' ? 2 : 3,
      mappedRatePlans: channelMapping === 'partial' ? 2 : 3,
      lastWebhookAt: null as string | null,
      lastPullAt: null as string | null,
      state: 'READY',
      message: 'Соединение установлено',
      ...channelsOverrides.connection,
    };
    if (channexMode === 'ok') return { ...base, lastWebhookAt: ago(2), lastPullAt: ago(95) };
    if (channexMode === 'attention')
      return { ...base, lastWebhookAt: ago(125), lastPullAt: ago(180) };
    if (channexMode === 'stale') return { ...base, lastWebhookAt: ago(185), lastPullAt: ago(240) };
    if (channexMode === 'webhook') return { ...base, lastWebhookAt: ago(130), lastPullAt: ago(12) };
    if (channexMode === 'no-key')
      return {
        ...base,
        apiConfigured: false,
        propertyAccessible: false,
        state: 'NO_KEY',
        message: 'Не задан ключ Channex',
      };
    return base;
  }
  if (path === '/channels/channex/mapping')
    return channelMapping === 'partial'
      ? [
          {
            id: 'ui-map-property',
            localAccommodationTypeCode: null,
            localRatePlanId: null,
            localRatePlanCode: null,
            providerPropertyId: 'ui-property',
            providerRoomTypeId: null,
            providerRatePlanId: null,
          },
          {
            id: 'ui-map-room',
            localAccommodationTypeCode: 'ROOM',
            localRatePlanId: 'ui-plan-base',
            localRatePlanCode: 'BASE',
            providerPropertyId: 'ui-property',
            providerRoomTypeId: 'ui-rt-room',
            providerRatePlanId: 'ui-rp-room',
          },
          {
            id: 'ui-map-male',
            localAccommodationTypeCode: 'MALE',
            localRatePlanId: 'ui-plan-base',
            localRatePlanCode: 'BASE',
            providerPropertyId: 'ui-property',
            providerRoomTypeId: 'ui-rt-male',
            providerRatePlanId: 'ui-rp-male',
          },
        ]
      : channexLive()
      ? [
          { id: 'ui-map-property', localAccommodationTypeCode: null, localRatePlanId: null, localRatePlanCode: null, providerPropertyId: 'ui-property', providerRoomTypeId: null, providerRatePlanId: null },
          ...categories.slice(0, 3).map((c) => ({
            id: `ui-map-${c.code}`,
            localAccommodationTypeCode: c.code,
            localRatePlanId: null,
            localRatePlanCode: 'BAR',
            providerPropertyId: 'ui-property',
            providerRoomTypeId: `ui-rt-${c.code.toLowerCase()}`,
            providerRatePlanId: `ui-rp-${c.code.toLowerCase()}`,
          })),
        ]
      : [];
  // названия номеров и тарифов Channex (как GET content/names): только когда объект «создан»
  if (path === '/channels/channex/content/names')
    return channelMapping === 'partial'
      ? {
          roomTypes: { 'ui-rt-room': 'Double Room', 'ui-rt-male': 'Male Dorm Bed' },
          ratePlans: { 'ui-rp-room': 'OTA Rate · Double', 'ui-rp-male': 'OTA Rate · Male Dorm' },
        }
      : { roomTypes: {}, ratePlans: {} };
  if (path === '/channels/channex/outbox' && channexMode === 'stale')
    return { pending: 5, failed: 0, sent: 405, lastSentAt: new Date(Date.now() - 200 * 60_000).toISOString(), lastTaskId: 'ui-task-4f2a', oldestPendingAt: new Date(Date.now() - 40 * 60_000).toISOString() };
  if (path === '/channels/channex/outbox' && channexMode === 'webhook')
    return { pending: 0, failed: 0, sent: 405, lastSentAt: new Date(Date.now() - 12 * 60_000).toISOString(), lastTaskId: 'ui-task-4f2a' };
  if (path === '/channels/channex/outbox' && channexMode === 'attention')
    return {
      pending: 0,
      failed: 2,
      sent: 405,
      lastSentAt: new Date(Date.now() - 150 * 60_000).toISOString(),
      lastTaskId: 'ui-task-4f2a',
    };
  if (path === '/channels/channex/outbox' && channexMode === 'ok')
    return {
      pending: 0,
      failed: 0,
      sent: 405,
      lastSentAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      lastTaskId: 'ui-task-4f2a',
    };
  if (path === '/channels/channex/outbox')
    return showcase
      ? {
          pending: 2,
          failed: 1,
          sent: 405,
          lastSentAt: `${today}T09:12:00Z`,
          lastTaskId: 'ui-task-4f2a',
          ...channelsOverrides.outbox,
        }
      : {
          pending: 0,
          failed: 0,
          sent: 16,
          lastSentAt: null,
          lastTaskId: null,
          ...channelsOverrides.outbox,
        };
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
  if (path === '/channels/channex/webhook/status') {
    const base =
      channexLive()
        ? {
            registered: true,
            active: true,
            expectedUrl: 'https://api.example.invalid/channels/channex/webhook',
            secretConfigured: true,
            callbackReachable: channexMode !== 'attention' && channexMode !== 'webhook',
            callbackCheckedAt: new Date().toISOString(),
          }
        : { registered: false, active: false, expectedUrl: null, secretConfigured: false };
    return { ...base, ...channelsOverrides.webhook };
  }
  if (path === '/audit') {
    // фильтр по типу объекта фикстура уважает так же, как настоящий API: иначе проверка отбора ничего не проверяет
    const type = q.get('entityType');
    const entries: Array<{
      id: string;
      at: string;
      entityType: string;
      entityId: string;
      action: string;
      subject: string | null;
      targetAvailable: boolean | null;
      author: string | null;
    }> = [
      {
        id: 'ui-audit',
        at: `${today}T08:30:00Z`,
        entityType: 'Reservation',
        entityId: 'ui-item',
        action: 'reservation.checkIn',
        subject: card.confirmationNumber,
        targetAvailable: true,
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
        targetAvailable: null,
        author: uiUser.name,
      },
      {
        id: 'ui-audit-system',
        at: `${today}T07:45:00Z`,
        entityType: 'Property',
        entityId: 'ui-property',
        action: 'channex.fullSync',
        subject: null,
        targetAvailable: null,
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
          targetAvailable: null,
          author: uiUser.name,
        },
        {
          id: 'ui-audit-older',
          at: `${add(today, -3)}T06:05:00Z`,
          entityType: 'Reservation',
          entityId: 'ui-item',
          action: 'reservation.create',
          subject: card.confirmationNumber,
          targetAvailable: false,
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
      status: { lastEventAt: siteLastEventAt, sessionsToday: 20, pageviewsToday: 38 },
      snippet: {
        key: site.publicKey,
        scriptUrl: '/w/tracker.js',
        code: '<script data-site="public-ui-fixture"></script>',
        demoUrl: '/demo',
        bookingCode: '<div data-booking></div>',
        bookingDemoUrl: siteBookingDemoUrl,
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
    const raw = Buffer.concat(chunks);
    // Файл знаний продавца приходит multipart — JSON там не разобрать (ТЗ П6)
    const multipart = String(req.headers['content-type'] ?? '').startsWith('multipart/form-data');
    const body =
      chunks.length && !multipart ? (JSON.parse(raw.toString()) as Record<string, unknown>) : {};
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
    if (!demo) {
      const agentResponse = agentFixture(path, req.method ?? 'GET', body);
      if (agentResponse) return send(agentResponse.status, agentResponse.data);
    }
    if (path === '/__test/reset') {
      resetAgentFixture();
      hits.clear();
      requestHits.clear();
      resetUiAuth();
      resetAccess();
      resetSupport();
      setHotelHold(false);
      propertyName = 'Luxx Aparts';
      connectionState = 'READY';
      // A long browser run can cross midnight in the property's timezone.
      today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
      units.splice(88);
      categories.splice(0, categories.length, ...structuredClone(categorySeed));
      extraPlans.splice(0, extraPlans.length);
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
      channelsOverrides = {};
      delayPath = '';
      delayMs = 0;
      failStatus = 503;
      channexMode = '';
      ratesUnmapped = false;
      incidentHistory = 0;
      channelMapping = 'none';
      emptyFixture = false;
      noBookings = false;
      createdReservation = false;
      hotelOverrides = {};
      serviceCatalog = structuredClone(serviceSeed);
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
      siteLastEventAt = null;
      siteBookingDemoUrl = '/demo-booking';
      groupFixture = false;
      analyticsHistory = false;
      paid = new Map();
      paymentLines = [];
      piiStorage = 'real';
      softPlan = false;
      planPenalty.clear();
      resetSeller();
      // «сегодня» стенда: тест берёт дату отсюда, а не считает сам — долгий прогон переходит полночь Алматы
      return send(200, { today });
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
      if (body['analyticsHistory'] === true) seedAnalyticsHistory();
      rejectCreate = body['rejectCreate'] === true;
      piiStorage = body['piiStorage'] === 'pseudonymized' ? 'pseudonymized' : 'real';
      channelMapping = body['channelMapping'] === 'partial' ? 'partial' : 'none';
      failPath = String(body['failPath'] || '');
      delayPath = String(body['delayPath'] || '');
      delayMs = Number(body['delayMs'] || 1500);
      // состояния модуля «Каналы продаж» (ADR-112) для снимков и проверок: поля поверх ответов
      // connection / webhook/status / outbox; сбрасывается reset или control без поля
      channelsOverrides =
        body['channelsOverrides'] && typeof body['channelsOverrides'] === 'object'
          ? (body['channelsOverrides'] as typeof channelsOverrides)
          : {};
      siteLastEventAt =
        typeof body['siteLastEventAt'] === 'string' ? body['siteLastEventAt'] : null;
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
      channexMode = CHANNEX_MODES.includes(String(body['channex']) as ChannexMode)
        ? (body['channex'] as ChannexMode)
        : '';
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
      // бронь, перенесённая из внешней системы: у проживаний нет тарифа (Б1, Б8)
      if (body['withoutRatePlan'] === true)
        for (const it of card.items) Object.assign(it, { ratePlanCode: null, ratePlanName: null });
      if (body['softPlan'] === true) softPlan = true;
      if (typeof body['bookingDemoUrl'] === 'string') siteBookingDemoUrl = body['bookingDemoUrl'];
      // ИИ-продавец: не подключён, последний отказ (приёмка ТЗ §4.4 «продавец недоступен»)
      sellerState = body['sellerState'] === 'not-configured' ? 'not-configured' : 'ready';
      sellerHosts = Array.isArray(body['sellerHosts'])
        ? (body['sellerHosts'] as string[]).map(String)
        : ['hotel-a.example.invalid'];
      sellerLastError =
        typeof body['sellerLastError'] === 'string' ? body['sellerLastError'] : null;
      sellerRetrying = body['sellerRetrying'] === true;
      // роль вошедшего, отметка главного администратора и расширение своей гостиницы (ADR-083)
      uiRole =
        body['role'] === 'STAFF' ? 'STAFF' : body['role'] === 'MANAGER' ? 'MANAGER' : 'OWNER';
      uiPlatformAdmin = body['platformAdmin'] === true;
      setSellerExtension(
        body['sellerExtension'],
        body['sellerDaysLeft'],
        body['sellerTrial'] === true,
      );
      setOrgTrial(body['orgTrialDays']);
      supportState = body['supportState'] === 'not-configured' ? 'not-configured' : 'ready';
      // правил у помощника нет — файла промпта на томе ещё не завели (ADR-084)
      if (body['supportPromptEmpty'] === true) supportPrompt = '';
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
    // Кейсы «Гостей v2» для визуального согласования G1 (поручение владельца 27.09): несколько
    // проживаний у одного гостя, только отменённая бронь, давний выезд, живущий с неоплаченным
    // счётом (задел под панель предпросмотра — в таблице G1 долг не показывается). Включается
    // только этим вызовом, обычные тесты гостей не видят. Все имена вымышленные (ADR-010).
    if (path === '/__test/guest-cases') {
      const put = (
        n: string,
        label: string,
        cases: Array<{
          status: string;
          unit: string;
          from: number;
          to: number;
          source?: string;
          channel?: string | null;
        }>,
      ) => {
        let guestId = '';
        for (const [i, s] of cases.entries()) {
          const { r, g } = designCard(
            {
              n: `${n}${i}`,
              label,
              status: s.status,
              source: s.source ?? 'DESK',
              channel: s.channel ?? null,
              unit: s.unit,
              from: s.from,
              to: s.to,
              price: '1200000',
            },
            add(today, s.from),
            add(today, s.to),
          );
          // все брони — одного человека: гость заводится один, карточки ссылаются на него
          if (i === 0) {
            guestId = g.id;
            extraGuests.set(g.id, g);
          }
          r.primaryGuest = { ...r.primaryGuest!, id: guestId };
          extraCards.set(r.confirmationNumber, r);
        }
      };
      // живёт сейчас, до этого приезжал дважды и уже забронировал следующий визит: «Визитов 3»
      // (будущая бронь — не визит), в карточке (G4) — текущее и следующее проживание и история
      // из разных источников
      put('GCRET', 'Возвращающийся Гость', [
        {
          status: 'CHECKED_OUT',
          unit: 'R07',
          from: -21,
          to: -18,
          source: 'OTA',
          channel: 'Booking.com',
        },
        { status: 'CHECKED_OUT', unit: 'M05', from: -9, to: -7, source: 'WEBSITE' },
        { status: 'CHECKED_IN', unit: 'R08', from: -1, to: 2 },
        { status: 'CONFIRMED', unit: 'R12', from: 10, to: 13, source: 'WEBSITE' },
      ]);
      // только отменённая бронь: статус гостя «—», подпись «бронь на … отменена» (ТЗ §16)
      put('GCCAN', 'Отменившийся Гость', [{ status: 'CANCELLED', unit: 'R09', from: -3, to: -1 }]);
      // выехал 40 дней назад: активного проживания нет, в «Недавние» не попадает
      put('GCOLD', 'Давний Гость', [{ status: 'CHECKED_OUT', unit: 'R10', from: -43, to: -40 }]);
      // живёт сейчас; его счёт станет виден в панели предпросмотра (следующая ступень)
      put('GCDEBT', 'Задолжавший Гость', [{ status: 'CHECKED_IN', unit: 'R11', from: -2, to: 3 }]);
      // документы (G5): у давнего гостя паспорт просрочен, у возвращающегося — удостоверение с датами
      extraGuests.get('ui-guest-GCOLD0')!.documents = [
        {
          id: 'ui-doc-gcold',
          type: 'PASSPORT',
          numberMasked: '•••• 7788',
          issueCountry: 'KAZ',
          issuedAt: '2015-06-30',
          expiresAt: '2025-06-30',
        },
      ];
      // G6 (ТЗ §34): телефон набран без пробелов — поиск по цифрам находит гостя, как API
      extraGuests.get('ui-guest-GCRET0')!.phone = '+77010000042';
      extraGuests.get('ui-guest-GCRET0')!.documents = [
        {
          id: 'ui-doc-gcret',
          type: 'ID_CARD',
          numberMasked: '•••• 1234',
          issueCountry: 'KAZ',
          issuedAt: '2022-03-15',
          expiresAt: '2032-03-15',
        },
      ];
      return send(200, { guests: 4 });
    }
    if (path === '/__test/commands') return send(200, commands);
    if (delayPath && path === delayPath)
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    if (channexMode === 'foreign' && CHANNEX_FOREIGN.has(path))
      return send(403, {
        message: 'Каналы продаж, обмен с Channex и сторож системы ведёт поддержка WETOP.',
      });
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
      // Те же параметры, что GET /hotel/reservations API (ADR-106, срез R2): отбор до страницы
      const p = (name: string) => url.searchParams.get(name) || '';
      const view = p('view') || 'all';
      const dateBase = p('date') || 'stay';
      const from = view === 'today' ? today : p('from') || today,
        to = view === 'today' ? today : p('to') || from;
      const status = p('status') || 'ALL';
      const q = p('q').toLocaleLowerCase('ru');
      const sourceText = p('source').trim();
      const payment = p('payment');
      const allocation = p('allocation');
      const category = p('category');
      const sort = p('sort') || (view === 'today' ? 'arrival' : '');
      for (const r of allCards())
        if (!cardSeen.has(r.confirmationNumber)) cardSeen.set(r.confirmationNumber, cardSeen.size);
      const kindOf = (code: string | null) => units.find((u) => u.code === code)?.kind ?? null;
      const withoutUnit = (r: ReservationCard) => r.items.some((it) => !it.unitCode);
      const active = (r: ReservationCard) =>
        ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'].includes(r.status);
      const moneyOf = (r: ReservationCard) => {
        const money = finance(r);
        return {
          money,
          state: financeState({ ...money, hasFolios: true }).kind,
          balance: BigInt(money.balanceMinor),
        };
      };
      const inPeriod = allCards().filter((r) => {
        if (!`${r.primaryGuest?.label} ${r.confirmationNumber}`.toLocaleLowerCase('ru').includes(q))
          return false;
        const { state, balance } = moneyOf(r);
        if (view === 'future' && !(r.arrivalDate > today && r.status !== 'CANCELLED')) return false;
        if (view === 'inhouse' && r.status !== 'CHECKED_IN') return false;
        if (
          view === 'attention' &&
          !(
            (active(r) && withoutUnit(r)) ||
            (['TENTATIVE', 'CONFIRMED'].includes(r.status) && r.arrivalDate < today) ||
            (balance > 0n && ['CHECKED_IN', 'CHECKED_OUT'].includes(r.status)) ||
            balance < 0n
          )
        )
          return false;
        if (view === 'all' || view === 'today') {
          if (dateBase === 'arrival' && !(r.arrivalDate >= from && r.arrivalDate <= to))
            return false;
          if (dateBase === 'departure' && !(r.departureDate >= from && r.departureDate <= to))
            return false;
          if (dateBase === 'created' && !(today >= from && today <= to)) return false;
          if (dateBase === 'stay' && !(r.arrivalDate <= to && r.departureDate >= from))
            return false;
        }
        if (sourceText) {
          const enumSource = sourceText.toUpperCase();
          const bySource = [
            'DESK',
            'PHONE',
            'WHATSAPP',
            'WALK_IN',
            'INSTAGRAM',
            'OTA',
            'WEBSITE',
          ].includes(enumSource);
          if (
            bySource
              ? r.source !== enumSource
              : !(r.channel ?? '').toLowerCase().includes(sourceText.toLowerCase())
          )
            return false;
        }
        if (payment === 'paid' && state !== 'paid') return false;
        if (payment === 'partial' && state !== 'due') return false;
        if (payment === 'unpaid' && state !== 'unpaid') return false;
        if (payment === 'due' && state !== 'due' && state !== 'unpaid') return false;
        if (payment === 'refund' && state !== 'refund-due') return false;
        if (payment === 'refunded' && state !== 'refunded') return false;
        if (allocation === 'assigned' && withoutUnit(r)) return false;
        if (allocation === 'missing' && !(active(r) && withoutUnit(r))) return false;
        if (allocation === 'room' && !r.items.some((it) => kindOf(it.unitCode) === 'ROOM'))
          return false;
        if (allocation === 'bed' && !r.items.some((it) => kindOf(it.unitCode) === 'BED'))
          return false;
        if (category && !r.items.some((it) => it.accommodationTypeCode === category)) return false;
        return true;
      });
      // Числа на чипах статусов — как в API: по отбору без самого статуса
      const counts: Record<string, number> = { ALL: emptyFixture ? 0 : inPeriod.length };
      if (!emptyFixture) for (const r of inPeriod) counts[r.status] = (counts[r.status] ?? 0) + 1;
      const key = (r: ReservationCard): Array<string | number | bigint> =>
        sort === 'arrival'
          ? [r.arrivalDate]
          : sort === 'departure'
            ? [r.departureDate]
            : sort === 'new'
              ? [-(cardSeen.get(r.confirmationNumber) ?? 0)]
              : sort === 'amount'
                ? [-BigInt(r.totalAmountMinor)]
                : sort === 'debt'
                  ? [-moneyOf(r).balance]
                  : [];
      const ordered = inPeriod
        .filter((r) => status === 'ALL' || r.status === status)
        .sort((a, b) => {
          const [ka, kb] = [key(a)[0], key(b)[0]];
          if (ka !== undefined && kb !== undefined && ka !== kb) return ka < kb ? -1 : 1;
          if (ka === undefined && a.arrivalDate !== b.arrivalDate)
            return a.arrivalDate < b.arrivalDate ? 1 : -1;
          return 0;
        });
      const rows = ordered.map((r) => {
        const { money } = moneyOf(r);
        return {
          confirmationNumber: r.confirmationNumber,
          status: r.status,
          source: r.source,
          channel: r.channel,
          arrivalDate: r.arrivalDate,
          departureDate: r.departureDate,
          currency: r.currency,
          totalAmountMinor: r.totalAmountMinor,
          chargedMinor: money.chargedMinor,
          paidMinor: money.paidMinor,
          refundedMinor: money.refundedMinor,
          balanceMinor: money.balanceMinor,
          hasFolios: true,
          unitCodes: r.items.flatMap((it) => (it.unitCode ? [it.unitCode] : [])),
          itemsCount: r.items.length,
          primaryGuest: r.primaryGuest
            ? { ...r.primaryGuest, email: getGuest(r.primaryGuest.id)?.email ?? null }
            : null,
        };
      });
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
      // зовут владелец и управляющий (ADR-107) — и список ожидающих тоже их
      if (!canManageStaff(uiRole)) return send(403, { message: INVITE_STAFF_ONLY_MESSAGE });
      const view = (i: FixtureInvite) => ({
        ...i,
        acceptedAt: null,
        revocable: canInvite(uiRole, i.role),
      });
      if (req.method === 'POST') {
        const raw = body['role'];
        const role =
          raw === undefined || raw === null || raw === '' ? 'STAFF' : parseInviteRole(raw);
        if (!role) return send(400, { message: INVITE_ROLE_MESSAGE });
        if (!canInvite(uiRole, role))
          return send(403, { message: INVITE_MANAGER_OWNER_ONLY_MESSAGE });
        const email = String(body['email'] ?? '')
          .trim()
          .toLowerCase();
        if (!email.includes('@'))
          return send(400, { message: 'Укажите почту человека, которого приглашаете.' });
        // Члены вымышленной организации: вошедший и сотрудник, заведённый входом по коду (urij@…)
        if (email === who.email || uiMembers.has(email) || uiTeam.some((m) => m.email === email))
          return send(400, { message: 'Этот человек уже в организации.' });
        const invite: FixtureInvite = {
          id: `inv-${Date.now()}`,
          email,
          role,
          expiresAt: invitePreview.expiresAt,
          createdAt: new Date().toISOString(),
        };
        uiInvites.unshift(invite);
        return send(201, view(invite));
      }
      return send(200, uiInvites.map(view));
    }
    // отозвать приглашение (С-10): тот, кто вправе позвать с этой ролью; иначе — «не найдено», как API
    const revokeMatch = /^\/auth\/invites\/([^/]+)$/.exec(path);
    if (revokeMatch && req.method === 'DELETE') {
      const token = sessionOf(req as never);
      if (!token || !uiSessions.has(token))
        return send(401, { message: 'Сеанс закончился. Войдите заново.' });
      if (!canManageStaff(uiRole)) return send(403, { message: INVITE_STAFF_ONLY_MESSAGE });
      const at = uiInvites.findIndex((i) => i.id === revokeMatch[1] && canInvite(uiRole, i.role));
      if (at < 0)
        return send(404, { message: 'Приглашение не найдено, уже принято или его срок истёк.' });
      uiInvites.splice(at, 1);
      return send(200, { ok: true });
    }
    // Сотрудники (ADR-107): список, отключение, смена роли — по тем же правилам, что у API
    const memberMatch = /^\/auth\/members(?:\/([^/]+))?$/.exec(path);
    if (memberMatch) {
      const token = sessionOf(req as never);
      const who = token ? uiSessions.get(token) : undefined;
      if (!who) return send(401, { message: 'Сеанс закончился. Войдите заново.' });
      if (!canManageStaff(uiRole)) return send(403, { message: INVITE_STAFF_ONLY_MESSAGE });
      if (!memberMatch[1]) return send(200, teamView(who));
      const target = teamView(who).find((m) => m.userId === memberMatch[1]);
      if (req.method === 'PATCH') {
        if (!canSetRoleAtDesk(uiRole, 'STAFF', 'MANAGER'))
          return send(403, { message: MEMBER_ROLE_OWNER_ONLY_MESSAGE });
        const role = parseInviteRole(body['role']);
        if (!role) return send(400, { message: MEMBER_ROLE_MESSAGE });
        if (!target) return send(404, { message: MEMBER_NOT_FOUND_MESSAGE });
        if (target.you) return send(403, { message: MEMBER_SELF_MESSAGE });
        if (!canSetRoleAtDesk(uiRole, target.role, role))
          return send(403, { message: MEMBER_OWNER_MESSAGE });
        uiTeam = uiTeam.map((m) => (m.userId === target.userId ? { ...m, role } : m));
        return send(200, { userId: target.userId, role });
      }
      if (req.method === 'DELETE') {
        if (!target) return send(404, { message: MEMBER_NOT_FOUND_MESSAGE });
        if (target.you) return send(403, { message: MEMBER_SELF_MESSAGE });
        if (target.role === 'OWNER') return send(403, { message: MEMBER_OWNER_MESSAGE });
        if (!canRemoveMember(uiRole, target.role))
          return send(403, { message: MEMBER_MANAGER_REMOVES_STAFF_MESSAGE });
        uiTeam = uiTeam.filter((m) => m.userId !== target.userId);
        return send(200, { ok: true });
      }
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
      const who = token ? uiSessions.get(token) : undefined;
      if (!who) return send(200, { user: null });
      // что открыто организации — пункт меню «ИИ-продавец» и напоминание о сроке (ADR-083)
      return send(200, {
        user: signedInView(who),
        access: { aiSeller: aiSellerView(who.organizationId) },
      });
    }
    // «Платформа» (ADR-083): только вошедшему главному администратору
    if (path === '/platform/organizations' || path.startsWith('/platform/')) {
      const token = sessionOf(req as never);
      const who = token ? uiSessions.get(token) : undefined;
      if (!who || !uiPlatformAdmin)
        return send(403, {
          message: 'Раздел «Платформа» — только для главного администратора платформы',
        });
      if (path === '/platform/organizations' && req.method === 'GET')
        return send(200, { items: platformOrganizations().map(platformOrganizationJson) });
      const change = /^\/platform\/organizations\/([^/]+)\/extensions\/ai-seller$/.exec(path);
      if (change && req.method === 'PUT') {
        const org = platformOrganizations().find((o) => o.id === decodeURIComponent(change[1]!));
        if (!org) return send(404, { message: 'Такой организации нет' });
        const parsed = parseExtensionChange(body, new Date());
        if (!parsed.ok) return send(400, { message: parsed.errors.join('; ') });
        platformExtensions.set(org.id, { ...parsed.value, updatedAt: new Date() });
        return send(200, platformOrganizationJson(org));
      }
      // Оплата счётом (Q-141 — А, ADR-102): «оплата получена» — ACTIVE, обратно — READ_ONLY
      const status = /^\/platform\/organizations\/([^/]+)\/status$/.exec(path);
      if (status && req.method === 'PUT') {
        const org = platformOrganizations().find((o) => o.id === decodeURIComponent(status[1]!));
        if (!org) return send(404, { message: 'Такой организации нет' });
        const next = body['status'];
        if (next !== 'ACTIVE' && next !== 'READ_ONLY')
          return send(400, {
            message: 'Статус: «ACTIVE» (оплата получена) или «READ_ONLY» (только чтение)',
          });
        platformStatuses.set(org.id, next);
        return send(
          200,
          platformOrganizationJson(platformOrganizations().find((o) => o.id === org.id)!),
        );
      }
      if (path.startsWith('/platform/support/')) {
        if (path === '/platform/support/status' && req.method === 'GET')
          return send(200, { state: supportState });
        if (supportState === 'not-configured')
          return send(503, {
            message: 'ИИ-помощник не подключён: у платформы нет адреса панели помощника и ключа',
          });
        const dialog =
          /^\/platform\/support\/conversations\/([^/]+)(?:\/(takeover|release|reply))?$/.exec(path);
        if (path === '/platform/support/conversations' && req.method === 'GET') {
          const mode = url.searchParams.get('mode');
          return send(200, {
            items: supportDialogs
              .filter((d) => !mode || d.mode === mode)
              .map((d) => ({
                id: d.id,
                channel: d.channel,
                clientName: d.clientName,
                mode: d.mode,
                stage: d.stage,
                lastActivityAt: d.lastActivityAt,
                messages: d.messages.length,
                hasContact: d.hasContact,
              })),
          });
        }
        if (dialog) {
          const d = supportDialogs.find((x) => x.id === dialog[1]);
          if (!d) return send(404, { message: 'диалог не найден' });
          if (!dialog[2] && req.method === 'GET')
            return send(200, {
              id: d.id,
              mode: d.mode,
              stage: d.stage,
              leadData: {},
              contact: {
                name: d.platformUser?.email ?? null,
                phone: null,
                email: null,
                channel: d.channel,
                externalId: null,
              },
              messages: d.messages,
              platformUser: d.platformUser,
            });
          if (dialog[2] === 'reply' && req.method === 'POST') {
            const text = String(body['text'] ?? '').trim();
            if (!text) return send(400, { message: 'Ответ: пустое сообщение' });
            d.messages.push({
              role: 'operator',
              text,
              at: new Date().toISOString(),
              sentByUs: true,
            });
            return send(200, { ok: true });
          }
          if (dialog[2] && req.method === 'POST') {
            const previousMode = d.mode;
            d.mode = dialog[2] === 'takeover' ? 'owner_takeover' : 'bot_active';
            return send(200, { mode: d.mode, previousMode });
          }
        }
        if (path === '/platform/support/knowledge' && req.method === 'GET')
          return send(200, { items: supportKnowledge });
        if (path === '/platform/support/knowledge' && req.method === 'POST') {
          const name = /filename="([^"]+)"/.exec(raw.toString('utf8'))?.[1] ?? 'документ';
          if (!/\.(md|txt|pdf|docx|xlsx)$/i.test(name))
            return send(415, { message: 'Знания: md, txt, pdf, docx или xlsx' });
          supportKnowledge = [
            { source: name, chunks: 1, createdAt: new Date().toISOString() },
            ...supportKnowledge,
          ];
          return send(201, { source: name, created: true, chunks: 1 });
        }
        if (path === '/platform/support/summary' && req.method === 'GET')
          return send(200, {
            hours: 24,
            dialogs: supportDialogs.length,
            replies: 3,
            leads: 0,
            slaBreaches: 1,
          });
        if (path === '/platform/support/prompt' && req.method === 'GET')
          return send(200, { text: supportPrompt });
        if (path === '/platform/support/prompt' && req.method === 'PUT') {
          const text = String(body['text'] ?? '').trim();
          if (!text) return send(400, { message: 'Правила: пустой текст' });
          supportPrompt = text;
          return send(200, { length: text.length });
        }
        if (path === '/platform/support/settings' && req.method === 'GET')
          return send(200, { models: SUPPORT_MODELS, model: supportModel });
        if (path === '/platform/support/settings/model' && req.method === 'PUT') {
          const model = String(body['model'] ?? '').trim();
          if (!SUPPORT_MODELS.includes(model))
            return send(422, { message: 'ИИ-помощник отклонил: модель не из списка разрешённых' });
          const previous = supportModel;
          supportModel = model;
          return send(200, { model, previous });
        }
        if (path === '/platform/support/sandbox' && req.method === 'POST') {
          if (!String(body['text'] ?? '').trim())
            return send(400, { message: 'Проверка: пустое сообщение' });
          const informal = supportPrompt.includes('на «ты»');
          return send(200, {
            reply: informal ? 'Привет! Чем помочь?' : 'Здравствуйте! Чем помочь?',
            needsHuman: false,
            reasons: [],
          });
        }
      }
      return send(404, { message: 'Нет такого адреса платформы' });
    }
    // ИИ-помощник (ТЗ П1): подпись только вошедшему — тем же форматом и той же функцией, что у API,
    // с секретом стенда. Набор `tests/ui/assistant-widget.spec.ts` читает её из тега виджета.
    if (path === '/assistant/identity') {
      const token = sessionOf(req as never);
      const who = token ? uiSessions.get(token) : undefined;
      if (!who) return send(401, { message: 'Подпись помощника выдаётся только вошедшему' });
      const issuedAt = Math.floor(Date.now() / 1000);
      return send(200, {
        token: assistant.signIdentity(FIXTURE_IDENTITY_SECRET, {
          userId: who.id,
          email: who.email,
          organizationId: who.organizationId,
          role: identityRole(uiRole),
          issuedAt,
        }),
        expiresAt: new Date((issuedAt + assistant.IDENTITY_TTL_SECONDS) * 1000).toISOString(),
      });
    }
    // ИИ-продавец (ТЗ П5–П8): раздел стойки говорит с этим подставным продавцом через «API»
    if (path.startsWith('/ai-seller/')) {
      const sellerToken = sessionOf(req as never);
      // служебный ходок (без сессии) для API — владелец; вошедший — по роли: настройки у владельца и управляющего (ADR-107)
      const sellerOwner = !(sellerToken && uiSessions.has(sellerToken)) || uiRole !== 'STAFF';
      const extension = aiSellerView('ui-org');
      const sellerUse =
        req.method === 'GET'
          ? path === '/ai-seller/embed'
            ? 'act'
            : path === '/ai-seller/llm-key' || path === '/ai-seller/whatsapp'
              ? 'configure'
              : 'read'
          : path === '/ai-seller/profile' ||
              path === '/ai-seller/prompt' ||
              path === '/ai-seller/apply' ||
              path === '/ai-seller/knowledge' ||
              path === '/ai-seller/extract' ||
              path.startsWith('/ai-seller/llm-key') ||
              path.startsWith('/ai-seller/whatsapp')
            ? 'configure'
            : 'act';
      if (path !== '/ai-seller/status') {
        if (sellerUse === 'configure' && !sellerOwner)
          return send(403, { message: 'Настройки продавца меняют владелец и управляющий' });
        if (extension.access === 'off')
          return send(403, {
            message:
              'Расширение «ИИ-продавец» для вашей организации не подключено. Подключает администратор WETOP после оплаты',
          });
        if (extension.access === 'expired' && sellerUse !== 'read')
          return send(403, {
            message:
              'Срок расширения «ИИ-продавец» вышел: раздел только для чтения. Продлевает администратор WETOP',
          });
      }
      const sellerView = () => ({
        saved: sellerSaved,
        profile: sellerProfile,
        updatedAt: sellerUpdatedAt,
        applied: sellerApplied,
      });
      const dialog = path.match(
        /^\/ai-seller\/conversations\/([^/]+)(?:\/(takeover|release|reply))?$/,
      );
      if (req.method === 'GET') {
        if (path === '/ai-seller/status')
          return send(200, {
            state:
              extension.access === 'off'
                ? 'extension-off'
                : extension.access === 'expired'
                  ? 'extension-expired'
                  : sellerState,
            connection: sellerState,
            extension,
            canConfigure: sellerOwner && extension.access === 'active',
            profile: { saved: sellerSaved, updatedAt: sellerUpdatedAt, applied: sellerApplied },
            facts: { applied: sellerApplied, appliedAt: sellerApplied ? sellerUpdatedAt : null },
            lastError: sellerLastError,
            lastErrorAt: sellerLastError ? new Date(Date.now() - 5 * 60_000).toISOString() : null,
            retrying: sellerLastError !== null && sellerRetrying,
            embedAvailable: true,
          });
        if (path === '/ai-seller/profile') return send(200, sellerView());
        if (path === '/ai-seller/prompt')
          return send(200, {
            saved: sellerPrompt !== null,
            text: sellerPrompt ?? '',
            updatedAt: sellerUpdatedAt,
            applied: sellerPrompt !== null && sellerApplied,
          });
        if (path === '/ai-seller/facts') {
          const src = sellerFactsSource();
          const facts = buildSellerFacts(src);
          return send(200, {
            facts,
            hash: sellerFactsHash(facts),
            applied: sellerApplied,
            ratePlan: src.ratePlan,
            window: src.window,
            prices: sellerCategoryPrices(src),
          });
        }
        if (path === '/ai-seller/conversations') {
          const mode = url.searchParams.get('mode');
          return send(200, {
            items: sellerDialogs
              .filter((d) => !mode || d.mode === mode)
              .map((d) => ({
                id: d.id,
                channel: d.channel,
                clientName: d.clientName,
                mode: d.mode,
                stage: d.stage,
                lastActivityAt: d.lastActivityAt,
                messages: d.messages.length,
                hasContact: d.hasContact,
              })),
          });
        }
        if (dialog && !dialog[2]) {
          const d = sellerDialogs.find((x) => x.id === dialog[1]);
          if (!d) return send(404, { message: 'диалог не найден' });
          return send(200, {
            id: d.id,
            mode: d.mode,
            stage: d.stage,
            leadData: d.leadData,
            contact: d.contact,
            messages: d.messages,
          });
        }
        if (path === '/ai-seller/knowledge') return send(200, { items: sellerKnowledge });
        if (path === '/ai-seller/summary')
          return send(200, {
            hours: 24,
            dialogs: sellerDialogs.length,
            replies: 5,
            leads: 1,
            slaBreaches: 0,
          });
        if (path === '/ai-seller/embed')
          // Э4: тег с публичным ключом гостиницы (выводимый, не секрет) и домены её сайтов
          return send(200, {
            snippet:
              '<script async src="https://seller.example.invalid/widget/widget.js" data-key="sk_' +
              'a1'.repeat(12) +
              '"></script>',
            hosts: sellerHosts,
          });
      }
      if (path === '/ai-seller/profile' && req.method === 'PUT') {
        // та же проверка, что у API: слова отказа — домена
        const parsed = parseSellerProfile(body);
        if (!parsed.ok) return send(400, { message: parsed.errors.join('; ') });
        sellerProfile = parsed.value;
        sellerSaved = true;
        sellerApplied = false;
        sellerUpdatedAt = new Date().toISOString();
        return send(200, sellerView());
      }
      if (path === '/ai-seller/prompt' && req.method === 'PUT') {
        // те же отказы, что у API: пустой и длиннее 20 000 знаков
        const text = typeof body['text'] === 'string' ? body['text'].trim() : '';
        if (!text) return send(400, { message: 'Инструкция: пустой текст' });
        if (text.length > 20_000)
          return send(400, { message: 'Инструкция: не длиннее 20000 знаков' });
        sellerPrompt = text;
        sellerSaved = true;
        sellerApplied = false;
        sellerUpdatedAt = new Date().toISOString();
        return send(200, { saved: true, text, updatedAt: sellerUpdatedAt, applied: false });
      }
      if (path === '/ai-seller/whatsapp' && req.method === 'GET')
        return send(200, sellerWhatsAppView());
      if (path === '/ai-seller/whatsapp' && req.method === 'PUT') {
        const phoneId = String(body['phoneNumberId'] ?? '').trim();
        if (phoneId === '') {
          sellerWhatsApp = null;
          return send(200, sellerWhatsAppView());
        }
        if (!/^\d+$/.test(phoneId))
          return send(400, { message: 'phone_number_id — цифры из консоли Meta' });
        if (String(body['token'] ?? '').trim().length < 16)
          return send(400, { message: 'Нужны постоянный токен и секрет приложения Meta' });
        sellerWhatsApp = { phoneNumberId: phoneId, verifyToken: 'slovo-dlya-meta-ui' };
        return send(200, sellerWhatsAppView());
      }
      if (path === '/ai-seller/whatsapp/check' && req.method === 'POST') {
        const phoneId = String(body['phoneNumberId'] ?? '').trim();
        const token = String(body['token'] ?? '').trim();
        if (phoneId === '' || token === '')
          return send(400, { message: 'Нужны phone_number_id и токен' });
        return send(
          200,
          token.includes('valid')
            ? { valid: true, phone: '+7 701 000-00-00', reason: null }
            : { valid: false, phone: null, reason: 'Meta не приняла номер или токен' },
        );
      }
      if (path === '/ai-seller/llm-key' && req.method === 'GET')
        return send(200, { set: sellerLlmKey !== null, last4: sellerLlmKey });
      if (path === '/ai-seller/llm-key' && req.method === 'PUT') {
        const key = String(body['key'] ?? '').trim();
        sellerLlmKey = key === '' ? null : key.slice(-4);
        return send(200, { set: sellerLlmKey !== null, last4: sellerLlmKey });
      }
      if (path === '/ai-seller/llm-key/check' && req.method === 'POST') {
        const key = String(body['key'] ?? '').trim();
        if (key === '') return send(400, { message: 'Нечего проверять: ключ пуст' });
        // подставной роутер: «valid» в ключе — действителен, иначе отказ словами
        return send(
          200,
          key.includes('valid')
            ? { valid: true, reason: null }
            : { valid: false, reason: 'Роутер не принял ключ' },
        );
      }
      if (path === '/ai-seller/extract' && req.method === 'POST') {
        // подставной бот «разобрал» рассказ: как у API — только в пустые поля черновика (С1)
        const story = String(body['story'] ?? '').trim();
        if (story.length < 10)
          return send(400, { message: 'Рассказ короче 10 знаков — расскажите подробнее' });
        const extracted: Array<[keyof typeof sellerProfile, unknown]> = [
          ['botName', 'Айсулу'],
          ['greeting', 'Здравствуйте! Помогу выбрать место и ответить на вопросы.'],
          ['includedInPrice', 'Бельё и Wi-Fi.'],
          ['houseRules', 'Тишина после 23:00.'],
        ];
        const filled: string[] = [];
        const skipped: string[] = [];
        for (const [field, value] of extracted) {
          const current = sellerProfile[field];
          const empty =
            current === null ||
            (typeof current === 'string' && current.trim() === '') ||
            (Array.isArray(current) && current.length === 0);
          if (!empty) {
            skipped.push(field);
            continue;
          }
          (sellerProfile as unknown as Record<string, unknown>)[field] = value;
          filled.push(field);
        }
        if (filled.length > 0) {
          sellerSaved = true;
          sellerApplied = false;
          sellerUpdatedAt = new Date().toISOString();
        }
        return send(200, {
          filled,
          skipped,
          rejected: [],
          unparsed: ['как добраться от вокзала — в рассказе нет'],
          aside: {
            objectName: 'Хостел «Тёплый»',
            address: 'Алматы, ул. Вымышленная, 1',
            checkIn: '14:00',
            checkOut: '12:00',
            categories: [
              { name: 'Койка в общем номере', kind: 'bed', capacity: 1, priceMinor: 800000 },
            ],
          },
          profile: sellerView(),
        });
      }
      if (path === '/ai-seller/apply' && req.method === 'POST') {
        if (!sellerSaved) return send(409, { message: 'Сначала сохраните настройки продавца' });
        if (sellerState === 'not-configured')
          return send(503, {
            message: 'ИИ-продавец не подключён: у платформы нет адреса и ключа продавца',
          });
        // слой 9 продавца: скрытая инструкция в тексте — отказ по содержанию, причина остаётся в разделе
        if (sellerPrompt !== null && /игнорируй (все )?предыдущие/i.test(sellerPrompt)) {
          sellerLastError = 'В тексте найдены инструкции для модели';
          return send(422, { message: 'В тексте найдены инструкции для модели' });
        }
        sellerLastError = null;
        sellerApplied = true;
        sellerAppliedProfile = structuredClone(sellerProfile);
        sellerAppliedPrompt = sellerPrompt;
        return send(200, { profileApplied: true, factsApplied: true });
      }
      if (dialog && dialog[2] && req.method === 'POST') {
        const d = sellerDialogs.find((x) => x.id === dialog[1]);
        if (!d) return send(404, { message: 'диалог не найден' });
        if (dialog[2] === 'reply') {
          const text = String(body['text'] ?? '').trim();
          if (!text) return send(400, { message: 'Ответ: пустое сообщение' });
          d.messages.push({ role: 'operator', text, at: new Date().toISOString(), sentByUs: true });
          return send(200, { ok: true });
        }
        const previousMode = d.mode;
        d.mode = dialog[2] === 'takeover' ? 'owner_takeover' : 'bot_active';
        return send(200, { mode: d.mode, previousMode });
      }
      if (path === '/ai-seller/knowledge' && req.method === 'POST') {
        const name = /filename="([^"]+)"/.exec(raw.toString('utf8'))?.[1] ?? 'документ';
        if (!/\.(md|txt|pdf|docx|xlsx)$/i.test(name))
          return send(415, { message: 'Знания: md, txt, pdf, docx или xlsx' });
        sellerKnowledge = [
          { source: name, chunks: 1, createdAt: new Date().toISOString() },
          ...sellerKnowledge,
        ];
        return send(201, { source: name, created: true, chunks: 1 });
      }
      if (path === '/ai-seller/sandbox' && req.method === 'POST') {
        // ответ зависит от ПРИМЕНЁННОГО обращения: так видно, что «Сохранить и применить» дошло до продавца (ТЗ §4.4)
        const informal =
          sellerAppliedPrompt !== null
            ? /на «?ты»?/i.test(sellerAppliedPrompt)
            : sellerAppliedProfile.addressForm === 'INFORMAL';
        return send(200, {
          reply: informal ? 'Привет! Чем могу тебе помочь?' : 'Здравствуйте! Чем могу вам помочь?',
          needsHuman: false,
          reasons: [],
        });
      }
      return send(404, { message: 'Нет такого адреса продавца' });
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
    // Каталог услуг (SET3): тот же разбор, что у API, и те же права — владелец и управляющий (`settings`)
    if (path === '/hotel/services' && req.method === 'POST') {
      if (!can(uiRole, 'settings')) return send(403, { message: accessDeniedMessage('settings') });
      const parsed = parseServiceInput(body);
      if (!parsed.ok) return send(400, { message: parsed.reason });
      const v = parsed.value;
      const row: FixtureService = {
        code: `svc-${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
        name: v.name!,
        group: v.group ?? null,
        priceMinor: v.priceMinor!.toString(),
        active: v.active ?? true,
      };
      serviceCatalog.push(row);
      return send(201, row);
    }
    if (path.startsWith('/rates/plans/') && req.method === 'PATCH') {
      // как API: право `rates` — владелец и управляющий (ADR-107); правило действует для всех броней тарифа (SET4)
      if (!can(uiRole, 'rates')) return send(403, { message: accessDeniedMessage('rates') });
      const code = decodeURIComponent(path.split('/')[3]!);
      const extra = Object.keys(body).find((k) => k !== 'cancellationPenalty');
      if (extra) return send(400, { message: `Неизвестное поле: ${extra}` });
      const next = parseCancellationPenalty(body['cancellationPenalty']);
      if (!next)
        return send(400, {
          message: 'Правило отмены: без штрафа, первая ночь или всё проживание',
        });
      if (!ratePlanList().some((p) => p.code === code))
        return send(404, { message: 'Тариф не найден' });
      planPenalty.set(code, next);
      return send(200, ratePlanRows().find((p) => p.code === code));
    }
    if (path.startsWith('/hotel/services/') && req.method === 'PATCH') {
      if (!can(uiRole, 'settings')) return send(403, { message: accessDeniedMessage('settings') });
      const row = serviceCatalog.find((x) => x.code === decodeURIComponent(path.split('/')[3]!));
      if (!row) return send(404, { message: 'Услуга не найдена' });
      const parsed = parseServiceInput(body, { partial: true });
      if (!parsed.ok) return send(400, { message: parsed.reason });
      const v = parsed.value;
      if (v.name !== undefined) row.name = v.name;
      if (v.group !== undefined) row.group = v.group;
      if (v.priceMinor !== undefined) row.priceMinor = v.priceMinor.toString();
      if (v.active !== undefined) row.active = v.active;
      return send(200, row);
    }
    if (path === '/hotel/settings' && req.method === 'PATCH') {
      // как API: право `settings` — владелец и управляющий (ADR-107)
      if (!can(uiRole, 'settings')) return send(403, { message: accessDeniedMessage('settings') });
      const parsed = parseHotelSettingsPatch(body);
      if (!parsed.ok) return send(400, { message: parsed.reason });
      hotelOverrides = { ...hotelOverrides, ...(parsed.value as Record<string, string | null>) };
      return send(200, {});
    }
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
        user: signedInView(uiUser),
      });
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      const token = sessionOf(req as never);
      if (token) uiSessions.delete(token);
      return send(200, { ok: true });
    }

    if (path === '/inventory/categories' && req.method === 'POST') {
      // как на настоящем API (ADR-119): тариф — существующий, новый с названием или явно «позже»
      const rate = fixturePlanChoice(body);
      if (rate === undefined && body.ratePlanLater !== true)
        return send(400, { message: 'Выберите тариф или «Настроить позже»' });
      if (rate === null) return send(404, { message: 'Тариф не найден' });
      const code = `test-category-${categories.length}`;
      categories.push({
        code,
        name: String(body.name),
        capacityAdults: Number(body.capacityAdults),
        count: 0,
        prefix: 'T',
        kind: body.kind ? String(body.kind) : 'PRIVATE_ROOM',
        rateNames: rate ? [rate.name] : [],
      });
      return send(201, { code });
    }
    if (path.startsWith('/inventory/categories/') && path.endsWith('/rate-plan') && req.method === 'POST') {
      const c = categories.find((c) => c.code === decodeURIComponent(path.split('/').at(-2)!));
      if (!c) return send(404, { message: 'Категория не найдена' });
      const rate = fixturePlanChoice(body);
      if (rate === undefined) return send(400, { message: 'Выберите тариф или назовите новый' });
      if (rate === null) return send(404, { message: 'Тариф не найден' });
      const names = c.rateNames ?? [plans[0]!.name];
      if (names.includes(rate.name)) return send(201, { code: c.code, linked: false });
      c.rateNames = [...names, rate.name];
      return send(201, { code: c.code, linked: true });
    }
    if (path.startsWith('/inventory/categories/') && req.method === 'PATCH') {
      const c = categories.find((c) => c.code === decodeURIComponent(path.split('/').at(-1)!));
      if (!c) return send(404, { message: 'Категория не найдена' });
      c.name = String(body.name);
      return send(200, { code: c.code });
    }
    if (path === '/inventory/rooms' && req.method === 'POST') {
      const c = categories.find((c) => c.code === body.categoryCode);
      if (!c) return send(404, { message: 'Категория не найдена' });
      const codes = body.codes as string[];
      if (codes.some((code) => units.some((u) => u.code === code)))
        return send(409, { message: 'Обозначение уже существует' });
      for (const code of codes)
        units.push({
          code,
          kind: 'ROOM',
          accommodationTypeCode: c.code,
          accommodationTypeName: c.name,
          roomNumber: String(body.roomNumber),
          roomCapacity: c.capacityAdults,
          isDorm: false,
          buildingName: String(body.building ?? '') || null,
          floorName: String(body.floor ?? '') || null,
        });
      c.count += codes.length;
      return send(201, { codes });
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
      else if (command === 'blocks') {
        const from = String(body['dateFrom'] ?? '');
        const to = String(body['dateTo'] ?? '');
        const iso = /^\d{4}-\d{2}-\d{2}$/;
        // как настоящий API (units.service.ts): пустой или перевёрнутый период — 400
        if (!iso.test(from) || !iso.test(to) || to <= from)
          return send(400, {
            message: 'dateFrom/dateTo — даты YYYY-MM-DD, dateTo > dateFrom (ночь выезда не блокируется)',
          });
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
      } else return send(404, { message: 'Операция не найдена' });
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
      // тариф сайта — по коду из списка тарифов, как у API (`AnalyticsService.update`): неизвестный — 400 (WEB3)
      const { bookingRatePlanCode, ...rest } = body as Record<string, unknown> & {
        bookingRatePlanCode?: string | null;
      };
      if (typeof bookingRatePlanCode === 'string' && bookingRatePlanCode) {
        const plan = ratePlanList().find((p) => p.code === bookingRatePlanCode && p.active);
        if (!plan)
          return send(400, { message: `тариф ${bookingRatePlanCode} не найден или неактивен` });
        site = {
          ...site,
          bookingRatePlan: { id: `ui-rate-${plan.code}`, code: plan.code, name: plan.name },
        };
      } else if (bookingRatePlanCode === null || bookingRatePlanCode === '') {
        site = { ...site, bookingRatePlan: null };
      }
      site = { ...site, ...rest };
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
      // G6 (ТЗ «Гости v2» §33): бронь существующему гостю — те же ответы, что у API
      const existingId = typeof body['guestId'] === 'string' ? body['guestId'] : null;
      if (existingId && body['guest'] !== undefined)
        return send(400, {
          message: 'Укажите либо guestId существующего гостя, либо поля guest нового — не оба сразу',
        });
      const existing = existingId
        ? existingId === guest.id
          ? guest
          : extraGuests.get(existingId)
        : undefined;
      if (existingId && !existing) return send(404, { message: 'Гость не найден' });
      const g =
        existing ??
        ({
          ...structuredClone(guestSeed),
          ...(body['guest'] as Record<string, unknown>),
          id: `ui-new-guest-${commands.length}`,
        } as GuestCard);
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
      if (!existing) extraGuests.set(g.id, g);
      createdReservation = true;
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
        const refused = planRefusal(item.ratePlanCode, body['ratePlanCode']);
        if (refused) return send(403, { message: refused });
        if (!item.ratePlanCode && !body['ratePlanCode'])
          return send(400, { message: 'У проживания нет тарифа: выберите тариф для новой ночи' });
        const departure = add(item.departureDate, n);
        if (item.unitCode && unitBusy(item.unitCode, item.departureDate, departure, item))
          return send(409, { message: `Ячейка ${item.unitCode} занята: сначала переселите` });
        if (!item.ratePlanCode) recordPlan(item, body['ratePlanCode']);
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
        const refused =
          unit.accommodationTypeCode !== item.accommodationTypeCode
            ? planRefusal(item.ratePlanCode, body['ratePlanCode'])
            : null;
        if (refused) return send(403, { message: refused });
        if (unit.accommodationTypeCode !== item.accommodationTypeCode) {
          recordPlan(item, body['ratePlanCode']);
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
