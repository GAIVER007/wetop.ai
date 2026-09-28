import 'reflect-metadata';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ensureFolioWithAccommodation,
  recordExternalPayment,
  isOverlapViolation,
  type Db,
  type DbTx,
} from '@pms/database';
import { folioBalance, channelPrepaymentToKeep } from '@pms/domain';
import type {
  HousekeepingStatus,
  NightRate,
  ReservationSource,
  ReservationStatus,
  StayRestriction,
} from '@pms/domain';
import { FOREIGN_PROPERTY_MESSAGE, PROPERTY_NOT_SET_UP_MESSAGE } from '../database/property-ref';
import { actsForOrganization, currentOrganizationId } from '../auth/request-context';
import { LUXX_APARTS_PROPERTY, todayAt } from '@pms/domain';
import { maskAuditFreeText, withoutGuestIdentity } from '@pms/shared';
import { PrismaService } from '../database/prisma.provider';
import { cardForAudit, isReservationCard, loadReservationCard, type ReservationCard } from './reservation-card';
import { auditUserId } from '../accounts/actor';

/** Ячейка уже занята на эти ночи — сообщила база (exclusion constraint), не код. */
export class AllocationOverlapError extends Error {
  override readonly name = 'AllocationOverlapError';
  /** unitCode — номер ячейки как его знает администратор; unitId в сообщении читать невозможно */
  constructor(
    readonly unitId: string,
    readonly unitCode?: string,
  ) {
    super(`Ячейка ${unitCode ?? unitId} уже занята на эти ночи`);
  }
}

export interface CategoryRef {
  id: string;
  code: string;
  name: string;
  active: boolean;
  capacityAdults: number;
  /** На объекте у всех 0: детское размещение выключено — гостей-детей на проживании быть не может */
  capacityChildren: number;
}
export type CancellationPenalty = 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY';
/**
 * Без тарифа политику взять неоткуда — не штрафуем (Q-103). Так у всех перенесённых из внешней системы броней,
 * где тариф проживания API не отдаёт: молча выставить им штраф значило бы придумать долг.
 */
export const DEFAULT_CANCELLATION_PENALTY: CancellationPenalty = 'NONE';
export interface RatePlanRef {
  id: string;
  code: string;
  name: string;
  currency: string;
  active: boolean;
  /** Политика штрафа при отмене/незаезде (Q-103) */
  cancellationPenalty: CancellationPenalty;
}
export interface UnitRef {
  id: string;
  code: string;
  accommodationTypeId: string;
  active: boolean;
}
export interface AllocationState {
  id: string;
  unitId: string;
  unitCode: string;
  startDate: string;
  endDate: string;
}
export interface ItemState {
  id: string;
  accommodationTypeId: string;
  arrivalDate: string;
  departureDate: string;
  status: ReservationStatus;
  priceMinor: bigint;
  guestsCount: number;
  /** Тариф проживания (Q-102); null у перенесённых из внешней системы — там тариф на проживании не отдаётся */
  ratePlanId: string | null;
  adults: number;
  children: number;
  /** Политика штрафа тарифа; без тарифа — `DEFAULT_CANCELLATION_PENALTY` (штрафа нет, Q-103) */
  cancellationPenalty: CancellationPenalty;
  allocations: AllocationState[];
}
export interface ReservationState {
  id: string;
  confirmationNumber: string;
  externalId?: string | null;
  status: ReservationStatus;
  arrivalDate: string;
  departureDate: string;
  currency: string;
  items: ItemState[];
}
export interface NewGuest {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string | null;
}
export interface NewReservation {
  confirmationNumber: string;
  source: ReservationSource;
  /** Канал (OTA/сайт) текстом, например Booking.com; null для стойки */
  channel?: string | null;
  /** Номер брони на стороне канала (unique_id Channex) */
  externalId?: string | null;
  status: ReservationStatus;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  totalAmountMinor: bigint;
  primaryGuestId: string;
  notes: string | null;
  items: Array<{
    accommodationTypeId: string;
    /** Тариф проживания (Q-102); null — неизвестен (перенос из внешней системы) */
    ratePlanId?: string | null;
    adults?: number;
    children?: number;
    arrivalDate: string;
    departureDate: string;
    priceMinor: bigint;
    status: ReservationStatus;
  }>;
}
export interface ChannelMappingRef {
  localAccommodationTypeId: string | null;
  localAccommodationTypeCode: string | null;
  localRatePlanId: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}
export type ExternalEventStatus = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
/** Путь доставки входящего события: webhook, опрос ленты, кнопка «Обработать заново» */
export type ExternalEventVia = 'WEBHOOK' | 'PULL' | 'MANUAL';
export interface NewExternalEvent {
  provider: string;
  externalEventId: string;
  type: string;
  payloadHash: string;
  payload: unknown;
  /** Каким путём событие дошло: webhook, опрос ленты или кнопка «Обработать заново» */
  receivedVia?: ExternalEventVia | undefined;
}
export interface ExternalEventRef {
  id: string;
  status: ExternalEventStatus;
  attemptCount: number;
  lastError: string | null;
  isNew: boolean;
}
export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

/** Порт команд ручной брони. Все методы вызываются внутри одной транзакции (UnitOfWork). */
export interface ReservationsRepository {
  /** Сегодня по часам объекта: ночная смена не должна писать вчерашнюю дату (С-13) */
  today(): Promise<string>;
  property(): Promise<{ id: string; currency: string }>;
  categoryByCode(code: string): Promise<CategoryRef | null>;
  /** Активные категории объекта по имени — виджет сайта показывает их все (срез 9) */
  activeCategories(): Promise<CategoryRef[]>;
  categoryById(id: string): Promise<CategoryRef | null>;
  ratePlanByCode(code: string): Promise<RatePlanRef | null>;
  ratePlanById(id: string): Promise<RatePlanRef | null>;
  /** Активные тарифы объекта — для формы брони */
  activeRatePlans(): Promise<RatePlanRef[]>;
  ratePlanCoversType(ratePlanId: string, accommodationTypeId: string): Promise<boolean>;
  nightRates(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    toExclusive: string,
  ): Promise<NightRate[]>;
  unitByCode(code: string): Promise<UnitRef | null>;
  /** Статус уборки ячейки: выезд сам переводит её в «требует уборки» (Q-155, ADR-068) */
  unitHousekeeping(unitId: string): Promise<HousekeepingStatus | null>;
  setUnitHousekeeping(
    unitId: string,
    from: HousekeepingStatus,
    to: HousekeepingStatus,
  ): Promise<void>;
  hasBlockOverlap(unitId: string, from: string, toExclusive: string): Promise<boolean>;
  /**
   * Занята ли ячейка активным проживанием в эти ночи. Проверять НАДО заранее: нарушение
   * `allocations_no_overlap_per_unit` (23P01) обрывает всю транзакцию Postgres, и продолжать в ней нельзя.
   */
  hasAllocationOverlap(
    unitId: string,
    from: string,
    toExclusive: string,
    exceptItemId?: string,
  ): Promise<boolean>;
  /** Первая свободная активная ячейка категории на весь период [from, toExclusive): без проживаний и блокировок (Q-094) */
  firstFreeUnit(
    accommodationTypeId: string,
    from: string,
    toExclusive: string,
  ): Promise<UnitRef | null>;
  /** Все свободные активные ячейки категории на период, по номеру ячейки — для групповой брони на N мест */
  freeUnits(accommodationTypeId: string, from: string, toExclusive: string): Promise<UnitRef[]>;
  /**
   * Блокировка продаж категорий до конца транзакции (pg_advisory_xact_lock), в порядке id — без взаимных
   * блокировок. Места без ячейки не защищены исключением `allocations_no_overlap_per_unit`: без этой
   * блокировки два запроса одновременно продают последнее место категории (Б2).
   */
  lockCategories(typeIds: string[]): Promise<void>;
  /**
   * Замок брони до конца транзакции (pg_advisory_xact_lock). Берётся до чтения её состояния: две одновременные отмены
   * иначе обе проходили проверку «ещё не отменена» и начисляли штраф дважды (аудит 26.09, С-15). Порядок один для всех
   * путей: сначала бронь, потом категории.
   */
  lockReservation(confirmationNumber: string): Promise<void>;
  /** Ограничения продаж (ADR-020) по датам [from, toExclusive) для категории × тарифа; нет строки — нет ограничений */
  restrictionsFor(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    toExclusive: string,
  ): Promise<StayRestriction[]>;
  createGuest(guest: NewGuest): Promise<string>;
  createReservation(input: NewReservation): Promise<{ id: string; itemIds: string[] }>;
  addStayGuest(itemId: string, guestId: string, isPrimary: boolean): Promise<void>;
  createAllocation(
    itemId: string,
    unitId: string,
    startDate: string,
    endDate: string,
  ): Promise<void>;
  reservationByNumber(confirmationNumber: string): Promise<ReservationState | null>;
  updateItem(
    itemId: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      priceMinor: bigint;
      status: ReservationStatus;
      ratePlanId: string;
      accommodationTypeId: string;
      adults: number;
      children: number;
    }>,
  ): Promise<void>;
  updateReservation(
    id: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      status: ReservationStatus;
      totalAmountMinor: bigint;
      externalId: string | null;
      channel: string | null;
      notes: string | null;
      source: ReservationSource;
      adults: number;
      children: number;
    }>,
  ): Promise<void>;
  deleteAllocation(id: string): Promise<void>;
  shortenAllocation(id: string, endDate: string): Promise<void>;
  replaceAllocationDates(id: string, startDate: string, endDate: string): Promise<void>;
  /** Бронь канала по внешнему ID (unique_id Channex) */
  reservationByExternalId(externalId: string): Promise<ReservationState | null>;
  /** Добавить проживание к существующей брони (модификация OTA-брони) */
  addReservationItem(reservationId: string, item: NewReservation['items'][number]): Promise<string>;
  /** Штраф при отмене/незаезде на счёт проживания (Q-103, DATA_MODEL §6) */
  addPenaltyCharge(itemId: string, amountMinor: bigint, description: string): Promise<void>;
  /**
   * Предоплата, собранная каналом (`payment_collect = ota`): гость уже заплатил OTA, на стойке не должен.
   * Идемпотентно по внешней ссылке.
   */
  recordChannelPrepayment(
    itemId: string,
    amountMinor: bigint,
    externalReference: string,
    note: string,
  ): Promise<void>;
  /**
   * Остаток категории за худшую ночь [from, toExclusive): активные ячейки − блокировки − проданные
   * проживания, включая брони без ячейки (Q-107, как считает канал). exceptItemId — не считать своё проживание.
   */
  categoryAvailability(
    typeId: string,
    from: string,
    toExclusive: string,
    exceptItemId?: string,
  ): Promise<number>;
  /** Канал перестал собирать деньги (payment_collect сменился на property) — снять платёж предоплаты */
  voidChannelPrepayment(externalReference: string): Promise<void>;
  /**
   * ADR-022 (Q-108): после отмены или незаезда оставить от предоплаты канала ровно сумму начисленных
   * штрафов на счёте проживания; остальное площадка возвращает гостю сама. Без штрафа платёж снимается.
   */
  settleChannelPrepaymentAfterCancel(itemId: string): Promise<void>;
  /**
   * ADR-021: снять блоки соседних ночей, поставленные доплатой за ранний заезд / поздний выезд этой брони
   * (причина блока заканчивается на «, бронь <номер>»). Возвращает снятые ночи для дельты остатка в канал.
   */
  releaseStayExtraBlocks(
    confirmationNumber: string,
  ): Promise<Array<{ categoryCode: string; from: string; toExclusive: string }>>;
  /** Баланс счёта проживания: начислено − оплачено + возвращено (T3: выселение с долгом) */
  /**
   * Остаток к оплате по счёту проживания. `forUpdate` — сначала блокировка строки счёта, той же, что берут начисления и
   * платежи (`finance.repository`): для выезда, который по этому остатку закрывает счёт (проверка исправлений 26.09).
   */
  stayBalanceMinor(itemId: string, opts?: { forUpdate?: boolean }): Promise<bigint>;
  /** Закрыть счёт проживания: гость рассчитался и уехал (DATA_MODEL §6, Folio.status) */
  closeFolio(itemId: string): Promise<void>;
  /** Маппинг провайдера: категория/тариф ↔ ID провайдера */
  channelMappings(provider: string): Promise<ChannelMappingRef[]>;
  /** Журнал входящих событий (ADR-007): вернуть существующее или создать новое */
  recordExternalEvent(event: NewExternalEvent): Promise<ExternalEventRef>;
  /** Снять потолок попыток у входящего события — по кнопке «Обработать заново» */
  resetExternalEventAttempts(provider: string, externalEventId: string): Promise<void>;
  updateExternalEvent(
    id: string,
    patch: {
      status: ExternalEventStatus;
      lastError?: string | null;
      processedAt?: Date | null;
      /** true — это начало новой попытки обработки: увеличить счётчик попыток */
      countAttempt?: boolean;
    },
  ): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
  card(confirmationNumber: string): Promise<ReservationCard | null>;
}

/** Одна команда = одна транзакция. В тестах подменяется фальшивкой. */
export interface UnitOfWork {
  run<T>(fn: (repo: ReservationsRepository) => Promise<T>): Promise<T>;
  /**
   * Чтение без транзакции — для справочников. Интерактивная транзакция держит соединение пула и при занятом
   * пуле падает через maxWait (P2028 → 500), хотя простому запросу транзакция не нужна.
   */
  read<T>(fn: (repo: ReservationsRepository) => Promise<T>): Promise<T>;
}
export const RESERVATIONS_UOW = Symbol('RESERVATIONS_UOW');

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
// «сегодня» считает today(): по Property.timezone, не по жёсткому UTC+5 (С-13, ТЗ аудита 25.09.2026)
const json = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export class PrismaReservationsRepository implements ReservationsRepository {
  private propertyCache: { id: string; currency: string; timezone: string; organizationId: string } | null = null;
  /** propertyName — имя объекта; в тестах на вымышленных данных передаётся тестовый объект. */
  constructor(
    private readonly db: Db | DbTx,
    private readonly propertyName: string = LUXX_APARTS_PROPERTY.name,
  ) {}

  async property(): Promise<{ id: string; currency: string; timezone: string; organizationId: string }> {
    if (!this.propertyCache) {
      // Мультитенантность: вошедший человек — объект СВОЕЙ организации (по organizationId, имя не
      // участвует); служебный ходок (скрипт, импорт) — единственный объект по имени, как раньше.
      if (actsForOrganization()) {
        const organizationId = currentOrganizationId();
        if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
        const found = await this.db.property.findFirst({
          where: { organizationId },
          select: { id: true, currency: true, timezone: true, organizationId: true },
        });
        if (!found) throw new NotFoundException(PROPERTY_NOT_SET_UP_MESSAGE);
        this.propertyCache = found;
      } else {
        // самый ранний с этим именем — как `propertyRef` (аудит 26.09, С-2)
        const found = await this.db.property.findFirstOrThrow({
          where: { name: this.propertyName },
          orderBy: { createdAt: 'asc' },
          select: { id: true, currency: true, timezone: true, organizationId: true },
        });
        this.propertyCache = found;
      }
    }
    return this.propertyCache;
  }

  async today(): Promise<string> {
    return todayAt((await this.property()).timezone);
  }
  async activeCategories(): Promise<CategoryRef[]> {
    const { id: propertyId } = await this.property();
    return this.db.accommodationType.findMany({
      where: { propertyId, active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        capacityAdults: true,
        capacityChildren: true,
      },
    });
  }
  async categoryByCode(code: string): Promise<CategoryRef | null> {
    const { id: propertyId } = await this.property();
    return this.db.accommodationType.findUnique({
      where: { propertyId_code: { propertyId, code } },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        capacityAdults: true,
        capacityChildren: true,
      },
    });
  }
  async categoryById(id: string): Promise<CategoryRef | null> {
    return this.db.accommodationType.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        capacityAdults: true,
        capacityChildren: true,
      },
    });
  }
  async ratePlanByCode(code: string): Promise<RatePlanRef | null> {
    const { id: propertyId } = await this.property();
    return this.db.ratePlan.findUnique({
      where: { propertyId_code: { propertyId, code } },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        active: true,
        cancellationPenalty: true,
      },
    });
  }
  async ratePlanById(id: string): Promise<RatePlanRef | null> {
    return this.db.ratePlan.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        active: true,
        cancellationPenalty: true,
      },
    });
  }
  async activeRatePlans(): Promise<RatePlanRef[]> {
    const { id: propertyId } = await this.property();
    return this.db.ratePlan.findMany({
      where: { propertyId, active: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        active: true,
        cancellationPenalty: true,
      },
    });
  }
  async ratePlanCoversType(ratePlanId: string, accommodationTypeId: string): Promise<boolean> {
    const link = await this.db.ratePlanAccommodationType.findUnique({
      where: { ratePlanId_accommodationTypeId: { ratePlanId, accommodationTypeId } },
      select: { ratePlanId: true },
    });
    return link !== null;
  }
  async nightRates(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    toExclusive: string,
  ): Promise<NightRate[]> {
    const rows = await this.db.dailyRate.findMany({
      where: {
        accommodationTypeId,
        ratePlanId,
        date: { gte: asDate(from), lt: asDate(toExclusive) },
      },
      select: { date: true, occupancy: true, price: true },
    });
    return rows.map((r) => ({ date: iso(r.date), occupancy: r.occupancy, priceMinor: r.price }));
  }
  async unitHousekeeping(unitId: string): Promise<HousekeepingStatus | null> {
    const u = await this.db.inventoryUnit.findUnique({
      where: { id: unitId },
      select: { housekeepingStatus: true },
    });
    return u?.housekeepingStatus ?? null;
  }
  /** Как PrismaUnitsRepository.setHousekeeping: статус на ячейке плюс запись HousekeepingEvent (DATA_MODEL §4) */
  async setUnitHousekeeping(unitId: string, from: HousekeepingStatus, to: HousekeepingStatus) {
    await this.db.inventoryUnit.update({ where: { id: unitId }, data: { housekeepingStatus: to } });
    await this.db.housekeepingEvent.create({
      data: { inventoryUnitId: unitId, fromStatus: from, toStatus: to },
    });
  }
  async unitByCode(code: string): Promise<UnitRef | null> {
    // только место своего объекта: код уникален внутри объекта (DATA_MODEL v1.12, ADR-099)
    const propertyId = (await this.property()).id;
    return this.db.inventoryUnit.findUnique({
      where: { propertyId_code: { propertyId, code } },
      select: { id: true, code: true, accommodationTypeId: true, active: true },
    });
  }
  async firstFreeUnit(
    accommodationTypeId: string,
    from: string,
    toExclusive: string,
  ): Promise<UnitRef | null> {
    return (await this.freeUnits(accommodationTypeId, from, toExclusive))[0] ?? null;
  }
  async freeUnits(
    accommodationTypeId: string,
    from: string,
    toExclusive: string,
  ): Promise<UnitRef[]> {
    const free = await this.db.inventoryUnit.findMany({
      where: {
        accommodationTypeId,
        active: true,
        // Без фильтра по статусу: ограничение БД тоже его не знает. Ячейка, где по любой причине
        // осталось назначение отменённого проживания, физически занята — предлагать её нельзя.
        allocations: {
          none: { startDate: { lt: asDate(toExclusive) }, endDate: { gt: asDate(from) } },
        },
        blocks: { none: { dateFrom: { lt: asDate(toExclusive) }, dateTo: { gt: asDate(from) } } },
      },
      select: { id: true, code: true, accommodationTypeId: true, active: true },
    });
    // «Первая» — по номеру ячейки как числу (1, 5, 41…), иначе по строке; ничего не выводится из номера
    const num = (c: string) => (/^\d+$/.test(c) ? Number(c) : Number.POSITIVE_INFINITY);
    free.sort((a, b) => num(a.code) - num(b.code) || a.code.localeCompare(b.code));
    return free;
  }
  async lockReservation(confirmationNumber: string): Promise<void> {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pms.reservation:${confirmationNumber}`}, 0))`;
  }
  async lockCategories(typeIds: string[]): Promise<void> {
    // xact-блокировка отпускается сама при COMMIT/ROLLBACK; в одной транзакции повторный вызов не ждёт
    for (const id of [...new Set(typeIds)].sort())
      await this.db
        .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pms.category:${id}`}, 0))`;
  }
  async restrictionsFor(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    toExclusive: string,
  ): Promise<StayRestriction[]> {
    const rows = await this.db.restriction.findMany({
      where: {
        accommodationTypeId,
        ratePlanId,
        date: { gte: asDate(from), lt: asDate(toExclusive) },
      },
      select: {
        date: true,
        minStay: true,
        maxStay: true,
        stopSell: true,
        closedToArrival: true,
        closedToDeparture: true,
      },
    });
    return rows.map((r) => ({ ...r, date: iso(r.date) }));
  }
  async hasAllocationOverlap(
    unitId: string,
    from: string,
    toExclusive: string,
    exceptItemId?: string,
  ): Promise<boolean> {
    const n = await this.db.allocation.count({
      where: {
        inventoryUnitId: unitId,
        startDate: { lt: asDate(toExclusive) },
        endDate: { gt: asDate(from) },
        reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        ...(exceptItemId ? { reservationItemId: { not: exceptItemId } } : {}),
      },
    });
    return n > 0;
  }
  async hasBlockOverlap(unitId: string, from: string, toExclusive: string): Promise<boolean> {
    const n = await this.db.inventoryBlock.count({
      where: {
        inventoryUnitId: unitId,
        dateFrom: { lt: asDate(toExclusive) },
        dateTo: { gt: asDate(from) },
      },
    });
    return n > 0;
  }
  async createGuest(guest: NewGuest): Promise<string> {
    // Гость с рождения знает организацию объекта (Phase 1 ADR-100 §17.2 + RLS-1 v1.13 §17.1):
    // и от стойки (вошедший), и от канала/виджета (служебный путь и organizationScope дают тот же объект).
    const { organizationId } = await this.property();
    const g = await this.db.guest.create({
      data: {
        organizationId,
        firstName: guest.firstName,
        lastName: guest.lastName,
        middleName: guest.middleName ?? null,
        phone: guest.phone ?? null,
        email: guest.email ?? null,
      },
      select: { id: true },
    });
    return g.id;
  }
  async createReservation(input: NewReservation): Promise<{ id: string; itemIds: string[] }> {
    const { id: propertyId } = await this.property();
    const r = await this.db.reservation.create({
      data: {
        propertyId,
        confirmationNumber: input.confirmationNumber,
        source: input.source,
        channel: input.channel ?? null,
        externalId: input.externalId ?? null,
        status: input.status,
        bookedAt: new Date(),
        arrivalDate: asDate(input.arrivalDate),
        departureDate: asDate(input.departureDate),
        adults: input.adults,
        children: input.children,
        currency: input.currency,
        totalAmount: input.totalAmountMinor,
        primaryGuestId: input.primaryGuestId,
        notes: input.notes,
      },
      select: { id: true },
    });
    const itemIds: string[] = [];
    for (const it of input.items) {
      const created = await this.db.reservationItem.create({
        data: {
          reservationId: r.id,
          accommodationTypeId: it.accommodationTypeId,
          ratePlanId: it.ratePlanId ?? null,
          adults: it.adults ?? 1,
          children: it.children ?? 0,
          arrivalDate: asDate(it.arrivalDate),
          departureDate: asDate(it.departureDate),
          price: it.priceMinor,
          status: it.status,
        },
        select: { id: true },
      });
      itemIds.push(created.id);
      await this.syncFolio(created.id);
    }
    return { id: r.id, itemIds };
  }
  async addStayGuest(itemId: string, guestId: string, isPrimary: boolean): Promise<void> {
    await this.db.stayGuest.create({ data: { reservationItemId: itemId, guestId, isPrimary } });
  }
  /**
   * Физическое пересечение назначений на ячейке — ровно то, что запрещает `allocations_no_overlap_per_unit`
   * (EXCLUDE USING gist по inventory_unit_id и daterange). Ограничение не смотрит на статус проживания,
   * поэтому прикладной `hasAllocationOverlap` (он отбрасывает отменённые) для предпроверки слишком мягкий.
   */
  private async unitCode(unitId: string): Promise<string | undefined> {
    const u = await this.db.inventoryUnit
      .findUnique({ where: { id: unitId }, select: { code: true } })
      .catch(() => null);
    return u?.code;
  }
  private async physicalOverlap(
    unitId: string,
    from: string,
    toExclusive: string,
    exceptAllocationId?: string,
  ): Promise<boolean> {
    const n = await this.db.allocation.count({
      where: {
        inventoryUnitId: unitId,
        startDate: { lt: asDate(toExclusive) },
        endDate: { gt: asDate(from) },
        ...(exceptAllocationId ? { id: { not: exceptAllocationId } } : {}),
      },
    });
    return n > 0;
  }
  async createAllocation(
    itemId: string,
    unitId: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    // Пересечение проверяется ДО вставки. Нарушение GiST-ограничения (23P01) обрывает всю транзакцию
    // Postgres: любой следующий запрос в ней падает с 25P02, и восстановиться внутри неё невозможно.
    // Поэтому вызывающий (autoAssign, переселение) должен получить ошибку на живой транзакции.
    if (await this.physicalOverlap(unitId, startDate, endDate))
      throw new AllocationOverlapError(unitId, await this.unitCode(unitId));
    try {
      await this.db.allocation.create({
        data: {
          reservationItemId: itemId,
          inventoryUnitId: unitId,
          startDate: asDate(startDate),
          endDate: asDate(endDate),
        },
      });
    } catch (e) {
      // Сюда попадаем только на гонке двух транзакций: ограничение сработало, транзакция уже прервана,
      // вызывающему остаётся откат — продолжать в ней нельзя.
      if (isOverlapViolation(e))
        throw new AllocationOverlapError(unitId, await this.unitCode(unitId));
      throw e;
    }
  }
  async reservationByNumber(confirmationNumber: string): Promise<ReservationState | null> {
    const { id: propertyId } = await this.property();
    const r = await this.db.reservation.findUnique({
      where: { propertyId_confirmationNumber: { propertyId, confirmationNumber } },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            allocations: {
              orderBy: { startDate: 'asc' },
              include: { inventoryUnit: { select: { code: true } } },
            },
            ratePlan: { select: { cancellationPenalty: true } },
            _count: { select: { stayGuests: true } },
          },
        },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      confirmationNumber: r.confirmationNumber,
      externalId: r.externalId,
      status: r.status,
      arrivalDate: iso(r.arrivalDate),
      departureDate: iso(r.departureDate),
      currency: r.currency,
      items: r.items.map((it) => ({
        id: it.id,
        accommodationTypeId: it.accommodationTypeId,
        arrivalDate: iso(it.arrivalDate),
        departureDate: iso(it.departureDate),
        status: it.status,
        priceMinor: it.price,
        guestsCount: it._count.stayGuests,
        ratePlanId: it.ratePlanId,
        adults: it.adults,
        children: it.children,
        cancellationPenalty: it.ratePlan?.cancellationPenalty ?? DEFAULT_CANCELLATION_PENALTY,
        allocations: it.allocations.map((a) => ({
          id: a.id,
          unitId: a.inventoryUnitId,
          unitCode: a.inventoryUnit.code,
          startDate: iso(a.startDate),
          endDate: iso(a.endDate),
        })),
      })),
    };
  }
  async updateItem(
    itemId: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      priceMinor: bigint;
      status: ReservationStatus;
      ratePlanId: string;
      accommodationTypeId: string;
      adults: number;
      children: number;
    }>,
  ): Promise<void> {
    await this.db.reservationItem.update({
      where: { id: itemId },
      data: {
        ...(patch.arrivalDate !== undefined ? { arrivalDate: asDate(patch.arrivalDate) } : {}),
        ...(patch.departureDate !== undefined
          ? { departureDate: asDate(patch.departureDate) }
          : {}),
        ...(patch.priceMinor !== undefined ? { price: patch.priceMinor } : {}),
        ...(patch.ratePlanId !== undefined ? { ratePlanId: patch.ratePlanId } : {}),
        ...(patch.accommodationTypeId !== undefined
          ? { accommodationTypeId: patch.accommodationTypeId }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.adults !== undefined ? { adults: patch.adults } : {}),
        ...(patch.children !== undefined ? { children: patch.children } : {}),
      },
    });
    await this.syncFolio(itemId);
  }
  /**
   * Счёт проживания (DATA_MODEL §6): создаётся вместе с проживанием, начисление «проживание» = цене,
   * переписывается при изменении цены/дат, сторнируется при отмене и незаезде.
   */
  private async syncFolio(itemId: string): Promise<void> {
    const it = await this.db.reservationItem.findUniqueOrThrow({
      where: { id: itemId },
      select: {
        price: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
        reservation: { select: { currency: true } },
      },
    });
    await ensureFolioWithAccommodation(this.db, {
      reservationItemId: itemId,
      currency: it.reservation.currency,
      amountMinor: it.price,
      description: `Проживание ${iso(it.arrivalDate)} → ${iso(it.departureDate)}`,
      serviceDate: iso(it.arrivalDate),
      active: it.status !== 'CANCELLED' && it.status !== 'NO_SHOW',
    });
  }
  async updateReservation(
    id: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      status: ReservationStatus;
      totalAmountMinor: bigint;
      externalId: string | null;
      channel: string | null;
      notes: string | null;
      source: ReservationSource;
      adults: number;
      children: number;
    }>,
  ): Promise<void> {
    await this.db.reservation.update({
      where: { id },
      data: {
        ...(patch.arrivalDate !== undefined ? { arrivalDate: asDate(patch.arrivalDate) } : {}),
        ...(patch.departureDate !== undefined
          ? { departureDate: asDate(patch.departureDate) }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.totalAmountMinor !== undefined ? { totalAmount: patch.totalAmountMinor } : {}),
        ...(patch.externalId !== undefined ? { externalId: patch.externalId } : {}),
        ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(patch.adults !== undefined ? { adults: patch.adults } : {}),
        ...(patch.children !== undefined ? { children: patch.children } : {}),
      },
    });
  }
  async deleteAllocation(id: string): Promise<void> {
    await this.db.allocation.delete({ where: { id } });
  }
  async shortenAllocation(id: string, endDate: string): Promise<void> {
    await this.db.allocation.update({ where: { id }, data: { endDate: asDate(endDate) } });
  }
  async replaceAllocationDates(id: string, startDate: string, endDate: string): Promise<void> {
    const current = await this.db.allocation.findUnique({
      where: { id },
      select: { inventoryUnitId: true, inventoryUnit: { select: { code: true } } },
    });
    if (!current) throw new Error(`Назначение ${id} не найдено`);
    const code = current.inventoryUnit.code;
    // Предпроверка до UPDATE — по той же причине, что и в createAllocation: после 23P01 транзакция мертва,
    // а вызывающий (модификация брони из канала) обязан суметь снять назначение и переселить в той же транзакции.
    if (await this.physicalOverlap(current.inventoryUnitId, startDate, endDate, id))
      throw new AllocationOverlapError(current.inventoryUnitId, code);
    try {
      await this.db.allocation.update({
        where: { id },
        data: { startDate: asDate(startDate), endDate: asDate(endDate) },
      });
    } catch (e) {
      // Гонка: транзакция прервана ограничением, продолжать в ней нельзя.
      if (isOverlapViolation(e)) throw new AllocationOverlapError(current.inventoryUnitId, code);
      throw e;
    }
  }
  async reservationByExternalId(externalId: string): Promise<ReservationState | null> {
    const { id: propertyId } = await this.property();
    const r = await this.db.reservation.findFirst({
      where: { propertyId, externalId },
      orderBy: { createdAt: 'desc' },
      select: { confirmationNumber: true },
    });
    return r ? this.reservationByNumber(r.confirmationNumber) : null;
  }
  async recordChannelPrepayment(
    itemId: string,
    amountMinor: bigint,
    externalReference: string,
    note: string,
  ): Promise<void> {
    const folio = await this.db.folio.findUnique({
      where: { reservationItemId: itemId },
      select: { id: true, currency: true },
    });
    if (!folio) return;
    const { id: propertyId } = await this.property();
    // Ревизия могла пересобрать состав комнат: тот же платёж канала теперь относится к другому счёту.
    // Старые распределения снимаются, иначе одна сумма закрыла бы сразу два счёта.
    const existing = await this.db.payment.findUnique({
      where: { propertyId_externalReference: { propertyId, externalReference } },
      select: { id: true, status: true },
    });
    // журнал (SECURITY.md §6): что было на этом счёте от того же платежа канала — до правки
    const prior = existing
      ? await this.db.paymentAllocation.findUnique({
          where: { paymentId_folioId: { paymentId: existing.id, folioId: folio.id } },
          select: { amount: true },
        })
      : null;
    if (existing) {
      await this.db.paymentAllocation.deleteMany({
        where: { paymentId: existing.id, folioId: { not: folio.id } },
      });
      if (existing.status === 'VOIDED')
        await this.db.payment.update({ where: { id: existing.id }, data: { status: 'COMPLETED' } });
    }
    await recordExternalPayment(this.db, {
      propertyId,
      folioId: folio.id,
      externalReference,
      amountMinor,
      currency: folio.currency,
      note,
    });
    // recordExternalPayment пропускает запись, если сумма не изменилась — распределение на новый счёт
    // при этом не появилось бы. Досоздаём явно.
    if (existing) {
      await this.db.paymentAllocation.upsert({
        where: { paymentId_folioId: { paymentId: existing.id, folioId: folio.id } },
        create: { paymentId: existing.id, folioId: folio.id, amount: amountMinor },
        update: { amount: amountMinor },
      });
    }
    // Платёж без человека — предоплата канала — пишется в журнал, как платёж со стойки (SECURITY.md §6).
    // Повтор той же ревизии с той же суммой ничего не меняет и строки не даёт
    if (!existing || existing.status !== 'COMPLETED' || prior?.amount !== amountMinor)
      await this.audit({
        entityType: 'Folio',
        entityId: folio.id,
        action: 'folio.channelPrepayment',
        ...(existing
          ? {
              before: {
                status: existing.status,
                amountMinor: prior ? prior.amount.toString() : '0',
                externalReference,
              },
            }
          : {}),
        after: { status: 'COMPLETED', amountMinor: amountMinor.toString(), externalReference },
      });
  }
  async categoryAvailability(
    typeId: string,
    from: string,
    toExclusive: string,
    exceptItemId?: string,
  ): Promise<number> {
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    const [units, blocks, sold] = await Promise.all([
      this.db.inventoryUnit.count({ where: { accommodationTypeId: typeId, active: true } }),
      this.db.inventoryBlock.findMany({
        where: {
          inventoryUnit: { accommodationTypeId: typeId },
          dateFrom: { lt: asDate(toExclusive) },
          dateTo: { gt: asDate(from) },
        },
        select: { dateFrom: true, dateTo: true },
      }),
      this.db.reservationItem.findMany({
        where: {
          accommodationTypeId: typeId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          arrivalDate: { lt: asDate(toExclusive) },
          departureDate: { gt: asDate(from) },
          ...(exceptItemId ? { id: { not: exceptItemId } } : {}),
        },
        select: { arrivalDate: true, departureDate: true },
      }),
    ]);
    let left = Number.POSITIVE_INFINITY;
    for (let d = from; d < toExclusive;) {
      const blocked = blocks.filter((b) => iso(b.dateFrom) <= d && d < iso(b.dateTo)).length;
      const taken = sold.filter((s) => iso(s.arrivalDate) <= d && d < iso(s.departureDate)).length;
      left = Math.min(left, units - blocked - taken);
      const next = new Date(`${d}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      d = next.toISOString().slice(0, 10);
    }
    return Number.isFinite(left) ? Math.max(0, left) : units;
  }
  async releaseStayExtraBlocks(
    confirmationNumber: string,
  ): Promise<Array<{ categoryCode: string; from: string; toExclusive: string }>> {
    const blocks = await this.db.inventoryBlock.findMany({
      where: { type: 'OTHER', reason: { endsWith: `, бронь ${confirmationNumber}` } },
      select: {
        id: true,
        dateFrom: true,
        dateTo: true,
        inventoryUnit: { select: { accommodationType: { select: { code: true } } } },
      },
    });
    if (!blocks.length) return [];
    await this.db.inventoryBlock.deleteMany({ where: { id: { in: blocks.map((b) => b.id) } } });
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return blocks.map((b) => ({
      categoryCode: b.inventoryUnit.accommodationType.code,
      from: iso(b.dateFrom),
      toExclusive: iso(b.dateTo),
    }));
  }
  async settleChannelPrepaymentAfterCancel(itemId: string): Promise<void> {
    const folio = await this.db.folio.findUnique({
      where: { reservationItemId: itemId },
      select: {
        id: true,
        charges: { where: { kind: 'PENALTY', voidedAt: null }, select: { amount: true } },
        allocations: {
          where: { payment: { method: 'EXTERNAL', status: 'COMPLETED' } },
          select: {
            amount: true,
            paymentId: true,
            payment: { select: { externalReference: true } },
          },
        },
      },
    });
    if (!folio) return;
    const penalty = folio.charges.reduce((s, c) => s + c.amount, 0n);
    for (const a of folio.allocations) {
      if (!a.payment.externalReference?.startsWith('channex:')) continue;
      const keep = channelPrepaymentToKeep({ prepaidMinor: a.amount, penaltyMinor: penalty });
      if (keep === a.amount) continue;
      const key = { paymentId_folioId: { paymentId: a.paymentId, folioId: folio.id } };
      if (keep === 0n) {
        await this.db.paymentAllocation.delete({ where: key });
        await this.db.payment.update({ where: { id: a.paymentId }, data: { status: 'VOIDED' } });
      } else {
        await this.db.paymentAllocation.update({ where: key, data: { amount: keep } });
        await this.db.payment.update({ where: { id: a.paymentId }, data: { amount: keep } });
      }
      // ADR-022: от предоплаты остаётся штраф, остальное площадка возвращает гостю — в журнал с суммами
      await this.audit({
        entityType: 'Folio',
        entityId: folio.id,
        action: keep === 0n ? 'folio.channelPrepayment.void' : 'folio.channelPrepayment.reduce',
        before: {
          amountMinor: a.amount.toString(),
          externalReference: a.payment.externalReference,
        },
        after: {
          amountMinor: keep.toString(),
          penaltyMinor: penalty.toString(),
          externalReference: a.payment.externalReference,
        },
      });
    }
  }
  async voidChannelPrepayment(externalReference: string): Promise<void> {
    const { id: propertyId } = await this.property();
    const p = await this.db.payment.findUnique({
      where: { propertyId_externalReference: { propertyId, externalReference } },
      select: { id: true, status: true },
    });
    if (!p || p.status === 'VOIDED') return;
    const allocations = await this.db.paymentAllocation.findMany({
      where: { paymentId: p.id },
      select: { folioId: true, amount: true },
    });
    await this.db.paymentAllocation.deleteMany({ where: { paymentId: p.id } });
    await this.db.payment.update({ where: { id: p.id }, data: { status: 'VOIDED' } });
    // Канал снял предоплату — по строке журнала на каждый счёт, где она стояла (SECURITY.md §6)
    for (const a of allocations)
      await this.audit({
        entityType: 'Folio',
        entityId: a.folioId,
        action: 'folio.channelPrepayment.void',
        before: { status: p.status, amountMinor: a.amount.toString(), externalReference },
        after: { status: 'VOIDED', amountMinor: '0', externalReference },
      });
  }
  async closeFolio(itemId: string): Promise<void> {
    await this.db.folio.updateMany({
      where: { reservationItemId: itemId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
  async stayBalanceMinor(itemId: string, opts: { forUpdate?: boolean } = {}): Promise<bigint> {
    if (opts.forUpdate)
      await this.db.$queryRaw`
        SELECT "id" FROM "folios" WHERE "reservation_item_id" = ${itemId}::uuid FOR UPDATE`;
    const folio = await this.db.folio.findUnique({
      where: { reservationItemId: itemId },
      select: {
        charges: { select: { amount: true, voidedAt: true } },
        allocations: { select: { amount: true, payment: { select: { status: true } } } },
        refunds: { select: { amount: true } },
      },
    });
    if (!folio) return 0n;
    return folioBalance({
      charges: folio.charges.map((c) => ({ amountMinor: c.amount, voided: c.voidedAt !== null })),
      allocations: folio.allocations
        .filter((a) => a.payment.status === 'COMPLETED')
        .map((a) => ({ amountMinor: a.amount })),
      refunds: folio.refunds.map((r) => ({ amountMinor: r.amount })),
    }).balanceMinor;
  }
  /** Штраф — начисление PENALTY на счёт проживания; счёт уже создан вместе с проживанием (DATA_MODEL §6) */
  async addPenaltyCharge(itemId: string, amountMinor: bigint, description: string): Promise<void> {
    const folio = await this.db.folio.findUnique({
      where: { reservationItemId: itemId },
      select: { id: true },
    });
    if (!folio) return;
    const charge = await this.db.charge.create({
      data: {
        folioId: folio.id,
        kind: 'PENALTY',
        description,
        quantity: 1,
        unitPrice: amountMinor,
        amount: amountMinor,
        serviceDate: new Date(`${await this.today()}T00:00:00Z`),
      },
      select: { id: true },
    });
    // Штраф отмены и незаезда начисляет система — в журнал, как ручное начисление (SECURITY.md §6)
    await this.audit({
      entityType: 'Folio',
      entityId: folio.id,
      action: 'folio.penalty',
      after: { chargeId: charge.id, amountMinor: amountMinor.toString(), description },
    });
  }
  async addReservationItem(
    reservationId: string,
    it: NewReservation['items'][number],
  ): Promise<string> {
    const created = await this.db.reservationItem.create({
      data: {
        reservationId,
        accommodationTypeId: it.accommodationTypeId,
        ratePlanId: it.ratePlanId ?? null,
        adults: it.adults ?? 1,
        children: it.children ?? 0,
        arrivalDate: asDate(it.arrivalDate),
        departureDate: asDate(it.departureDate),
        price: it.priceMinor,
        status: it.status,
      },
      select: { id: true },
    });
    await this.syncFolio(created.id);
    return created.id;
  }
  async channelMappings(provider: string): Promise<ChannelMappingRef[]> {
    const { id: propertyId } = await this.property();
    const rows = await this.db.channelMapping.findMany({
      where: { propertyId, provider },
      include: { accommodationType: { select: { code: true } } },
    });
    return rows.map((r) => ({
      localAccommodationTypeId: r.localAccommodationTypeId,
      localAccommodationTypeCode: r.accommodationType?.code ?? null,
      localRatePlanId: r.localRatePlanId,
      providerPropertyId: r.providerPropertyId,
      providerRoomTypeId: r.providerRoomTypeId,
      providerRatePlanId: r.providerRatePlanId,
    }));
  }
  async recordExternalEvent(event: NewExternalEvent): Promise<ExternalEventRef> {
    const existing = await this.db.externalEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: event.provider,
          externalEventId: event.externalEventId,
        },
      },
      select: { id: true, status: true, attemptCount: true, lastError: true },
    });
    if (existing) return { ...existing, isNew: false };
    // Phase 1 изоляции (ADR-100 §17.2): событие канала с рождения знает объект обработки
    const { id: propertyId } = await this.property();
    const created = await this.db.externalEvent.create({
      data: {
        provider: event.provider,
        externalEventId: event.externalEventId,
        type: event.type,
        payloadHash: event.payloadHash,
        payload: json(event.payload),
        propertyId,
        ...(event.receivedVia ? { receivedVia: event.receivedVia } : {}),
      },
      select: { id: true, status: true, attemptCount: true, lastError: true },
    });
    return { ...created, isNew: true };
  }
  async resetExternalEventAttempts(provider: string, externalEventId: string): Promise<void> {
    await this.db.externalEvent.updateMany({
      where: { provider, externalEventId },
      data: { attemptCount: 0, status: 'RECEIVED', lastError: null },
    });
  }
  async updateExternalEvent(
    id: string,
    patch: {
      status: ExternalEventStatus;
      lastError?: string | null;
      processedAt?: Date | null;
      countAttempt?: boolean;
    },
  ): Promise<void> {
    await this.db.externalEvent.update({
      where: { id },
      data: {
        status: patch.status,
        // Попытка считается один раз на обработку (ADR-007), а не на каждую смену статуса
        ...(patch.countAttempt ? { attemptCount: { increment: 1 } } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.processedAt !== undefined ? { processedAt: patch.processedAt } : {}),
      },
    });
  }
  async audit(entry: AuditEntry): Promise<void> {
    // В-5 (ТЗ аудита 25.09.2026): карточка в журнале — без ФИО, телефон маской. Остальное — без данных гостя под его
    // ключами, и в свободном тексте (заметка, комментарий, причина) контакты под маской: журнал только дописывается
    const forJournal = (v: unknown) =>
      isReservationCard(v) ? maskAuditFreeText(cardForAudit(v)) : withoutGuestIdentity(v);
    // Phase 1 изоляции (ADR-100 §17.2): служебные записи (синхронизация, вебхук) тоже несут
    // организацию объекта — иначе они копили бы NULL-остаток, который уже разбирал backfill
    const { organizationId } = await this.property();
    await this.db.auditLog.create({
      data: {
        userId: auditUserId(),
        organizationId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: json(forJournal(entry.before)),
        after: json(forJournal(entry.after)),
      },
    });
  }
  async card(confirmationNumber: string): Promise<ReservationCard | null> {
    const { id: propertyId } = await this.property();
    return loadReservationCard(this.db, propertyId, confirmationNumber);
  }
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  run<T>(fn: (repo: ReservationsRepository) => Promise<T>): Promise<T> {
    return this.prisma.db.$transaction((tx) => fn(new PrismaReservationsRepository(tx)), {
      timeout: 60_000,
      maxWait: 10_000,
    });
  }
  read<T>(fn: (repo: ReservationsRepository) => Promise<T>): Promise<T> {
    return fn(new PrismaReservationsRepository(this.prisma.db));
  }
}
