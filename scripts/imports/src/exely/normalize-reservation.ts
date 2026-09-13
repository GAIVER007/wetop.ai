/**
 * Нормализация брони Exely Connect (PMS API v2, docs/exely/dev-portal/scenarios/webpms-api/
 * pms-get-reservation.md) в запись импорта нашей PMS (DATA_MODEL §2, §3).
 * Правила: деньги — integer minor units без float-арифметики; неизвестные значения — ошибка, не догадка;
 * из идентификаторов комнат ничего не выводится — только явная карта roomId → № единицы Exely.
 */
import { normalizeCitizenship } from '@pms/domain';
import { blankToNull } from '@pms/shared';
import { ExelyImportError } from './errors';

export interface ExelyMoney {
  value: number;
  currencyCode: string | null;
}
export interface ExelyRoomStay {
  pmsRoomStayId: string;
  roomId: string | null;
  roomTypeId: string;
  guestsIds: string[];
  checkInDateTime: string;
  checkOutDateTime: string;
  actualCheckInDateTime: string | null;
  actualCheckOutDateTime: string | null;
  status: string;
  guestCount: { adults: number; children: number };
  totalPrice: { amount: ExelyMoney; payAmount: ExelyMoney; refundAmount: ExelyMoney };
}
export interface ExelyCustomer {
  pmsPersonId: string;
  personName: { lastName: string | null; firstName: string | null; middleName: string | null };
  birthDate: string | null;
  citizenship: string | null;
  emails: Array<{ address: string }>;
  phones: Array<{ number: string }>;
  gender: string | null;
}
export interface ExelyReservationDetails {
  number: string;
  currencyCode: string;
  modifyDateTime?: string;
  customerComment?: string | null;
  customer: ExelyCustomer;
  creationSource: { id: string; name: string } | null;
  channelInformation: { channelName?: string; channelReservationNumber?: string } | null;
  reservationStatus: string;
  roomStays: ExelyRoomStay[];
}

export type ReservationSourceCode =
  'DESK' | 'PHONE' | 'WHATSAPP' | 'WALK_IN' | 'INSTAGRAM' | 'OTA' | 'WEBSITE';
export type ReservationStatusCode =
  'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type GenderCode = 'MALE' | 'FEMALE' | 'UNKNOWN';

export interface GuestImportRecord {
  exelyPersonId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  citizenship: string | null;
  gender: GenderCode;
  email: string | null;
  phone: string | null;
  notes: string | null;
}
export interface ReservationItemImportRecord {
  exelyRoomStayId: string;
  accommodationTypeCode: string;
  exelyRoomNumber: string | null;
  arrivalDate: string;
  departureDate: string;
  priceMinor: bigint;
  /** Оплачено в Exely на момент переноса (minor units); 0 — не оплачено */
  paidMinor: bigint;
  status: ReservationStatusCode;
  adults: number;
  children: number;
  guestExelyIds: string[];
}
export interface ReservationImportRecord {
  confirmationNumber: string;
  source: ReservationSourceCode;
  channel: string | null;
  externalId: string | null;
  status: ReservationStatusCode;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  totalAmountMinor: bigint;
  notes: string | null;
  customer: GuestImportRecord;
  items: ReservationItemImportRecord[];
}

export interface NormalizeContext {
  /** roomId Exely → «№ комнаты в Exely» (наш InventoryUnit.exelyRoomNumber); из GET /rooms */
  roomMap: Map<string, string>;
  /** roomTypeId Exely → код категории у нас (`exely-<id>`) */
  typeMap: Map<string, string>;
}

/** Источник создания брони Exely → наш enum. Расширяется по факту (значения из справочника, 12 шт.). */
const SOURCE_BY_NAME: Record<string, ReservationSourceCode> = {
  online: 'WEBSITE',
  'booking engine': 'WEBSITE',
  website: 'WEBSITE',
  'от стойки': 'DESK',
  'front desk': 'DESK',
  стойка: 'DESK',
  телефон: 'PHONE',
  phone: 'PHONE',
  whatsapp: 'WHATSAPP',
  'walk-in': 'WALK_IN',
  instagram: 'INSTAGRAM',
  // факты выгрузки Универсального API 08.09.2026: «Из канала продаж» (key 2) — OTA; «Мобильный экстранет» —
  // бронь сотрудника из мобильного приложения Exely, то есть стойка
  'из канала продаж': 'OTA',
  'мобильный экстранет': 'DESK',
};

const STAY_STATUS: Record<string, ReservationStatusCode> = {
  new: 'CONFIRMED',
  confirmed: 'CONFIRMED',
  unconfirmed: 'TENTATIVE',
  pending: 'TENTATIVE',
  checkedin: 'CHECKED_IN',
  checkedout: 'CHECKED_OUT',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  noshow: 'NO_SHOW',
};

/** Деньги: значение Exely (десятичное) → тиыны, через строку, без умножения float. */
export function toMinorUnits(value: number, where: string): bigint {
  if (!Number.isFinite(value)) throw new ExelyImportError(`${where}: сумма не число`);
  const s = value.toFixed(2); // Exely отдаёт до 4 знаков; тиын — 2 знака, округление half-up по toFixed
  const neg = s.startsWith('-');
  const [int, frac = '00'] = s.replace('-', '').split('.');
  const minor = BigInt(int!) * 100n + BigInt(frac.padEnd(2, '0').slice(0, 2));
  return neg ? -minor : minor;
}

const dateOf = (dt: string, where: string): string => {
  const d = dt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
    throw new ExelyImportError(`${where}: дата «${dt}» не в формате ISO`);
  return d;
};

function mapStayStatus(raw: string, where: string): ReservationStatusCode {
  const s = STAY_STATUS[raw.replace(/[\s_-]/g, '').toLowerCase()];
  if (!s) throw new ExelyImportError(`${where}: неизвестный статус проживания «${raw}»`);
  return s;
}

function mapSource(r: ExelyReservationDetails): {
  source: ReservationSourceCode;
  channel: string | null;
  externalId: string | null;
} {
  if (
    r.channelInformation &&
    (r.channelInformation.channelName || r.channelInformation.channelReservationNumber)
  ) {
    return {
      source: 'OTA',
      channel: r.channelInformation.channelName ?? null,
      externalId: r.channelInformation.channelReservationNumber ?? null,
    };
  }
  const name = (r.creationSource?.name ?? '').trim();
  const code = SOURCE_BY_NAME[name.toLowerCase()];
  if (!code)
    throw new ExelyImportError(
      `Бронь ${r.number}: неизвестный источник создания «${name || '—'}» — добавить в SOURCE_BY_NAME после сверки со справочником Exely`,
    );
  return { source: code, channel: null, externalId: null };
}

function mapGender(raw: string | null): GenderCode {
  const g = (raw ?? '').toLowerCase();
  if (g === 'male') return 'MALE';
  if (g === 'female') return 'FEMALE';
  return 'UNKNOWN';
}

/** Статус шапки при импорте — как в Exely (их справочник статусов брони); статусы проживаний — свои. */
function mapReservationStatus(raw: string, where: string): ReservationStatusCode {
  const s = STAY_STATUS[raw.replace(/[\s_-]/g, '').toLowerCase()];
  if (!s) throw new ExelyImportError(`${where}: неизвестный статус брони «${raw}»`);
  return s;
}

export function normalizeExelyReservation(
  r: ExelyReservationDetails,
  ctx: NormalizeContext,
): ReservationImportRecord {
  if (!r.roomStays?.length) throw new ExelyImportError(`Бронь ${r.number}: нет проживаний`);
  const items = r.roomStays.map((s): ReservationItemImportRecord => {
    const where = `Бронь ${r.number}, проживание ${s.pmsRoomStayId}`;
    const typeCode = ctx.typeMap.get(s.roomTypeId);
    if (!typeCode)
      throw new ExelyImportError(
        `${where}: roomTypeId ${s.roomTypeId} не найден в карте категорий`,
      );
    let exelyRoomNumber: string | null = null;
    if (s.roomId) {
      const n = ctx.roomMap.get(s.roomId);
      if (!n)
        throw new ExelyImportError(
          `${where}: roomId ${s.roomId} не найден в карте комнат (GET /rooms)`,
        );
      exelyRoomNumber = n;
    }
    const status = mapStayStatus(s.status, where);
    const arrivalDate = dateOf(s.checkInDateTime, where);
    const plannedDeparture = dateOf(s.checkOutDateTime, where);
    // Ранний выезд заканчивает проживание фактической датой (правило стойки): Exely оставляет плановую дату,
    // из-за чего два проживания в одной комнате пересекаются. Выезд в день заезда и поздний выезд — плановая дата.
    const actualDeparture =
      status === 'CHECKED_OUT' && s.actualCheckOutDateTime
        ? dateOf(s.actualCheckOutDateTime, where)
        : null;
    const departureDate =
      actualDeparture && actualDeparture < plannedDeparture && actualDeparture > arrivalDate
        ? actualDeparture
        : plannedDeparture;
    return {
      exelyRoomStayId: s.pmsRoomStayId,
      accommodationTypeCode: typeCode,
      exelyRoomNumber,
      arrivalDate,
      departureDate,
      priceMinor: toMinorUnits(s.totalPrice.amount.value, where),
      // оплачено в Exely = сумма − к оплате (перенос платежа, DATA_MODEL §6)
      paidMinor:
        toMinorUnits(s.totalPrice.amount.value, where) -
        toMinorUnits(s.totalPrice.payAmount.value, where),
      status,
      adults: s.guestCount?.adults ?? 0,
      children: s.guestCount?.children ?? 0,
      guestExelyIds: [...(s.guestsIds ?? [])],
    };
  });
  const src = mapSource(r);
  const c = r.customer;
  return {
    confirmationNumber: r.number,
    ...src,
    status: mapReservationStatus(r.reservationStatus, `Бронь ${r.number}`),
    arrivalDate: items.map((i) => i.arrivalDate).sort()[0]!,
    departureDate: items
      .map((i) => i.departureDate)
      .sort()
      .at(-1)!,
    adults: items.reduce((a, i) => a + i.adults, 0),
    children: items.reduce((a, i) => a + i.children, 0),
    currency: r.currencyCode,
    totalAmountMinor: items.reduce((a, i) => a + i.priceMinor, 0n),
    notes: r.customerComment?.trim() ? r.customerComment.trim() : null,
    customer: {
      exelyPersonId: c.pmsPersonId,
      firstName: c.personName?.firstName ?? '',
      lastName: c.personName?.lastName ?? '',
      middleName: c.personName?.middleName ?? null,
      birthDate: c.birthDate ?? null,
      // Exely отдаёт пустой citizenshipCode строкой; в CHAR(3) она стала бы '   ' (наблюдение 12.09.2026)
      citizenship: normalizeCitizenship(c.citizenship),
      gender: mapGender(c.gender),
      // пустые контакты Exely отдаёт строкой; на dev их скрывает анонимизация, в боевом режиме легли бы как ''
      email: blankToNull(c.emails?.[0]?.address),
      phone: blankToNull(c.phones?.[0]?.number),
      notes: null,
    },
    items,
  };
}
