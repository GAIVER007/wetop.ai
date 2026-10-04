import 'reflect-metadata';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  RATE_PLAN_CHANGE_MESSAGE,
  RATE_PLAN_SOFT_MESSAGE,
  RESERVATION_SOURCES,
  ReservationRuleError,
  RestrictionViolationError,
  assertCanAssign,
  assertRestrictionsAllow,
  assertCanCancel,
  assertCanChangeDates,
  assertCanCheckIn,
  assertCanCheckOut,
  assertCanNoShow,
  confirmationNumber,
  deriveReservationStatus,
  priceStay,
  type ReservationSource,
  type ReservationStatus,
  penaltyAmount,
  penaltyDue,
  assertCanExtend,
  hasCitizenship,
  mayAssignPlanWithoutRates,
  assertDerivedRuleAllows,
  assertPromoAllows,
  normalizePromoCode,
} from '@pms/domain';
import { channex } from '@pms/integrations';
import { deskGuestForStorage, freeTextForStorage } from '@pms/shared';
import { actorMay } from '../auth/request-context';
import { ARI_PUBLISHER, publishAfterCommit, type AriPublisher } from '../channels/ari-publisher';
import { cardStays, stayDelta } from '../channels/ari-ranges';
import type { ReservationCard } from './reservation-card';
import {
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ItemState,
  type PromoRef,
  type RatePlanRef,
  type ReservationsRepository,
  type UnitOfWork,
  type UnitRef,
} from './reservations.repository';

export interface ReservationQuote {
  arrivalDate: string;
  departureDate: string;
  totalMinor: string;
  currency: string;
  /** Цена каждой ночи по всей брони (все места вместе): «Детализация цены по дням» в форме */
  nights: Array<{ date: string; priceMinor: string }>;
}

export interface CreateReservationDto {
  creationKey?: string;
  expectedTotalMinor?: string;
  /** Промокод (DATA_MODEL §20): один на бронь, скидка действует на все проживания */
  promoCode?: string | null | undefined;
  source?: string;
  /** ADR-071: для источника OTA — канал (любое написание имени канала объекта) */
  channel?: string | null;
  /** ADR-071: для источника OTA — номер брони в канале, как в экстранете; пробелы убираются */
  externalId?: string | null;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string | null;
  /**
   * G6 (ТЗ «Гости v2» §33): бронь существующему гостю — только своей организации, без полей `guest`.
   * Нового гостя тогда не создаётся: бронь и все её проживания получают этого гостя главным.
   */
  guestId?: string | null;
  guest?: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items?: Array<{
    accommodationTypeCode?: string;
    ratePlanCode?: string;
    adults?: number;
    unitCode?: string | null;
    /**
     * Групповая бронь: N мест в категории → N проживаний, первые N свободных ячеек по номеру.
     * По умолчанию 1; вместе с `unitCode` не сочетается (при N>1 ячейки назначает система).
     */
    quantity?: number;
    /**
     * Виджет сайта (срез 9): без выбора ячейки назначить первую свободную, как у канала (Q-094);
     * нет свободной — бронь без ячейки, стойка назначит. Вместе с `unitCode` не сочетается.
     */
    autoAssign?: boolean;
  }>;
}
/** Правка шапки готовой брони: заметки и источник. Оба поля необязательны, но хотя бы одно нужно. */
export interface UpdateReservationDto {
  notes?: string | null;
  source?: string;
  /** ADR-071: канал и номер брони в канале — только у брони с источником OTA; null стирает */
  channel?: string | null;
  externalId?: string | null;
}

/**
 * ADR-071: канал и номер брони в канале у ручной брони OTA. Номер — как в экстранете, пробелы убираются: по нему
 * приём ревизий Channex найдёт эту бронь, когда канал подключат (шаг 2 — `ota_reservation_code`). Канал хранится
 * каноническим именем. У другого источника ни того ни другого быть не может.
 */
function channelBooking(
  source: string,
  dto: { channel?: string | null | undefined; externalId?: string | null | undefined },
  required: boolean,
): { channel?: string | null; externalId?: string | null } {
  const given = dto.channel != null || dto.externalId != null;
  if (source !== 'OTA') {
    if (given)
      throw new BadRequestException(
        'Канал и номер брони в канале указываются только у брони с источником OTA',
      );
    return {};
  }
  const out: { channel?: string | null; externalId?: string | null } = {};
  if (dto.channel !== undefined || required) {
    const raw = (dto.channel ?? '').trim();
    if (!raw) {
      if (required)
        throw new BadRequestException('channel обязателен для брони OTA: канал, где бронь сделана');
      out.channel = null;
    } else {
      if (!channex.KNOWN_CHANNEL_KEYS.has(channex.otaChannelKey(raw)))
        throw new BadRequestException(`Канал «${raw}» у объекта не подключён`);
      out.channel = channex.otaChannelLabel(raw);
    }
  }
  if (dto.externalId !== undefined || required) {
    const number = (dto.externalId ?? '').replace(/\s+/g, '');
    if (!number) {
      if (required)
        throw new BadRequestException(
          'externalId обязателен для брони OTA: номер брони в канале из экстранета',
        );
      out.externalId = null;
    } else {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(number))
        throw new BadRequestException(
          'externalId — номер брони в канале: от 3 символов, латиница, цифры, точка, дефис',
        );
      out.externalId = number;
    }
  }
  return out;
}
/** Гостей на проживании (Q-102). Цена не пересчитывается: перецена — через «Изменить даты». */
export interface UpdateItemDto {
  adults?: number;
  children?: number;
}
export interface ChangeDatesDto {
  arrivalDate?: string;
  departureDate?: string;
  ratePlanCode?: string;
}
export interface AssignUnitDto {
  unitCode?: string;
  fromDate?: string;
  /** Тариф для пересчёта при переселении в другую категорию; по умолчанию тариф проживания (Q-102) */
  ratePlanCode?: string;
}

/**
 * Ответ предпросмотра действия (срез 7.3, Д5). Деньги — строки тиынов (ADR-008). Поля зависят от
 * действия: у переселения и продления — цена после и разница, у отмены и незаезда — штраф и политика.
 */
export interface ActionPreview {
  action: 'move' | 'extend' | 'cancel' | 'no_show';
  currentPriceMinor: string;
  currency: string;
  newPriceMinor?: string;
  differenceMinor?: string;
  /** переселение: меняется ли категория — только тогда цена пересчитывается */
  changesCategory?: boolean;
  unitCode?: string;
  categoryName?: string;
  /** продление: сколько ночей и какой выезд получится */
  nights?: number;
  departureDate?: string;
  /** отмена и незаезд: штраф по политике тарифа и сколько сторнируется */
  penaltyMinor?: string;
  policy?: string;
  voidedMinor?: string;
}
/** Предпросмотр переселения (срез 7.3, Д5): суммы строками тиынов, `problem` — почему переселить нельзя */
export interface MovePreview {
  unitCode: string;
  changesCategory: boolean;
  fromCategory: { code: string; name: string } | null;
  toCategory: { code: string; name: string } | null;
  nights: number;
  currentMinor: string;
  newMinor: string | null;
  ratePlanRequired: boolean;
  problem: string | null;
}
export interface ExtendPreview {
  nights: number;
  departureDate: string;
  unitCode: string | null;
  addedMinor: string | null;
  newMinor: string | null;
  ratePlanRequired: boolean;
  /** Ячейка свободна на добавленные ночи (без брони и блокировки); без ячейки — true */
  nextNightsFree: boolean;
  problem: string | null;
}
export interface CancelPreview {
  reason: 'cancel' | 'no_show';
  items: Array<{
    itemId: string;
    unitCode: string | null;
    policy: ItemState['cancellationPenalty'];
    /** Наступил ли момент штрафа (Q-103): отмена до дня заезда бесплатна */
    dueNow: boolean;
    penaltyMinor: string;
  }>;
  totalPenaltyMinor: string;
}
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const nightsBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s: unknown): s is string =>
  typeof s === 'string' &&
  ISO.test(s) &&
  !s.startsWith('0000-') &&
  Number.isFinite(Date.parse(s)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Нарушение правила брони (домен) → 422; пересечение ячеек (база) → 409. */
/** Дата + n суток, YYYY-MM-DD в часах объекта (даты проживания — DATE, без времени). */
function addDays(date: string, n: number): string {
  const x = new Date(`${date}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Сумма в тиынах → «12 000,00 ₸» для сообщения администратору. */
function formatMinorRu(minor: bigint): string {
  const neg = minor < 0n;
  const d = (neg ? -minor : minor).toString().padStart(3, '0');
  const int = d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${int},${d.slice(-2)} ₸`;
}

async function guarded<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // Ограничение продаж (ADR-020) — конфликт с календарём, как занятая ячейка: 409, не 422
    if (e instanceof RestrictionViolationError) throw new ConflictException(e.message);
    if (e instanceof ReservationRuleError) throw new UnprocessableEntityException(e.message);
    if (e instanceof AllocationOverlapError) throw new ConflictException(e.message);
    throw e;
  }
}

/** Гостей на проживании против вместимости категории — одна проверка для создания и правки. */
function assertFits(
  type: { name: string; capacityAdults: number; capacityChildren: number },
  adults: number,
  children: number,
): void {
  if (adults > type.capacityAdults)
    throw new UnprocessableEntityException(
      `Категория ${type.name}: вместимость ${type.capacityAdults}, запрошено ${adults}`,
    );
  if (children > type.capacityChildren)
    throw new UnprocessableEntityException(
      type.capacityChildren === 0
        ? `Категория ${type.name}: детское размещение не предусмотрено`
        : `Категория ${type.name}: детей не больше ${type.capacityChildren}, запрошено ${children}`,
    );
}

function requireStayDates(
  arrival: unknown,
  departure: unknown,
): { arrivalDate: string; departureDate: string } {
  if (!isIso(arrival) || !isIso(departure) || departure <= arrival)
    throw new BadRequestException(
      'Введите корректные даты: дата выезда должна быть позже даты заезда',
    );
  return { arrivalDate: arrival, departureDate: departure };
}

const GUEST_NOT_FOUND = 'Гость не найден';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * G6 (ТЗ «Гости v2» §33): `guestId` — бронь существующему гостю вместо нового. Вместе с полями `guest`
 * не принимается: непонятно, кого имели в виду. Сайт своего гостя приносит всегда (`guestPrepared`),
 * чужой `guestId` на этом пути — ошибка вызывающего. Не uuid — такого гостя нет, как и чужого.
 */
function existingGuest(
  dto: CreateReservationDto,
  opts: { guestPrepared?: boolean },
): string | null {
  if (dto.guestId === undefined || dto.guestId === null) return null;
  if (opts.guestPrepared)
    throw new BadRequestException('guestId: бронь с сайта заводит своего гостя');
  if (typeof dto.guestId !== 'string' || dto.guestId.trim() === '')
    throw new BadRequestException('guestId — идентификатор гостя строкой');
  if (dto.guest !== undefined && dto.guest !== null)
    throw new BadRequestException(
      'Укажите либо guestId существующего гостя, либо поля guest нового — не оба сразу',
    );
  const id = dto.guestId.trim();
  if (!UUID.test(id)) throw new NotFoundException(GUEST_NOT_FOUND);
  return id;
}

@Injectable()
export class ReservationsService {
  constructor(
    @Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  /**
   * После коммита: дельта доступности в каналы — только ночи, где у брони поменялось число занятых мест
   * категории (карточка до → после). Ночи, остаток которых команда не меняла, не уходят: Channex требует слать
   * только изменения (сертификация §13), а перенос на неделю иначе уносит в канал всю неделю между датами.
   */
  private async publish(
    before: ReservationCard | null,
    after: ReservationCard | null,
  ): Promise<void> {
    const delta = stayDelta(cardStays(before), cardStays(after));
    if (delta) await publishAfterCommit(this.publisher, delta);
  }

  /**
   * Активные тарифы (справочник для формы). Без транзакции: занятый пул не превращает справочник в 500.
   * Правило штрафа — чтобы стойка показала администратору только тарифы, которые он может назначить брони без
   * тарифа (Q-201).
   */
  ratePlans(): Promise<
    Array<{
      code: string;
      name: string;
      currency: string;
      cancellationPenalty: RatePlanRef['cancellationPenalty'];
    }>
  > {
    return this.uow.read(async (repo) =>
      (await repo.activeRatePlans()).map((p) => ({
        code: p.code,
        name: p.name,
        currency: p.currency,
        cancellationPenalty: p.cancellationPenalty,
      })),
    );
  }

  /**
   * Создать бронь со стойки: источник обязателен (Q-089), цена — из календаря, ячейка — по желанию.
   * Гость — через `deskGuestForStorage` (ADR-072): пока база не в Казахстане, введённое стойкой не сохраняется,
   * гость записывается псевдонимом, и имя не обязательно. `guestPrepared` — гость уже приведён к хранению
   * вызывающим (бронь с сайта: `guestForStorage`), берётся как есть.
   */
  create(dto: CreateReservationDto, opts: { preview: true }): Promise<ReservationQuote>;
  create(dto: CreateReservationDto, opts?: { guestPrepared?: boolean }): Promise<ReservationCard>;
  async create(
    dto: CreateReservationDto,
    opts: { guestPrepared?: boolean; preview?: boolean } = {},
  ): Promise<ReservationCard | ReservationQuote> {
    const key = dto.creationKey;
    if (
      key !== undefined &&
      (typeof key !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    )
      throw new BadRequestException('Обновите форму: некорректный ключ создания');
    if (
      dto.expectedTotalMinor !== undefined &&
      (typeof dto.expectedTotalMinor !== 'string' || !/^\d+$/.test(dto.expectedTotalMinor))
    )
      throw new BadRequestException('Обновите расчёт стоимости');
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([, v]) => v !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, canonical(v)]),
            )
          : value;
    const fingerprint = key
      ? createHash('sha256')
          .update(JSON.stringify(canonical({ ...dto, creationKey: key.toLowerCase() })))
          .digest('hex')
      : null;
    let replay = false;
    if (!dto.source || !(RESERVATION_SOURCES as readonly string[]).includes(dto.source))
      throw new BadRequestException(`source обязателен: один из ${RESERVATION_SOURCES.join(', ')}`);
    const source = dto.source as ReservationSource;
    const booking = channelBooking(source, dto, true);
    const dates = requireStayDates(dto.arrivalDate, dto.departureDate);
    const existingGuestId = existingGuest(dto, opts);
    const guest =
      existingGuestId || opts.preview
        ? null
        : opts.guestPrepared
          ? {
              firstName: (dto.guest?.firstName ?? '').trim(),
              lastName: (dto.guest?.lastName ?? '').trim(),
              middleName: dto.guest?.middleName ?? null,
              phone: dto.guest?.phone ?? null,
              email: dto.guest?.email ?? null,
            }
          : deskGuestForStorage(dto.guest ?? {});
    if (guest && (!guest.firstName || !guest.lastName))
      throw new BadRequestException('guest.firstName и guest.lastName обязательны');
    if (!Array.isArray(dto.items) || dto.items.length === 0)
      throw new BadRequestException('items: хотя бы одно проживание');
    for (const it of dto.items) {
      if (!it.accommodationTypeCode || !it.ratePlanCode)
        throw new BadRequestException('items[].accommodationTypeCode и ratePlanCode обязательны');
      if (!Number.isInteger(it.adults) || (it.adults as number) < 1)
        throw new BadRequestException('items[].adults — целое ≥ 1');
      if (it.quantity !== undefined && (!Number.isInteger(it.quantity) || it.quantity < 1))
        throw new BadRequestException('items[].quantity — целое ≥ 1 (число мест в категории)');
      if ((it.quantity ?? 1) > 1 && it.unitCode)
        throw new BadRequestException(
          'items[].unitCode задаётся только для одного места: при quantity > 1 ячейки назначает система',
        );
      if (it.autoAssign && it.unitCode)
        throw new BadRequestException('items[].autoAssign и unitCode не сочетаются');
    }
    const status: ReservationStatus = 'CONFIRMED';

    const created = await this.uow.run((repo) =>
      guarded(async () => {
        if (key && !opts.preview) {
          const property = await repo.property();
          await repo.lockReservation(`create:${property.id}:${key.toLowerCase()}`);
          const previous = await repo.reservationByCreationKey(key.toLowerCase());
          if (previous) {
            if (previous.fingerprint !== fingerprint)
              throw new ConflictException(
                'Этот запрос уже создал бронь с другими данными. Откройте новую форму.',
              );
            replay = true;
            return (await repo.card(previous.confirmationNumber))!;
          }
        }
        let currency: string | null = null;
        // Промокод (DATA_MODEL §20): один на бронь; блокировка держит предел использований при одновременных бронях
        const promoRaw = dto.promoCode == null ? '' : String(dto.promoCode).trim();
        let promo: PromoRef | null = null;
        if (promoRaw !== '') {
          const code = normalizePromoCode(promoRaw);
          if (!code) throw new UnprocessableEntityException('Промокод записан неверно');
          const found = await repo.promoByCode(code);
          if (!found) throw new UnprocessableEntityException(`Промокод ${code} не найден`);
          await repo.lockPromo(found.id);
          promo = (await repo.promoByCode(code)) ?? found;
          assertPromoAllows(promo, dates);
        }
        const todayIso = await repo.today();
        const nightsCount = Math.round(
          (Date.parse(`${dates.departureDate}T00:00:00Z`) -
            Date.parse(`${dates.arrivalDate}T00:00:00Z`)) /
            86_400_000,
        );
        const prepared: Array<{
          typeId: string;
          ratePlanId: string;
          adults: number;
          totalMinor: bigint;
          unitId: string | null;
        }> = [];
        // Б2: продажи категории последовательны — все категории брони блокируются сразу и в одном порядке
        const lockIds: string[] = [];
        for (const code of new Set(dto.items!.map((i) => i.accommodationTypeCode!))) {
          const t = await repo.categoryByCode(code);
          if (t) lockIds.push(t.id);
        }
        await repo.lockCategories(lockIds);
        // места этого запроса ещё не записаны: считаем их сами, иначе каждое проходит проверку по отдельности
        const requestedByType = new Map<string, number>();
        const pickedUnits = new Set<string>();
        const nightTotals = new Map<string, bigint>();
        for (const it of dto.items!) {
          const type = await repo.categoryByCode(it.accommodationTypeCode!);
          if (!type || !type.active)
            throw new UnprocessableEntityException(
              `Категория ${it.accommodationTypeCode} не найдена или неактивна`,
            );
          const adults = it.adults as number;
          assertFits(type, adults, 0);
          const plan = await repo.ratePlanByCode(it.ratePlanCode!);
          if (!plan || !plan.active)
            throw new UnprocessableEntityException(
              `Тариф ${it.ratePlanCode} не найден или неактивен`,
            );
          if (!(await repo.ratePlanCoversType(plan.id, type.id)))
            throw new UnprocessableEntityException(
              `Тариф ${plan.name} не действует на категорию ${type.name}`,
            );
          if (currency !== null && currency !== plan.currency)
            throw new UnprocessableEntityException(
              'Все проживания одной брони должны быть в одной валюте',
            );
          currency = plan.currency;
          if (plan.derivedRule)
            assertDerivedRuleAllows(plan.derivedRule, {
              planName: plan.name,
              today: todayIso,
              arrivalDate: dates.arrivalDate,
              nights: nightsCount,
            });
          await this.assertRestrictions(repo, type, plan.id, dates);
          const rates = await repo.nightRates(
            type.id,
            plan.id,
            dates.arrivalDate,
            dates.departureDate,
            promo?.discountPercent ?? null,
          );
          const price = priceStay({ ...dates, occupancy: adults, rates });
          const quantity = it.quantity ?? 1;
          for (const night of price.nights)
            nightTotals.set(
              night.date,
              (nightTotals.get(night.date) ?? 0n) + night.priceMinor * BigInt(quantity),
            );
          // Q-107: продать можно не больше, чем видит канал — брони без ячейки уже проданы.
          // Б2: вместе с местами этой же брони, которые ещё не записаны
          const requested = (requestedByType.get(type.id) ?? 0) + quantity;
          await this.assertCategoryCapacity(repo, type, dates, requested);
          requestedByType.set(type.id, requested);
          if (quantity > 1) {
            // Групповая бронь: N мест → N проживаний, ячейки — первые свободные по номеру (как firstFreeUnit)
            const free = (
              await repo.freeUnits(type.id, dates.arrivalDate, dates.departureDate)
            ).filter((u) => !pickedUnits.has(u.id));
            if (free.length < quantity)
              throw new ConflictException(
                `В категории ${type.name} на ${dates.arrivalDate} → ${dates.departureDate} свободно только ${free.length} из ${quantity} мест`,
              );
            for (const unit of free.slice(0, quantity)) {
              pickedUnits.add(unit.id);
              prepared.push({
                typeId: type.id,
                ratePlanId: plan.id,
                adults,
                totalMinor: price.totalMinor,
                unitId: unit.id,
              });
            }
            continue;
          }
          let unitId: string | null = null;
          if (it.unitCode) {
            const unit = await repo.unitByCode(it.unitCode);
            if (!unit || !unit.active)
              throw new UnprocessableEntityException(
                `Ячейка ${it.unitCode} не найдена или неактивна`,
              );
            if (unit.accommodationTypeId !== type.id)
              throw new UnprocessableEntityException(
                `Ячейка ${it.unitCode} принадлежит другой категории`,
              );
            if (await repo.hasBlockOverlap(unit.id, dates.arrivalDate, dates.departureDate))
              throw new ConflictException(`Ячейка ${it.unitCode} заблокирована на эти даты`);
            if (await repo.hasAllocationOverlap(unit.id, dates.arrivalDate, dates.departureDate))
              throw new ConflictException(`Ячейка ${it.unitCode} занята на выбранные даты`);
            if (pickedUnits.has(unit.id))
              throw new ConflictException(`Ячейка ${it.unitCode} указана в брони дважды`);
            pickedUnits.add(unit.id);
            unitId = unit.id;
          } else if (it.autoAssign) {
            // как у канала (Q-094): первая свободная ячейка категории, иначе без ячейки;
            // ячейки, уже выданные другим местам этой брони, не выдаются второй раз
            const unit = (
              await repo.freeUnits(type.id, dates.arrivalDate, dates.departureDate)
            ).find((u) => !pickedUnits.has(u.id));
            if (unit) pickedUnits.add(unit.id);
            unitId = unit?.id ?? null;
          }
          prepared.push({
            typeId: type.id,
            ratePlanId: plan.id,
            adults,
            totalMinor: price.totalMinor,
            unitId,
          });
        }
        const totalMinor = prepared.reduce((sum, item) => sum + item.totalMinor, 0n).toString();
        if (opts.preview)
          return {
            ...dates,
            currency: currency!,
            totalMinor,
            nights: [...nightTotals].map(([date, sum]) => ({ date, priceMinor: sum.toString() })),
          };
        if (dto.expectedTotalMinor !== undefined && dto.expectedTotalMinor !== totalMinor)
          throw new ConflictException(
            'Стоимость изменилась. Проверьте обновлённый расчёт и подтвердите создание ещё раз.',
          );
        const guestId = guest
          ? await repo.createGuest(guest)
          : await repo.guestForBooking(existingGuestId!);
        if (!guestId) throw new NotFoundException(GUEST_NOT_FOUND);
        if (booking.externalId)
          await this.assertChannelBookingFree(repo, booking.channel ?? null, booking.externalId);
        const number = confirmationNumber(new Date());
        const created = await repo.createReservation({
          confirmationNumber: number,
          creationKey: key?.toLowerCase() ?? null,
          creationFingerprint: fingerprint,
          source,
          ...booking,
          status,
          ...dates,
          adults: prepared.reduce((s, p) => s + p.adults, 0),
          children: 0,
          currency: currency!,
          totalAmountMinor: prepared.reduce((s, p) => s + p.totalMinor, 0n),
          promoCodeId: promo?.id ?? null,
          primaryGuestId: guestId,
          // Q-169: пока база не в РК, почта и телефоны в заметке маскируются (сайт приходит сюда же)
          notes: freeTextForStorage(dto.notes),
          items: prepared.map((p) => ({
            accommodationTypeId: p.typeId,
            ratePlanId: p.ratePlanId,
            adults: p.adults,
            children: 0,
            ...dates,
            priceMinor: p.totalMinor,
            status,
          })),
        });
        for (const [i, p] of prepared.entries()) {
          const itemId = created.itemIds[i]!;
          await repo.addStayGuest(itemId, guestId, true);
          if (p.unitId)
            await repo.createAllocation(itemId, p.unitId, dates.arrivalDate, dates.departureDate);
        }
        const card = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: created.id,
          action: 'reservation.create',
          after: card,
        });
        return card;
      }),
    );
    if (!replay && 'confirmationNumber' in created) await this.publish(null, created);
    return created;
  }

  /**
   * Изменить даты всей брони. Тариф берётся с проживания (Q-102: `ReservationItem.rate_plan_id`);
   * `ratePlanCode` в запросе переопределяет его и обязателен, если тариф на проживании неизвестен
   * (созданная ранее брони).
   */
  async changeDates(number: string, dto: ChangeDatesDto): Promise<ReservationCard> {
    const dates = requireStayDates(dto.arrivalDate, dto.departureDate);
    const changed = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const before = await repo.card(number);
        const ownPlanId = state.items.find(
          (i) => i.status !== 'CANCELLED' && i.ratePlanId,
        )?.ratePlanId;
        if (!dto.ratePlanCode && !ownPlanId)
          throw new BadRequestException('ratePlanCode обязателен: тариф на проживании неизвестен');
        const plan = dto.ratePlanCode
          ? await repo.ratePlanByCode(dto.ratePlanCode)
          : await repo.ratePlanById(ownPlanId!);
        if (!plan || !plan.active)
          throw new UnprocessableEntityException(
            `Тариф ${dto.ratePlanCode ?? ownPlanId} не найден или неактивен`,
          );
        if (plan.currency !== state.currency)
          throw new UnprocessableEntityException(
            `Тариф в ${plan.currency}, бронь в ${state.currency}`,
          );
        // до первой записи: у каждого проживания тариф остаётся прежним, если менять его нельзя (Q-200, Q-201)
        for (const item of state.items)
          if (item.status !== 'CANCELLED') this.assertPlanKept(item, plan);
        let total = 0n;
        for (const item of state.items) {
          if (item.status === 'CANCELLED') continue;
          assertCanChangeDates(item.status);
          if (!(await repo.ratePlanCoversType(plan.id, item.accommodationTypeId)))
            throw new UnprocessableEntityException(
              `Тариф ${plan.name} не действует на категорию проживания`,
            );
          await this.assertRestrictions(
            repo,
            await repo.categoryById(item.accommodationTypeId),
            plan.id,
            dates,
          );
          await this.assertCategoryCapacity(
            repo,
            await repo.categoryById(item.accommodationTypeId),
            dates,
            1,
            item.id,
          );
          const rates = await repo.nightRates(
            item.accommodationTypeId,
            plan.id,
            dates.arrivalDate,
            dates.departureDate,
            item.promoPercent ?? null,
          );
          const price = priceStay({
            ...dates,
            occupancy: Math.max(1, item.adults || item.guestsCount),
            rates,
          });
          if (item.allocations.length > 1)
            throw new UnprocessableEntityException(
              'Проживание с переселением: измените даты назначений вручную',
            );
          const a = item.allocations[0];
          if (a) await repo.replaceAllocationDates(a.id, dates.arrivalDate, dates.departureDate);
          await repo.updateItem(item.id, {
            ...dates,
            priceMinor: price.totalMinor,
            ratePlanId: plan.id,
          });
          total += price.totalMinor;
        }
        await repo.updateReservation(state.id, { ...dates, totalAmountMinor: total });
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.changeDates',
          before,
          after,
        });
        return { before, after };
      }),
    );
    await this.publish(changed.before, changed.after);
    return changed.after;
  }

  /** Отменить бронь: проживания → CANCELLED, назначения сняты. Штрафы/возвраты — вне шага (Q-091, Q-093). */
  async cancel(number: string): Promise<ReservationCard> {
    const cancelled = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const before = await repo.card(number);
        const active = state.items.filter((i) => i.status !== 'CANCELLED');
        if (active.length === 0) throw new UnprocessableEntityException('Бронь уже отменена');
        for (const item of active) assertCanCancel(item.status);
        for (const item of active) {
          for (const a of item.allocations) await repo.deleteAllocation(a.id);
          await repo.updateItem(item.id, { status: 'CANCELLED' });
          await this.chargePenalty(repo, item, 'отмену брони');
          await repo.settleChannelPrepaymentAfterCancel(item.id); // ADR-022: предоплата канала
        }
        await repo.updateReservation(state.id, {
          status: deriveReservationStatus(state.items.map(() => 'CANCELLED')),
        });
        // ADR-021: блоки соседних ночей от раннего заезда / позднего выезда уходят вместе с бронью
        const released = await repo.releaseStayExtraBlocks(number);
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.cancel',
          before,
          after,
        });
        return { before, after, released };
      }),
    );
    await this.publish(cancelled.before, cancelled.after);
    await this.publishReleased(cancelled.released);
    return cancelled.after;
  }

  /**
   * Срез 7.3 (Д5): сколько будет стоить действие — до того, как его сделали. Только чтение: ни
   * начислений, ни журнала, ни очереди каналов. Считается теми же функциями, что и само действие
   * (`priceStay` по календарю тарифа, `penaltyFor` по политике тарифа), поэтому число в окне
   * подтверждения равно тому, что появится на счёте.
   *
   * Осуществимость (занята ли ячейка, не закрыты ли продажи) здесь не проверяется — на это ответит
   * сама команда своим отказом; предпросмотр отвечает только на вопрос «сколько».
   */
  async preview(
    number: string,
    itemId: string,
    q: { action?: string; unitCode?: string; nights?: string | number; ratePlanCode?: string },
  ): Promise<ActionPreview> {
    const action = q.action ?? '';
    if (!['move', 'extend', 'cancel', 'no_show'].includes(action))
      throw new BadRequestException('action: move | extend | cancel | no_show');
    return this.uow.read(async (repo) => {
      const state = await this.load(repo, number, { lock: false });
      const item = state.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
      const base = {
        action: action as ActionPreview['action'],
        currentPriceMinor: item.priceMinor.toString(),
        currency: state.currency,
      };
      const occupancy = Math.max(1, item.adults || item.guestsCount);

      if (action === 'cancel' || action === 'no_show') {
        const penalty = await this.penaltyFor(repo, item, action);
        return {
          ...base,
          penaltyMinor: penalty.amountMinor.toString(),
          policy: item.cancellationPenalty,
          // Начисление за проживание сторнируется целиком, вместо него встаёт штраф (Q-103)
          voidedMinor: item.priceMinor.toString(),
        };
      }

      if (action === 'extend') {
        const nights = q.nights === undefined ? 1 : Number(q.nights);
        if (!Number.isInteger(nights) || nights < 1 || nights > 30)
          throw new BadRequestException('nights — целое от 1 до 30');
        const departureDate = addDays(item.departureDate, nights);
        const planId = await this.resolvePlanId(repo, item, q.ratePlanCode);
        // Как и само продление: считаются только добавленные ночи, проданные не переоцениваются
        const rates = await repo.nightRates(
          item.accommodationTypeId,
          planId,
          item.departureDate,
          departureDate,
          item.promoPercent ?? null,
        );
        const added = priceStay({
          arrivalDate: item.departureDate,
          departureDate,
          occupancy,
          rates,
        });
        return {
          ...base,
          newPriceMinor: (item.priceMinor + added.totalMinor).toString(),
          differenceMinor: added.totalMinor.toString(),
          nights,
          departureDate,
        };
      }

      if (!q.unitCode) throw new BadRequestException('unitCode обязателен для action=move');
      const unit = await repo.unitByCode(q.unitCode);
      if (!unit || !unit.active)
        throw new UnprocessableEntityException(`Ячейка ${q.unitCode} не найдена или неактивна`);
      const changesCategory = unit.accommodationTypeId !== item.accommodationTypeId;
      if (!changesCategory)
        return {
          ...base,
          changesCategory: false,
          newPriceMinor: item.priceMinor.toString(),
          differenceMinor: '0',
          unitCode: unit.code,
        };
      const target = await repo.categoryById(unit.accommodationTypeId);
      if (!target || !target.active)
        throw new UnprocessableEntityException(`Категория ячейки ${q.unitCode} неактивна`);
      const planId = await this.resolvePlanId(repo, item, q.ratePlanCode);
      if (!(await repo.ratePlanCoversType(planId, target.id)))
        throw new UnprocessableEntityException(`Тариф не действует на категорию ${target.name}`);
      const rates = await repo.nightRates(
        target.id,
        planId,
        item.arrivalDate,
        item.departureDate,
        item.promoPercent ?? null,
      );
      const price = priceStay({
        arrivalDate: item.arrivalDate,
        departureDate: item.departureDate,
        occupancy,
        rates,
      });
      return {
        ...base,
        changesCategory: true,
        unitCode: unit.code,
        categoryName: target.name,
        newPriceMinor: price.totalMinor.toString(),
        differenceMinor: (price.totalMinor - item.priceMinor).toString(),
      };
    });
  }

  /**
   * T2 «Быстрое продление след дня»: одна кнопка добавляет ночи к проживанию.
   * Дата выезда сдвигается, цена пересчитывается по календарю тарифа проживания, назначение продлевается.
   * Ячейка на новые ночи занята — база не даст пересечение, администратор увидит 409 и переселит.
   */
  async extend(
    number: string,
    itemId: string,
    dto: { nights?: number; ratePlanCode?: string },
  ): Promise<ReservationCard> {
    const nights = dto.nights === undefined ? 1 : Number(dto.nights);
    if (!Number.isInteger(nights) || nights < 1 || nights > 30)
      throw new BadRequestException('nights — целое от 1 до 30');
    const extended = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanExtend(item.status);
        const before = await repo.card(number);
        const departureDate = addDays(item.departureDate, nights);
        const planId = await this.resolvePlanId(repo, item, dto.ratePlanCode);
        // Ограничения (ADR-020) — на добавленные ночи и новый выезд; уже проданные ночи не перепроверяются
        await this.assertRestrictions(
          repo,
          await repo.categoryById(item.accommodationTypeId),
          planId,
          { arrivalDate: item.arrivalDate, departureDate },
          item.departureDate,
        );
        await this.assertCategoryCapacity(
          repo,
          await repo.categoryById(item.accommodationTypeId),
          { arrivalDate: item.departureDate, departureDate },
          1,
          item.id,
        );
        // Считаем только ДОБАВЛЕННЫЕ ночи: цена уже проданных ночей согласована с гостем и каналом,
        // переоценивать её по сегодняшнему календарю нельзя. Перецена всего проживания — это changeDates.
        // Д5: та же функция считает сумму для подсказки «+8 000 ₸ на счёт» (previewExtend)
        const added = await this.priceAddedNights(repo, item, planId, departureDate);
        const price = { totalMinor: item.priceMinor + added.totalMinor };
        const last = item.allocations[item.allocations.length - 1];
        if (last) {
          // Блокировки лежат в отдельной таблице, ограничение базы их не ловит — спрашиваем явно
          if (await repo.hasBlockOverlap(last.unitId, item.departureDate, departureDate))
            throw new ConflictException(
              `Ячейка ${last.unitCode} заблокирована на ${item.departureDate} → ${departureDate}`,
            );
          if (
            await repo.hasAllocationOverlap(last.unitId, item.departureDate, departureDate, item.id)
          )
            throw new ConflictException(`Ячейка ${last.unitCode} занята на новые ночи`);
          await repo.replaceAllocationDates(last.id, last.startDate, departureDate);
        }
        // У брони без тарифа выбранный тариф записывается: дальше в нём продлевают, штраф — его (Q-201)
        await repo.updateItem(item.id, {
          departureDate,
          priceMinor: price.totalMinor,
          ...(item.ratePlanId ? {} : { ratePlanId: planId }),
        });
        const fresh = await this.load(repo, number);
        const active = fresh.items.filter((i) => i.status !== 'CANCELLED');
        await repo.updateReservation(state.id, {
          departureDate: active.reduce(
            (m, i) => (i.departureDate > m ? i.departureDate : m),
            active[0]!.departureDate,
          ),
          totalAmountMinor: active.reduce((s, i) => s + i.priceMinor, 0n),
        });
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.extend',
          before,
          after,
        });
        return { before, after };
      }),
    );
    await this.publish(extended.before, extended.after);
    return extended.after;
  }

  /**
   * Назначить ячейку или переселить с даты fromDate (ADR-006: закрыть старое назначение, открыть новое).
   * Переселение в ДРУГУЮ категорию (T1 «быстрое переселение с пересчётом дней») допускается только на всё
   * проживание целиком: у проживания одна категория, и половину срока в другой категории модель не выражает.
   * Цена пересчитывается по календарю новой категории и тарифу проживания, начисление за проживание —
   * следом автоматически (DATA_MODEL §6). Дельта уходит в каналы по обеим категориям.
   */
  async assign(number: string, itemId: string, dto: AssignUnitDto): Promise<ReservationCard> {
    if (!dto.unitCode) throw new BadRequestException('unitCode обязателен');
    if (dto.fromDate !== undefined && !isIso(dto.fromDate))
      throw new BadRequestException('fromDate — дата YYYY-MM-DD');
    const moved = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanAssign(item.status);
        const before = await repo.card(number);
        const unit = await repo.unitByCode(dto.unitCode!);
        if (!unit || !unit.active)
          throw new UnprocessableEntityException(`Ячейка ${dto.unitCode} не найдена или неактивна`);
        const changesCategory = unit.accommodationTypeId !== item.accommodationTypeId;
        const fromDate = dto.fromDate ?? item.arrivalDate;
        if (fromDate < item.arrivalDate || fromDate >= item.departureDate)
          throw new UnprocessableEntityException(
            `fromDate должна быть внутри проживания [${item.arrivalDate}, ${item.departureDate})`,
          );
        if (changesCategory && fromDate !== item.arrivalDate)
          throw new UnprocessableEntityException(
            'Переселение в другую категорию возможно только на всё проживание: у проживания одна категория',
          );
        if (await repo.hasBlockOverlap(unit.id, fromDate, item.departureDate))
          throw new ConflictException(`Ячейка ${dto.unitCode} заблокирована на эти даты`);

        let repriced: bigint | null = null;
        if (changesCategory) {
          // Д5: та же функция считает сумму для окна подтверждения (previewMove)
          const r = (await this.repriceForUnit(repo, item, unit, dto.ratePlanCode))!;
          repriced = r.price.totalMinor;
          await repo.updateItem(item.id, {
            accommodationTypeId: r.target.id,
            ratePlanId: r.planId,
            priceMinor: r.price.totalMinor,
          });
        }
        await this.releaseFrom(repo, item, fromDate);
        await repo.createAllocation(item.id, unit.id, fromDate, item.departureDate);
        if (repriced !== null) {
          const fresh = await this.load(repo, number);
          await repo.updateReservation(state.id, {
            totalAmountMinor: fresh.items
              .filter((i) => i.status !== 'CANCELLED')
              .reduce((s, i) => s + i.priceMinor, 0n),
          });
        }
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.assign',
          before,
          after,
        });
        return { before, after };
      }),
    );
    // Ячейка в той же категории остаток не меняет — дельты нет; в другой — освободилась старая, занялась новая
    await this.publish(moved.before, moved.after);
    return moved.after;
  }

  /**
   * ADR-020: ограничения продаж (стоп-продажа, закрытие заезда/выезда, срок) действуют и на стойке.
   * Брони каналов сюда не попадают — канал сам отвечает за свои ограничения (inbound.service).
   * Выезд — граница диапазона: строка на дату выезда нужна ради closed_to_departure, поэтому +1 день.
   */
  /**
   * Q-107: остаток категории считается как у канала — активные ячейки минус блокировки минус проданные
   * проживания, включая брони без ячейки. Иначе стойка видит мест больше, чем можно продать, а запрет
   * пересечений в базе на брони без ячейки не действует.
   */
  private async assertCategoryCapacity(
    repo: ReservationsRepository,
    type: { name: string; id: string } | null,
    dates: { arrivalDate: string; departureDate: string },
    need: number,
    exceptItemId?: string,
  ): Promise<void> {
    if (!type) throw new UnprocessableEntityException('Категория проживания не найдена');
    // Б2: другой запрос не продаст то же место между подсчётом и записью (блокировка до конца транзакции)
    await repo.lockCategories([type.id]);
    const left = await repo.categoryAvailability(
      type.id,
      dates.arrivalDate,
      dates.departureDate,
      exceptItemId,
    );
    if (left < need)
      throw new ConflictException(
        need > 1
          ? `В категории ${type.name} на ${dates.arrivalDate} → ${dates.departureDate} свободно только ${left} из ${need} мест`
          : `В категории ${type.name} на ${dates.arrivalDate} → ${dates.departureDate} мест нет: всё продано, часть броней канала ещё без ячейки`,
      );
  }

  private async assertRestrictions(
    repo: ReservationsRepository,
    type: { name: string; id: string } | null,
    ratePlanId: string,
    dates: { arrivalDate: string; departureDate: string },
    soldUntil?: string,
  ): Promise<void> {
    if (!type) throw new UnprocessableEntityException('Категория проживания не найдена');
    const restrictions = await repo.restrictionsFor(
      type.id,
      ratePlanId,
      dates.arrivalDate,
      addDays(dates.departureDate, 1),
    );
    assertRestrictionsAllow({ ...dates, categoryName: type.name, restrictions, soldUntil });
  }

  /**
   * ADR-071: номер брони в канале второй раз не заводится — ни у другой ручной брони, ни когда Channex эту бронь
   * уже прислал (её внешний ID — `unique_id`, `BDC-<номер>`). Иначе при подключении канала или сейчас же — дубль.
   */
  private async assertChannelBookingFree(
    repo: ReservationsRepository,
    channel: string | null,
    externalId: string,
    exceptId?: string,
  ): Promise<void> {
    const channexId = channel ? channex.channexUniqueIdOf(channel, externalId) : null;
    for (const id of [externalId, ...(channexId ? [channexId] : [])]) {
      const other = await repo.reservationByExternalId(id);
      if (other && other.id !== exceptId)
        throw new ConflictException(
          id === externalId
            ? `Номер брони в канале ${externalId} уже записан в брони ${other.confirmationNumber} — откройте её`
            : `Бронь ${externalId} уже пришла из канала: ${other.confirmationNumber} — вторую заводить не нужно`,
        );
    }
  }

  /** Правка шапки готовой брони: заметки и источник (Q-089: источник — только из справочника). */
  async update(number: string, dto: UpdateReservationDto): Promise<ReservationCard> {
    const patch: {
      notes?: string | null;
      source?: ReservationSource;
      channel?: string | null;
      externalId?: string | null;
    } = {};
    if (dto.notes !== undefined) {
      if (dto.notes !== null && typeof dto.notes !== 'string')
        throw new BadRequestException('notes — строка или null');
      patch.notes = dto.notes === null ? null : freeTextForStorage(dto.notes.trim() || null);
    }
    if (dto.source !== undefined) {
      if (!(RESERVATION_SOURCES as readonly string[]).includes(dto.source))
        throw new BadRequestException(`source — один из ${RESERVATION_SOURCES.join(', ')}`);
      patch.source = dto.source as ReservationSource;
    }
    const bookingGiven = dto.channel !== undefined || dto.externalId !== undefined;
    if (Object.keys(patch).length === 0 && !bookingGiven)
      throw new BadRequestException('Нечего менять: укажите notes, source, channel или externalId');
    return this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const before = await repo.card(number);
        if (bookingGiven) {
          const booking = channelBooking(patch.source ?? before!.source, dto, false);
          if (booking.externalId)
            await this.assertChannelBookingFree(
              repo,
              booking.channel ?? before!.channel ?? null,
              booking.externalId,
              state.id,
            );
          Object.assign(patch, booking);
        }
        await repo.updateReservation(state.id, patch);
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.update',
          before,
          after,
        });
        return after;
      }),
    );
  }

  /**
   * Гостей на проживании (Q-102): вместимость категории — как при создании. Цена не пересчитывается:
   * согласованную с гостем сумму менять молча нельзя, перецена по календарю — командой «Изменить даты».
   */
  async updateItem(number: string, itemId: string, dto: UpdateItemDto): Promise<ReservationCard> {
    if (dto.adults !== undefined && (!Number.isInteger(dto.adults) || dto.adults < 1))
      throw new BadRequestException('adults — целое ≥ 1');
    if (dto.children !== undefined && (!Number.isInteger(dto.children) || dto.children < 0))
      throw new BadRequestException('children — целое ≥ 0');
    if (dto.adults === undefined && dto.children === undefined)
      throw new BadRequestException('Нечего менять: укажите adults и/или children');
    return this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        if (item.status === 'CANCELLED' || item.status === 'NO_SHOW')
          throw new UnprocessableEntityException(
            `Проживание в статусе ${item.status}: гостей не изменить`,
          );
        const type = await repo.categoryById(item.accommodationTypeId);
        if (!type) throw new UnprocessableEntityException('Категория проживания не найдена');
        const adults = dto.adults ?? item.adults;
        const children = dto.children ?? item.children;
        assertFits(type, adults, children);
        const before = await repo.card(number);
        await repo.updateItem(item.id, { adults, children });
        // Шапка брони производна от проживаний: гостей — сумма по неотменённым
        const active = state.items.filter((i) => i.status !== 'CANCELLED');
        await repo.updateReservation(state.id, {
          adults: active.reduce((s, i) => s + (i.id === item.id ? adults : i.adults), 0),
          children: active.reduce((s, i) => s + (i.id === item.id ? children : i.children), 0),
        });
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.updateItem',
          before,
          after,
        });
        return after;
      }),
    );
  }

  /**
   * Штраф при отмене и незаезде (Q-103) по политике тарифа проживания: начисление за проживание
   * сторнируется автоматически, вместо него ставится `PENALTY`. Умолчание тарифов — правило Legacy
   * «стоимость первых суток»; сумма первой ночи берётся из календаря цен, иначе средняя ночь.
   * Штраф — обычное начисление: стойка сторнирует его с карточки, если решила не взыскивать.
   */
  private async chargePenalty(
    repo: ReservationsRepository,
    item: ItemState,
    reason: 'отмену брони' | 'незаезд',
  ): Promise<void> {
    // Д5: та же функция даёт сумму для окна подтверждения (previewCancel) — окно не может разойтись со счётом
    const penalty = await this.penaltyFor(repo, item, reason === 'незаезд' ? 'no_show' : 'cancel');
    if (penalty.amountMinor > 0n)
      await repo.addPenaltyCharge(
        item.id,
        penalty.amountMinor,
        `Штраф за ${reason} (${item.arrivalDate} → ${item.departureDate})`,
      );
  }

  /**
   * Штраф по политике тарифа проживания (Q-103): появляется только в день заезда и позже, отмена заранее
   * бесплатна на всех каналах; незаезд — всегда. Сумма — `penaltyAmount` домена: первая ночь по календарю
   * тарифа или доля цены проживания.
   */
  private async penaltyFor(
    repo: ReservationsRepository,
    item: ItemState,
    reason: 'cancel' | 'no_show',
  ): Promise<{ policy: ItemState['cancellationPenalty']; dueNow: boolean; amountMinor: bigint }> {
    const policy = item.cancellationPenalty;
    if (policy === 'NONE' || item.priceMinor <= 0n)
      return { policy, dueNow: false, amountMinor: 0n };
    const dueNow = penaltyDue({ arrivalDate: item.arrivalDate, on: await repo.today(), reason });
    if (!dueNow) return { policy, dueNow, amountMinor: 0n };
    const nights = Math.round(
      (Date.parse(`${item.departureDate}T00:00:00Z`) -
        Date.parse(`${item.arrivalDate}T00:00:00Z`)) /
        86_400_000,
    );
    let firstNightMinor: bigint | null = null;
    if (policy === 'FIRST_NIGHT' && item.ratePlanId) {
      const rates = await repo.nightRates(
        item.accommodationTypeId,
        item.ratePlanId,
        item.arrivalDate,
        item.departureDate,
      );
      const occupancy = Math.max(1, item.adults || item.guestsCount);
      firstNightMinor =
        rates.find((r) => r.date === item.arrivalDate && r.occupancy === occupancy)?.priceMinor ??
        null;
    }
    return {
      policy,
      dueNow,
      amountMinor: penaltyAmount(policy, { totalMinor: item.priceMinor, nights, firstNightMinor }),
    };
  }

  /**
   * Тариф для пересчёта: явный код или тариф проживания; у созданная ранее его нет (Б8). Выбрать другой тариф
   * может только тот, кому открыты тарифы (Q-200); брони без тарифа администратор назначает тариф со штрафом (Q-201).
   */
  private async resolvePlanId(
    repo: ReservationsRepository,
    item: ItemState,
    ratePlanCode: string | undefined,
  ): Promise<string> {
    if (!ratePlanCode) {
      if (!item.ratePlanId)
        throw new BadRequestException('ratePlanCode обязателен: тариф на проживании неизвестен');
      return item.ratePlanId;
    }
    const plan = await repo.ratePlanByCode(ratePlanCode);
    if (!plan)
      throw new BadRequestException('ratePlanCode обязателен: тариф на проживании неизвестен');
    this.assertPlanKept(item, plan);
    return plan.id;
  }

  /**
   * Тариф — цена и правило штрафа брони. Q-200 (ответ владельца 27.09.2026 — «нет не могут»): у существующей брони его
   * меняют владелец и управляющий (право `rates`); администратор меняет даты, продлевает и переселяет в том же тарифе.
   * Q-201 («Да, разрешить»): брони без тарифа администратор назначает тариф один раз, со штрафом не мягче
   * «первых суток»; тариф записывается в бронь, дальше — Q-200. Без человека за запросом — как раньше.
   */
  private assertPlanKept(
    item: { ratePlanId: string | null },
    plan: Pick<RatePlanRef, 'id' | 'cancellationPenalty'>,
  ): void {
    if (plan.id === item.ratePlanId || actorMay('rates')) return;
    if (item.ratePlanId) throw new ForbiddenException(RATE_PLAN_CHANGE_MESSAGE);
    if (!mayAssignPlanWithoutRates(plan.cancellationPenalty))
      throw new ForbiddenException(RATE_PLAN_SOFT_MESSAGE);
  }

  /** Цена добавленных ночей по календарю тарифа — только их, проданные ночи не переоцениваются */
  private async priceAddedNights(
    repo: ReservationsRepository,
    item: ItemState,
    planId: string,
    departureDate: string,
  ) {
    const rates = await repo.nightRates(
      item.accommodationTypeId,
      planId,
      item.departureDate,
      departureDate,
      item.promoPercent ?? null,
    );
    return priceStay({
      arrivalDate: item.departureDate,
      departureDate,
      occupancy: Math.max(1, item.adults || item.guestsCount),
      rates,
    });
  }

  /**
   * Цена проживания в ячейке другой категории: те же проверки вместимости и тарифа и тот же `priceStay`
   * по календарю новой категории, что и при переселении. null — категория не меняется.
   */
  private async repriceForUnit(
    repo: ReservationsRepository,
    item: ItemState,
    unit: UnitRef,
    ratePlanCode: string | undefined,
  ) {
    if (unit.accommodationTypeId === item.accommodationTypeId) return null;
    const target = await repo.categoryById(unit.accommodationTypeId);
    if (!target || !target.active)
      throw new UnprocessableEntityException(`Категория ячейки ${unit.code} неактивна`);
    const adults = Math.max(1, item.adults || item.guestsCount);
    assertFits(target, adults, item.children);
    const planId = await this.resolvePlanId(repo, item, ratePlanCode);
    if (!(await repo.ratePlanCoversType(planId, target.id)))
      throw new UnprocessableEntityException(`Тариф не действует на категорию ${target.name}`);
    const rates = await repo.nightRates(
      target.id,
      planId,
      item.arrivalDate,
      item.departureDate,
      item.promoPercent ?? null,
    );
    const price = priceStay({
      arrivalDate: item.arrivalDate,
      departureDate: item.departureDate,
      occupancy: adults,
      rates,
    });
    return { target, planId, price };
  }

  // ── Предпросмотр сумм до подтверждения (срез 7.3, Д5): только чтение, теми же функциями ──

  /** Переселение в ячейку `unitCode` на весь срок: новая сумма, если категория другая */
  async previewMove(
    number: string,
    itemId: string,
    q: { unitCode?: string | undefined; ratePlanCode?: string | undefined },
  ): Promise<MovePreview> {
    if (!q.unitCode) throw new BadRequestException('unitCode обязателен');
    return this.uow.read(async (repo) => {
      const state = await this.load(repo, number, { lock: false });
      const item = state.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
      const from = await repo.categoryById(item.accommodationTypeId);
      const unit = await repo.unitByCode(q.unitCode!);
      // Категория цели — по самой ячейке, а не по итогу пересчёта: иначе при занятой ячейке или
      // неподходящем тарифе окно подтверждения писало бы «Переселить в <текущую категорию>»
      const target = unit ? await repo.categoryById(unit.accommodationTypeId) : null;
      let newMinor: bigint | null = null;
      let problem: string | null = null;
      let ratePlanRequired = false;
      try {
        assertCanAssign(item.status);
        if (!unit || !unit.active)
          throw new UnprocessableEntityException(`Ячейка ${q.unitCode} не найдена или неактивна`);
        if (await repo.hasBlockOverlap(unit.id, item.arrivalDate, item.departureDate))
          throw new ConflictException(`Ячейка ${unit.code} заблокирована на эти даты`);
        if (await repo.hasAllocationOverlap(unit.id, item.arrivalDate, item.departureDate, item.id))
          throw new ConflictException(`Ячейка ${unit.code} занята на эти даты`);
        const r = await this.repriceForUnit(repo, item, unit, q.ratePlanCode);
        newMinor = r ? r.price.totalMinor : item.priceMinor;
      } catch (e) {
        problem = messageOf(e);
        ratePlanRequired = e instanceof BadRequestException && !item.ratePlanId && !q.ratePlanCode;
      }
      return {
        unitCode: q.unitCode!,
        changesCategory: !!target && !!from && target.id !== from.id,
        fromCategory: from ? { code: from.code, name: from.name } : null,
        toCategory: target ? { code: target.code, name: target.name } : null,
        nights: nightsBetween(item.arrivalDate, item.departureDate),
        currentMinor: item.priceMinor.toString(),
        newMinor: newMinor === null ? null : newMinor.toString(),
        ratePlanRequired,
        problem,
      };
    });
  }

  /** Продление на `nights` ночей: цена добавленных ночей и занята ли ячейка на них */
  async previewExtend(
    number: string,
    itemId: string,
    q: { nights?: string | number | undefined; ratePlanCode?: string | undefined },
  ): Promise<ExtendPreview> {
    const nights = q.nights === undefined || q.nights === '' ? 1 : Number(q.nights);
    if (!Number.isInteger(nights) || nights < 1 || nights > 30)
      throw new BadRequestException('nights — целое от 1 до 30');
    return this.uow.read(async (repo) => {
      const state = await this.load(repo, number, { lock: false });
      const item = state.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
      const departureDate = addDays(item.departureDate, nights);
      const last = item.allocations[item.allocations.length - 1];
      let addedMinor: bigint | null = null;
      let problem: string | null = null;
      let ratePlanRequired = false;
      try {
        assertCanExtend(item.status);
        const planId = await this.resolvePlanId(repo, item, q.ratePlanCode);
        addedMinor = (await this.priceAddedNights(repo, item, planId, departureDate)).totalMinor;
      } catch (e) {
        problem = messageOf(e);
        ratePlanRequired = e instanceof BadRequestException && !item.ratePlanId && !q.ratePlanCode;
      }
      const nextNightsFree = last
        ? !(await repo.hasBlockOverlap(last.unitId, item.departureDate, departureDate)) &&
          !(await repo.hasAllocationOverlap(
            last.unitId,
            item.departureDate,
            departureDate,
            item.id,
          ))
        : true;
      return {
        nights,
        departureDate,
        unitCode: last?.unitCode ?? null,
        addedMinor: addedMinor === null ? null : addedMinor.toString(),
        newMinor: addedMinor === null ? null : (item.priceMinor + addedMinor).toString(),
        ratePlanRequired,
        nextNightsFree,
        problem,
      };
    });
  }

  /** Отмена брони или незаезд по проживанию: штраф по каждому проживанию, как его начислит команда */
  async previewCancel(
    number: string,
    q: { reason?: string | undefined; itemId?: string | undefined },
  ): Promise<CancelPreview> {
    const reason =
      q.reason === 'no_show' ? 'no_show' : q.reason === 'cancel' || !q.reason ? 'cancel' : null;
    if (!reason) throw new BadRequestException('reason — cancel или no_show');
    return this.uow.read(async (repo) => {
      const state = await this.load(repo, number, { lock: false });
      let items = state.items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'NO_SHOW');
      if (q.itemId) {
        items = items.filter((i) => i.id === q.itemId);
        if (items.length === 0)
          throw new NotFoundException(`Проживание ${q.itemId} не найдено в брони ${number}`);
      }
      const rows = [];
      for (const item of items) {
        const p = await this.penaltyFor(repo, item, reason);
        rows.push({
          itemId: item.id,
          unitCode: item.allocations[item.allocations.length - 1]?.unitCode ?? null,
          policy: p.policy,
          dueNow: p.dueNow,
          penaltyMinor: p.amountMinor.toString(),
        });
      }
      return {
        reason,
        items: rows,
        totalPenaltyMinor: rows.reduce((s, r) => s + BigInt(r.penaltyMinor), 0n).toString(),
      };
    });
  }

  /** Заселить гостя в назначенную ячейку. */
  async checkIn(number: string, itemId: string): Promise<ReservationCard> {
    const card = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanCheckIn(item.status, item.allocations.length > 0);
        const before = await repo.card(number);
        // DATA_MODEL §3: гражданство обязательно на check-in (eQonaq) — заполняется в карточке гостя.
        // Через hasCitizenship: CHAR(3) в базе отдаёт пустое значение как '   ', и голая проверка его пропускала
        if (!hasCitizenship(before?.primaryGuest?.citizenship))
          throw new UnprocessableEntityException(
            'Укажите гражданство в карточке гостя — без него заселение невозможно (eQonaq)',
          );
        await repo.updateItem(item.id, { status: 'CHECKED_IN' });
        await repo.updateReservation(state.id, {
          status: deriveReservationStatus(
            state.items.map((i) => (i.id === item.id ? 'CHECKED_IN' : i.status)),
          ),
        });
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.checkIn',
          before,
          after,
        });
        return after;
      }),
    );
    return card;
  }

  /**
   * Выселить. Ранний выезд: проживание и назначение заканчиваются сегодня — ячейка свободна с этой даты.
   * Цена не пересчитывается (деньги — Folio, Q-091).
   */
  /**
   * T3 «Выселение с долгом»: выселить при непогашенном счёте можно, но администратор должен увидеть сумму
   * и подтвердить (`withDebt`). Иначе 409 с суммой долга. Факт выселения с долгом попадает в журнал.
   */
  async checkOut(
    number: string,
    itemId: string,
    dto: { withDebt?: boolean } = {},
  ): Promise<ReservationCard> {
    const result = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanCheckOut(item.status);
        const before = await repo.card(number);
        // Под блокировкой счёта: начисление со стойки между чтением долга и закрытием счёта иначе оставалось в
        // закрытом счёте, и принять по нему деньги было уже нельзя (проверка исправлений 26.09, к С-25)
        const debtMinor = await repo.stayBalanceMinor(item.id, { forUpdate: true });
        if (debtMinor > 0n && !dto.withDebt)
          throw new ConflictException(
            `На счёте долг ${formatMinorRu(debtMinor)}. Примите оплату или подтвердите выселение с долгом`,
          );
        const today = await repo.today();
        const early = today < item.departureDate && today >= item.arrivalDate;
        // Same-day checkout releases capacity without creating a zero-night billing period.
        const departureDate = early && today > item.arrivalDate ? today : item.departureDate;
        if (early) {
          for (const a of item.allocations) {
            if (a.endDate <= today) continue;
            if (a.startDate < today) await repo.shortenAllocation(a.id, today);
            else await repo.deleteAllocation(a.id);
          }
        }
        await repo.updateItem(item.id, {
          status: 'CHECKED_OUT',
          ...(early ? { departureDate } : {}),
        });
        // Q-155, решение владельца 22.09 (ADR-068): выезд сам переводит ячейку в «требует уборки» — с него
        // начинается цикл уборки; уже грязную не трогаем, запись журнала называет причину
        for (const unitId of new Set(item.allocations.map((a) => a.unitId))) {
          const hk = await repo.unitHousekeeping(unitId);
          if (!hk || hk === 'DIRTY') continue;
          await repo.setUnitHousekeeping(unitId, hk, 'DIRTY');
          await repo.audit({
            entityType: 'InventoryUnit',
            entityId: unitId,
            action: 'unit.housekeeping',
            before: { status: hk },
            after: { status: 'DIRTY', by: 'checkOut', reservation: number },
          });
        }
        const others = state.items.filter((i) => i.id !== item.id && i.status !== 'CANCELLED');
        const departure = [departureDate, ...others.map((i) => i.departureDate)].reduce(
          (m, d) => (d > m ? d : m),
          departureDate,
        );
        await repo.updateReservation(state.id, {
          status: deriveReservationStatus(
            state.items.map((i) => (i.id === item.id ? 'CHECKED_OUT' : i.status)),
          ),
          ...(early ? { departureDate: departure } : {}),
        });
        // Счёт закрывается только если по нему рассчитались: с долгом он остаётся открытым,
        // иначе деньги «уедут» вместе с гостем и их некуда будет принять (DATA_MODEL §6)
        if (debtMinor === 0n) await repo.closeFolio(item.id);
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: debtMinor > 0n ? 'reservation.checkOut.withDebt' : 'reservation.checkOut',
          before,
          after: debtMinor > 0n ? { ...after, debtMinor: debtMinor.toString() } : after,
        });
        return { before, after, early };
      }),
    );
    if (result.early) await this.publish(result.before, result.after);
    return result.after;
  }

  /** Незаезд: гость не приехал — назначение снимается, проживание NO_SHOW. */
  async noShow(number: string, itemId: string): Promise<ReservationCard> {
    const result = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanNoShow(item.status);
        const before = await repo.card(number);
        for (const a of item.allocations) await repo.deleteAllocation(a.id);
        await repo.updateItem(item.id, { status: 'NO_SHOW' });
        await this.chargePenalty(repo, item, 'незаезд');
        await repo.settleChannelPrepaymentAfterCancel(item.id); // ADR-022: предоплата канала
        await repo.updateReservation(state.id, {
          status: deriveReservationStatus(
            state.items.map((i) => (i.id === item.id ? 'NO_SHOW' : i.status)),
          ),
        });
        const released = await repo.releaseStayExtraBlocks(number);
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.noShow',
          before,
          after,
        });
        return { before, after, released };
      }),
    );
    await this.publish(result.before, result.after);
    await this.publishReleased(result.released);
    return result.after;
  }

  /** Снятые блоки соседних ночей — дельта остатка в канал на эти ночи */
  private async publishReleased(
    released: Array<{ categoryCode: string; from: string; toExclusive: string }>,
  ): Promise<void> {
    for (const b of released)
      await publishAfterCommit(this.publisher, {
        categoryCodes: [b.categoryCode],
        from: b.from,
        toExclusive: b.toExclusive,
      });
  }

  /**
   * Бронь с её проживаниями. Для команды — под замком до чтения: вторая команда по той же брони ждёт первую и видит её
   * результат (аудит 26.09, С-15). Предпросмотры (`lock: false`) читают без транзакции, а рекомендательный замок вне
   * транзакции отпускается тем же запросом — он ничего не держал бы, только заставлял ждать чужую запись.
   */
  private async load(repo: ReservationsRepository, number: string, { lock = true } = {}) {
    if (lock) await repo.lockReservation(number);
    const state = await repo.reservationByNumber(number);
    if (!state) throw new NotFoundException(`Бронь ${number} не найдена`);
    return state;
  }

  /** Освободить ячейки проживания с даты: назначения до fromDate укорачиваются, остальные снимаются. */
  private async releaseFrom(
    repo: ReservationsRepository,
    item: ItemState,
    fromDate: string,
  ): Promise<void> {
    for (const a of item.allocations) {
      if (a.endDate <= fromDate) continue;
      if (a.startDate < fromDate) await repo.shortenAllocation(a.id, fromDate);
      else await repo.deleteAllocation(a.id);
    }
  }
}
