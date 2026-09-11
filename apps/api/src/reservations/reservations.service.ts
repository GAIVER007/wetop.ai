import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
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
} from '@pms/domain';
import { ARI_PUBLISHER, type AriPublisher } from '../channels/ari-publisher';
import type { ReservationCard } from './reservation-card';
import {
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ItemState,
  type ReservationsRepository,
  type UnitOfWork,
} from './reservations.repository';

export interface CreateReservationDto {
  source?: string;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string | null;
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
  }>;
}
/** Правка шапки готовой брони: заметки и источник. Оба поля необязательны, но хотя бы одно нужно. */
export interface UpdateReservationDto {
  notes?: string | null;
  source?: string;
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

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s: unknown): s is string =>
  typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(s));

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
      'arrivalDate/departureDate — даты YYYY-MM-DD, departureDate > arrivalDate',
    );
  return { arrivalDate: arrival, departureDate: departure };
}

@Injectable()
export class ReservationsService {
  constructor(
    @Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  /** После коммита: дельта доступности в каналы по категориям и ночам карточки (и прежним, если были). */
  private async publish(cards: Array<ReservationCard | null>): Promise<void> {
    const items = cards.flatMap((c) => c?.items ?? []);
    if (items.length === 0) return;
    await this.publisher.reservationChanged({
      categoryCodes: [...new Set(items.map((i) => i.accommodationTypeCode))],
      from: items.reduce((m, i) => (i.arrivalDate < m ? i.arrivalDate : m), items[0]!.arrivalDate),
      toExclusive: items.reduce(
        (m, i) => (i.departureDate > m ? i.departureDate : m),
        items[0]!.departureDate,
      ),
    });
  }

  /** Активные тарифы (справочник для формы). */
  ratePlans(): Promise<Array<{ code: string; name: string; currency: string }>> {
    return this.uow.run(async (repo) =>
      (await repo.activeRatePlans()).map((p) => ({
        code: p.code,
        name: p.name,
        currency: p.currency,
      })),
    );
  }

  /** Создать бронь со стойки: источник обязателен (Q-089), цена — из календаря, ячейка — по желанию. */
  async create(dto: CreateReservationDto): Promise<ReservationCard> {
    if (!dto.source || !(RESERVATION_SOURCES as readonly string[]).includes(dto.source))
      throw new BadRequestException(`source обязателен: один из ${RESERVATION_SOURCES.join(', ')}`);
    const source = dto.source as ReservationSource;
    const dates = requireStayDates(dto.arrivalDate, dto.departureDate);
    if (!dto.guest?.firstName?.trim() || !dto.guest?.lastName?.trim())
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
    }
    const guest = dto.guest;
    const status: ReservationStatus = 'CONFIRMED';

    const created = await this.uow.run((repo) =>
      guarded(async () => {
        let currency: string | null = null;
        const prepared: Array<{
          typeId: string;
          ratePlanId: string;
          adults: number;
          totalMinor: bigint;
          unitId: string | null;
        }> = [];
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
          await this.assertRestrictions(repo, type, plan.id, dates);
          const rates = await repo.nightRates(
            type.id,
            plan.id,
            dates.arrivalDate,
            dates.departureDate,
          );
          const price = priceStay({ ...dates, occupancy: adults, rates });
          const quantity = it.quantity ?? 1;
          // Q-107: продать можно не больше, чем видит канал — брони без ячейки уже проданы
          await this.assertCategoryCapacity(repo, type, dates, quantity);
          if (quantity > 1) {
            // Групповая бронь: N мест → N проживаний, ячейки — первые свободные по номеру (как firstFreeUnit)
            const free = await repo.freeUnits(type.id, dates.arrivalDate, dates.departureDate);
            if (free.length < quantity)
              throw new ConflictException(
                `В категории ${type.name} на ${dates.arrivalDate} → ${dates.departureDate} свободно только ${free.length} из ${quantity} мест`,
              );
            for (const unit of free.slice(0, quantity))
              prepared.push({
                typeId: type.id,
                ratePlanId: plan.id,
                adults,
                totalMinor: price.totalMinor,
                unitId: unit.id,
              });
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
            unitId = unit.id;
          }
          prepared.push({
            typeId: type.id,
            ratePlanId: plan.id,
            adults,
            totalMinor: price.totalMinor,
            unitId,
          });
        }
        const guestId = await repo.createGuest({
          firstName: guest.firstName!.trim(),
          lastName: guest.lastName!.trim(),
          middleName: guest.middleName ?? null,
          phone: guest.phone ?? null,
          email: guest.email ?? null,
        });
        const number = confirmationNumber(new Date());
        const created = await repo.createReservation({
          confirmationNumber: number,
          source,
          status,
          ...dates,
          adults: prepared.reduce((s, p) => s + p.adults, 0),
          children: 0,
          currency: currency!,
          totalAmountMinor: prepared.reduce((s, p) => s + p.totalMinor, 0n),
          primaryGuestId: guestId,
          notes: dto.notes ?? null,
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
    await this.publish([created]);
    return created;
  }

  /**
   * Изменить даты всей брони. Тариф берётся с проживания (Q-102: `ReservationItem.rate_plan_id`);
   * `ratePlanCode` в запросе переопределяет его и обязателен, если тариф на проживании неизвестен
   * (перенесённые из Exely брони).
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
          throw new BadRequestException(
            'ratePlanCode обязателен: тариф на проживании неизвестен (бронь перенесена из Exely)',
          );
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
    await this.publish([changed.before, changed.after]);
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
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.cancel',
          before,
          after,
        });
        return after;
      }),
    );
    await this.publish([cancelled]);
    return cancelled;
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
    const card = await this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanExtend(item.status);
        const before = await repo.card(number);
        const departureDate = addDays(item.departureDate, nights);
        const planId = dto.ratePlanCode
          ? (await repo.ratePlanByCode(dto.ratePlanCode))?.id
          : item.ratePlanId;
        if (!planId)
          throw new BadRequestException(
            'ratePlanCode обязателен: тариф на проживании неизвестен (бронь перенесена из Exely)',
          );
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
        const rates = await repo.nightRates(
          item.accommodationTypeId,
          planId,
          item.departureDate,
          departureDate,
        );
        const added = priceStay({
          arrivalDate: item.departureDate,
          departureDate,
          occupancy: Math.max(1, item.adults || item.guestsCount),
          rates,
        });
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
        await repo.updateItem(item.id, { departureDate, priceMinor: price.totalMinor });
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
        return after;
      }),
    );
    await this.publish([card]);
    return card;
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
    let movedFromCategory: string | null = null;
    const card = await this.uow.run((repo) =>
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
        if (changesCategory)
          movedFromCategory =
            before?.items.find((i) => i.id === item.id)?.accommodationTypeCode ?? null;
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
          const target = await repo.categoryById(unit.accommodationTypeId);
          if (!target || !target.active)
            throw new UnprocessableEntityException(`Категория ячейки ${dto.unitCode} неактивна`);
          const adults = Math.max(1, item.adults || item.guestsCount);
          assertFits(target, adults, item.children);
          const planId = dto.ratePlanCode
            ? (await repo.ratePlanByCode(dto.ratePlanCode))?.id
            : item.ratePlanId;
          if (!planId)
            throw new BadRequestException(
              'ratePlanCode обязателен: тариф на проживании неизвестен (бронь перенесена из Exely)',
            );
          if (!(await repo.ratePlanCoversType(planId, target.id)))
            throw new UnprocessableEntityException(
              `Тариф не действует на категорию ${target.name}`,
            );
          const rates = await repo.nightRates(
            target.id,
            planId,
            item.arrivalDate,
            item.departureDate,
          );
          const price = priceStay({
            arrivalDate: item.arrivalDate,
            departureDate: item.departureDate,
            occupancy: adults,
            rates,
          });
          repriced = price.totalMinor;
          await repo.updateItem(item.id, {
            accommodationTypeId: target.id,
            ratePlanId: planId,
            priceMinor: price.totalMinor,
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
        return after;
      }),
    );
    await this.publishMove(card, movedFromCategory);
    return card;
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

  /** Правка шапки готовой брони: заметки и источник (Q-089: источник — только из справочника). */
  async update(number: string, dto: UpdateReservationDto): Promise<ReservationCard> {
    const patch: { notes?: string | null; source?: ReservationSource } = {};
    if (dto.notes !== undefined) {
      if (dto.notes !== null && typeof dto.notes !== 'string')
        throw new BadRequestException('notes — строка или null');
      patch.notes = dto.notes === null ? null : dto.notes.trim() || null;
    }
    if (dto.source !== undefined) {
      if (!(RESERVATION_SOURCES as readonly string[]).includes(dto.source))
        throw new BadRequestException(`source — один из ${RESERVATION_SOURCES.join(', ')}`);
      patch.source = dto.source as ReservationSource;
    }
    if (Object.keys(patch).length === 0)
      throw new BadRequestException('Нечего менять: укажите notes и/или source');
    return this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const before = await repo.card(number);
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

  /** Дельта в каналы после переселения между категориями: освободилась старая, занялась новая. */
  private async publishMove(card: ReservationCard, fromCategory: string | null): Promise<void> {
    if (!fromCategory) return;
    await this.publisher.reservationChanged({
      categoryCodes: [
        ...new Set([fromCategory, ...card.items.map((i) => i.accommodationTypeCode)]),
      ],
      from: card.arrivalDate,
      toExclusive: card.departureDate,
    });
  }

  /**
   * Штраф при отмене и незаезде (Q-103) по политике тарифа проживания: начисление за проживание
   * сторнируется автоматически, вместо него ставится `PENALTY`. Умолчание тарифов — правило Exely
   * «стоимость первых суток»; сумма первой ночи берётся из календаря цен, иначе средняя ночь.
   * Штраф — обычное начисление: стойка сторнирует его с карточки, если решила не взыскивать.
   */
  private async chargePenalty(
    repo: ReservationsRepository,
    item: ItemState,
    reason: 'отмену брони' | 'незаезд',
  ): Promise<void> {
    if (item.cancellationPenalty === 'NONE' || item.priceMinor <= 0n) return;
    // Штраф появляется только в день заезда и позже; отмена заранее бесплатна на всех каналах (Q-103)
    if (
      !penaltyDue({
        arrivalDate: item.arrivalDate,
        on: this.today(),
        reason: reason === 'незаезд' ? 'no_show' : 'cancel',
      })
    )
      return;
    const nights = Math.round(
      (Date.parse(`${item.departureDate}T00:00:00Z`) -
        Date.parse(`${item.arrivalDate}T00:00:00Z`)) /
        86_400_000,
    );
    let firstNightMinor: bigint | null = null;
    if (item.cancellationPenalty === 'FIRST_NIGHT' && item.ratePlanId) {
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
    const amount = penaltyAmount(item.cancellationPenalty, {
      totalMinor: item.priceMinor,
      nights,
      firstNightMinor,
    });
    if (amount > 0n)
      await repo.addPenaltyCharge(
        item.id,
        amount,
        `Штраф за ${reason} (${item.arrivalDate} → ${item.departureDate})`,
      );
  }

  /** Сегодня по часам объекта (Asia/Almaty, UTC+5). */
  private today(): string {
    return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
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
        // DATA_MODEL §3: гражданство обязательно на check-in (eQonaq) — заполняется в карточке гостя
        if (!before?.primaryGuest?.citizenship)
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
        const debtMinor = await repo.stayBalanceMinor(item.id);
        if (debtMinor > 0n && !dto.withDebt)
          throw new ConflictException(
            `На счёте долг ${formatMinorRu(debtMinor)}. Примите оплату или подтвердите выселение с долгом`,
          );
        const today = this.today();
        const early = today < item.departureDate && today > item.arrivalDate;
        if (early) {
          for (const a of item.allocations) {
            if (a.endDate <= today) continue;
            if (a.startDate < today) await repo.shortenAllocation(a.id, today);
            else await repo.deleteAllocation(a.id);
          }
        }
        await repo.updateItem(item.id, {
          status: 'CHECKED_OUT',
          ...(early ? { departureDate: today } : {}),
        });
        const others = state.items.filter((i) => i.id !== item.id && i.status !== 'CANCELLED');
        const departure = [item.departureDate, ...others.map((i) => i.departureDate)].reduce(
          (m, d) => (d > m ? d : m),
          early ? today : item.departureDate,
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
    if (result.early) await this.publish([result.before, result.after]);
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
        const after = (await repo.card(number))!;
        await repo.audit({
          entityType: 'Reservation',
          entityId: state.id,
          action: 'reservation.noShow',
          before,
          after,
        });
        return { before, after };
      }),
    );
    await this.publish([result.before, result.after]);
    return result.after;
  }

  private async load(repo: ReservationsRepository, number: string) {
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
