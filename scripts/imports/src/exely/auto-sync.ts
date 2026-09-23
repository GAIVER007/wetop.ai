/**
 * Автосинхронизация из Exely каждые 5 минут (ADR-032; было 15, владелец 13.09.2026): окно поиска изменённых броней и дельта
 * остатков для Channex. Перекрытие окна 15 минут больше интервала — каждое изменение видят три прогона, импорт идемпотентен.
 * Чистые функции — без БД и сети; cli-sync-day.ts --auto склеивает их с Exely, импортом и API PMS.
 */

/** Время объекта. Exely понимает modifiedFrom/modifiedTo именно в нём, а не в UTC
 *  (проверено 13.09.2026 cli-exely-modified-window.ts: окно в UTC вернуло брони пятичасовой давности). */
const PROPERTY_UTC_OFFSET_MIN = 5 * 60; // Asia/Almaty, без перехода на летнее время
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Глубина полной выгрузки ARI (сертификация Channex §1) — дальше дельта не заглядывает */
export const ARI_HORIZON_DAYS = 500;

export interface AutoSyncRun {
  startedAt: Date;
  /** Когда последний раз проходили все активные брони текущих суток */
  fullPassAt: Date | null;
}
export interface AutoSyncWindow {
  modifiedFrom: string;
  modifiedTo: string;
  /** Пройти заодно все активные брони текущих суток — страховка от изменений, которых не видит поиск по дате изменения */
  fullPass: boolean;
}

const OVERLAP_MIN = 15;
const FIRST_LOOKBACK_MIN = 24 * 60;
const MAX_LOOKBACK_MIN = 7 * 24 * 60;
const FULL_PASS_EVERY_MIN = 60;

const propertyTime = (ms: number) =>
  new Date(ms + PROPERTY_UTC_OFFSET_MIN * MIN).toISOString().slice(0, 16);

export function autoSyncWindow(now: Date, last: AutoSyncRun | null): AutoSyncWindow {
  const t = now.getTime();
  const earliest = t - MAX_LOOKBACK_MIN * MIN;
  const from = last ? last.startedAt.getTime() - OVERLAP_MIN * MIN : t - FIRST_LOOKBACK_MIN * MIN;
  return {
    modifiedFrom: propertyTime(Math.max(from, earliest)),
    modifiedTo: propertyTime(t + 5 * MIN),
    fullPass: !last?.fullPassAt || t - last.fullPassAt.getTime() >= FULL_PASS_EVERY_MIN * MIN,
  };
}

/** Что в проживании влияет на остаток канала — то же, что считает OutboxAriPublisher (soldItems) */
export interface StayAvailabilityState {
  accommodationTypeCode: string;
  arrivalDate: string;
  /** Дата выезда: последняя ночь — накануне */
  departureDate: string;
  /** Занимает место: статус не CANCELLED и не NO_SHOW */
  sold: boolean;
}
export interface AvailabilityChange {
  categoryCodes: string[];
  from: string;
  toExclusive: string;
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const sameState = (a: StayAvailabilityState, b: StayAvailabilityState) =>
  a.accommodationTypeCode === b.accommodationTypeCode &&
  a.arrivalDate === b.arrivalDate &&
  a.departureDate === b.departureDate &&
  a.sold === b.sold;

/**
 * Какие категории и ночи пересчитать после импорта: состояние проживаний до и после (ключ — room stay Exely).
 * Проживание без изменений остаток не двигает; у изменённого пересчитываются и прежние, и новые ночи.
 * Прошедшие ночи и ночи дальше горизонта полной выгрузки не берутся. null — дельта не нужна.
 */
export function availabilityChange(
  before: ReadonlyMap<string, StayAvailabilityState>,
  after: ReadonlyMap<string, StayAvailabilityState>,
  today: string,
): AvailabilityChange | null {
  const horizon = addDays(today, ARI_HORIZON_DAYS);
  const codes = new Set<string>();
  let from: string | null = null;
  let to: string | null = null;
  const touch = (s: StayAvailabilityState) => {
    const start = s.arrivalDate < today ? today : s.arrivalDate;
    const end = s.departureDate > horizon ? horizon : s.departureDate;
    if (!s.sold || end <= start) return;
    codes.add(s.accommodationTypeCode);
    if (from === null || start < from) from = start;
    if (to === null || end > to) to = end;
  };
  for (const [stayId, now] of after) {
    const was = before.get(stayId);
    if (was && sameState(was, now)) continue;
    if (was) touch(was);
    touch(now);
  }
  return codes.size > 0 && from !== null && to !== null
    ? { categoryCodes: [...codes].sort(), from, toExclusive: to }
    : null;
}

/**
 * Проживания, отменённые импортом как исчезнувшие из карточки Exely (ADR-050), в записях импорта отсутствуют,
 * и дельта остатков их не видит (ревью 15.09.2026). Дописываем: было продано → не продано; состояние «до»,
 * снятое с базы, не переписывается.
 */
export function withVanished(
  before: Map<string, StayAvailabilityState>,
  after: Map<string, StayAvailabilityState>,
  vanished: ReadonlyArray<{
    exelyRoomStayId: string;
    accommodationTypeCode: string;
    arrivalDate: string;
    departureDate: string;
  }>,
): void {
  for (const v of vanished) {
    const state = {
      accommodationTypeCode: v.accommodationTypeCode,
      arrivalDate: v.arrivalDate,
      departureDate: v.departureDate,
    };
    if (!before.has(v.exelyRoomStayId)) before.set(v.exelyRoomStayId, { ...state, sold: true });
    after.set(v.exelyRoomStayId, { ...state, sold: false });
  }
}
