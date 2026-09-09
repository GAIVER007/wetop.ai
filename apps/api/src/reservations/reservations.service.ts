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
  assertCanAssign,
  assertCanCancel,
  assertCanChangeDates,
  confirmationNumber,
  deriveReservationStatus,
  priceStay,
  type ReservationSource,
  type ReservationStatus,
} from '@pms/domain';
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
  }>;
}
export interface ChangeDatesDto {
  arrivalDate?: string;
  departureDate?: string;
  ratePlanCode?: string;
}
export interface AssignUnitDto {
  unitCode?: string;
  fromDate?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s: unknown): s is string =>
  typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(s));

/** Нарушение правила брони (домен) → 422; пересечение ячеек (база) → 409. */
async function guarded<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ReservationRuleError) throw new UnprocessableEntityException(e.message);
    if (e instanceof AllocationOverlapError) throw new ConflictException(e.message);
    throw e;
  }
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
  constructor(@Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork) {}

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
    }
    const guest = dto.guest;
    const status: ReservationStatus = 'CONFIRMED';

    return this.uow.run((repo) =>
      guarded(async () => {
        let currency: string | null = null;
        const prepared: Array<{
          typeId: string;
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
          if (adults > type.capacityAdults)
            throw new UnprocessableEntityException(
              `Категория ${type.name}: вместимость ${type.capacityAdults}, запрошено ${adults}`,
            );
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
          const rates = await repo.nightRates(
            type.id,
            plan.id,
            dates.arrivalDate,
            dates.departureDate,
          );
          const price = priceStay({ ...dates, occupancy: adults, rates });
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
          prepared.push({ typeId: type.id, adults, totalMinor: price.totalMinor, unitId });
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
  }

  /** Изменить даты всей брони; тариф передаётся явно — на проживании он не хранится (Q-102). */
  async changeDates(number: string, dto: ChangeDatesDto): Promise<ReservationCard> {
    const dates = requireStayDates(dto.arrivalDate, dto.departureDate);
    if (!dto.ratePlanCode) throw new BadRequestException('ratePlanCode обязателен для перерасчёта');
    return this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const before = await repo.card(number);
        const plan = await repo.ratePlanByCode(dto.ratePlanCode!);
        if (!plan || !plan.active)
          throw new UnprocessableEntityException(
            `Тариф ${dto.ratePlanCode} не найден или неактивен`,
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
          const rates = await repo.nightRates(
            item.accommodationTypeId,
            plan.id,
            dates.arrivalDate,
            dates.departureDate,
          );
          const price = priceStay({ ...dates, occupancy: Math.max(1, item.guestsCount), rates });
          if (item.allocations.length > 1)
            throw new UnprocessableEntityException(
              'Проживание с переселением: измените даты назначений вручную',
            );
          const a = item.allocations[0];
          if (a) await repo.replaceAllocationDates(a.id, dates.arrivalDate, dates.departureDate);
          await repo.updateItem(item.id, { ...dates, priceMinor: price.totalMinor });
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
        return after;
      }),
    );
  }

  /** Отменить бронь: проживания → CANCELLED, назначения сняты. Штрафы/возвраты — вне шага (Q-091, Q-093). */
  async cancel(number: string): Promise<ReservationCard> {
    return this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const before = await repo.card(number);
        const active = state.items.filter((i) => i.status !== 'CANCELLED');
        if (active.length === 0) throw new UnprocessableEntityException('Бронь уже отменена');
        for (const item of active) assertCanCancel(item.status);
        for (const item of active) {
          for (const a of item.allocations) await repo.deleteAllocation(a.id);
          await repo.updateItem(item.id, { status: 'CANCELLED' });
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
  }

  /** Назначить ячейку или переселить с даты fromDate (ADR-006: закрыть старое назначение, открыть новое). */
  async assign(number: string, itemId: string, dto: AssignUnitDto): Promise<ReservationCard> {
    if (!dto.unitCode) throw new BadRequestException('unitCode обязателен');
    if (dto.fromDate !== undefined && !isIso(dto.fromDate))
      throw new BadRequestException('fromDate — дата YYYY-MM-DD');
    return this.uow.run((repo) =>
      guarded(async () => {
        const state = await this.load(repo, number);
        const item = state.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`Проживание ${itemId} не найдено в брони ${number}`);
        assertCanAssign(item.status);
        const before = await repo.card(number);
        const unit = await repo.unitByCode(dto.unitCode!);
        if (!unit || !unit.active)
          throw new UnprocessableEntityException(`Ячейка ${dto.unitCode} не найдена или неактивна`);
        if (unit.accommodationTypeId !== item.accommodationTypeId)
          throw new UnprocessableEntityException(
            `Ячейка ${dto.unitCode} принадлежит другой категории`,
          );
        const fromDate = dto.fromDate ?? item.arrivalDate;
        if (fromDate < item.arrivalDate || fromDate >= item.departureDate)
          throw new UnprocessableEntityException(
            `fromDate должна быть внутри проживания [${item.arrivalDate}, ${item.departureDate})`,
          );
        if (await repo.hasBlockOverlap(unit.id, fromDate, item.departureDate))
          throw new ConflictException(`Ячейка ${dto.unitCode} заблокирована на эти даты`);
        await this.releaseFrom(repo, item, fromDate);
        await repo.createAllocation(item.id, unit.id, fromDate, item.departureDate);
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
