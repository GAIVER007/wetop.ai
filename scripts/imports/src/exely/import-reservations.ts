import {
  ensureFolioWithAccommodation,
  ensureSingleActiveCharge,
  recordImportedPayment,
  type DbTx,
} from '@pms/database';
import { anonymizeGuest, anonymizeReservationNotes } from './anonymize';
import { guestCitizenshipOnUpdate } from './guest-fields';
import type { EntityCounts } from './import-inventory';
import type { GuestImportRecord, ReservationImportRecord } from './normalize-reservation';
import { planSeats, type SeatRequest, type Segment } from './seat-plan';

export interface ReservationsImportOptions {
  propertyId: string;
  /** Соль анонимизации для dev-БД (ADR-018). null — только для production в РК, по отдельному разрешению. */
  anonymizeSalt: string | null;
  /** Сегодняшняя ночь объекта (YYYY-MM-DD): переезд внутри срока, который уже был (ADR-044). По умолчанию — сейчас в Алматы */
  today?: string;
  /**
   * ADR-050: записи — живые карточки, полученные целиком только что (`cli-sync-day`): проживание, которого в карточке
   * нет, отменяется. Снимок с диска (`cli-import-reservations`) так считать нельзя — повтор старого снимка снёс бы
   * проживания, добавленные позже (ревью 15.09.2026). По умолчанию выключено.
   */
  cancelVanished?: boolean;
}
export interface ReservationsImportReport {
  reservations: EntityCounts;
  items: EntityCounts;
  guests: EntityCounts;
  /** released — назначения, снятые у отменённых / незаехавших проживаний */
  allocations: EntityCounts & { released: number };
  stayGuests: { linked: number };
  /** Проживания без назначенной единицы (Exely: roomId = null) */
  unassigned: number;
  /** Платежи EXTERNAL `exely:<roomStayId>`, созданные в этот прогон (повторы не считаются) */
  paymentsImported: number;
  /** Проживания, чья ячейка в эти даты уже занята другим активным проживанием: назначение пропущено */
  conflicts: AllocationConflict[];
  /** ADR-050 (Q-127): проживания, исчезнувшие из карточки Exely, отменены этим прогоном */
  vanished: VanishedStay[];
  /** Исчезли из карточки, но не тронуты: заселённый гость или оплаченное проживание — к человеку (Q-134) */
  vanishedKept: Array<VanishedStay & { reason: 'checked-in' | 'paid' }>;
  /** ADR-051 (Q-128): начисления «удержано в Exely» созданы этим прогоном */
  retained: number;
}
export interface VanishedStay {
  confirmationNumber: string;
  exelyRoomStayId: string;
  accommodationTypeCode: string;
  arrivalDate: string;
  departureDate: string;
}
/** Начисление-удержание на счёте отменённого проживания, оплаченного в Exely без возврата (ADR-051) */
const RETENTION_DESCRIPTION = 'Удержано в Exely при отмене (перенос)';
export interface AllocationConflict {
  confirmationNumber: string;
  exelyRoomNumber: string;
  arrivalDate: string;
  departureDate: string;
  conflictsWith: string;
  from: string;
  to: string;
  /** Куда посадили вместо занятой ячейки; null — свободной в категории не нашлось */
  movedTo: string | null;
  /** Переезд внутри срока (ADR-044): до ночи at — movedTo, с неё — ячейка to */
  split?: { at: string; to: string };
}
const zero = (): EntityCounts => ({ created: 0, updated: 0 });
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const nextDay = (d: string) => iso(new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000));

/**
 * Идемпотентный импорт броней (внутри одной транзакции). Ключи: Reservation (property, confirmation_number),
 * ReservationItem.exely_room_stay_id, Guest.exely_person_id, Allocation — одна на проживание при импорте, две при
 * переезде внутри срока (ADR-044).
 * Единица — только по явному «№ комнаты в Exely» (InventoryUnit.exely_room_number), ничего не выводится.
 */
export async function importReservations(
  tx: DbTx,
  records: ReservationImportRecord[],
  opts: ReservationsImportOptions,
): Promise<ReservationsImportReport> {
  const report: ReservationsImportReport = {
    reservations: zero(),
    items: zero(),
    guests: zero(),
    allocations: { ...zero(), released: 0 },
    stayGuests: { linked: 0 },
    unassigned: 0,
    paymentsImported: 0,
    conflicts: [],
    vanished: [],
    vanishedKept: [],
    retained: 0,
  };
  const today = opts.today ?? iso(new Date(Date.now() + 5 * 3_600_000));
  const types = await tx.accommodationType.findMany({
    where: { propertyId: opts.propertyId },
    select: { id: true, code: true },
  });
  const typeIdByCode = new Map(types.map((t) => [t.code, t.id]));
  /** Проживания, чью ячейку из Exely занять не удалось: рассаживаются после основного прохода */
  const displaced: Array<{
    itemId: string;
    typeId: string;
    start: Date;
    end: Date;
    conflictIndex: number;
    /** Ячейка из Exely и ночь, с которой она свободна до конца срока (переезд уже был) */
    exelyUnitId: string | null;
    exelyFrom: string | null;
  }> = [];
  /** Проживания с ячейкой из Exely: места раздаются всей пачкой после основного прохода (seat-plan.ts) */
  const seating: Array<{
    request: SeatRequest;
    /** Нынешние назначения по возрастанию дат */
    current: Array<{ id: string; unitId: string; start: string; end: string }>;
    confirmationNumber: string;
    exelyRoomNumber: string;
  }> = [];
  const units = await tx.inventoryUnit.findMany({
    where: { accommodationType: { propertyId: opts.propertyId } },
    select: { id: true, code: true, exelyRoomNumber: true },
  });
  const codeOf = new Map(units.map((u) => [u.id, u.code]));
  const unitIdByExely = new Map(
    units.filter((u) => u.exelyRoomNumber).map((u) => [u.exelyRoomNumber!, u.id]),
  );

  const upsertGuest = async (g: GuestImportRecord): Promise<string> => {
    const data = opts.anonymizeSalt ? anonymizeGuest(g, opts.anonymizeSalt) : g;
    const existing = await tx.guest.findUnique({
      where: { exelyPersonId: g.exelyPersonId },
      select: { id: true },
    });
    const fields = {
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      birthDate: data.birthDate ? asDate(data.birthDate) : null,
      gender: data.gender,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
    };
    // Q-118: гражданство вводит стойка перед заселением; пустое из Exely его не затирает (undefined = не писать)
    const citizenship = guestCitizenshipOnUpdate(data.citizenship);
    if (existing) {
      await tx.guest.update({
        where: { id: existing.id },
        data: citizenship === undefined ? fields : { ...fields, citizenship },
      });
      report.guests.updated += 1;
      return existing.id;
    }
    const created = await tx.guest.create({
      data: { exelyPersonId: g.exelyPersonId, ...fields, citizenship: citizenship ?? null },
      select: { id: true },
    });
    report.guests.created += 1;
    return created.id;
  };
  const placeholder = (exelyPersonId: string): GuestImportRecord => ({
    exelyPersonId,
    firstName: '',
    lastName: '',
    middleName: null,
    birthDate: null,
    citizenship: null,
    gender: 'UNKNOWN',
    email: null,
    phone: null,
    notes: null,
  });

  for (const r of records) {
    const guestIdByExely = new Map<string, string>();
    guestIdByExely.set(r.customer.exelyPersonId, await upsertGuest(r.customer));
    for (const it of r.items)
      for (const gid of it.guestExelyIds) {
        if (!guestIdByExely.has(gid)) guestIdByExely.set(gid, await upsertGuest(placeholder(gid)));
      }

    const resKey = {
      propertyId_confirmationNumber: {
        propertyId: opts.propertyId,
        confirmationNumber: r.confirmationNumber,
      },
    };
    const resData = {
      source: r.source,
      channel: r.channel,
      externalId: r.externalId,
      status: r.status,
      arrivalDate: asDate(r.arrivalDate),
      departureDate: asDate(r.departureDate),
      adults: r.adults,
      children: r.children,
      currency: r.currency,
      totalAmount: r.totalAmountMinor,
      primaryGuestId: guestIdByExely.get(r.customer.exelyPersonId)!,
      notes: opts.anonymizeSalt ? anonymizeReservationNotes(r.notes) : r.notes,
    };
    const existingRes = await tx.reservation.findUnique({ where: resKey, select: { id: true } });
    const reservationId = existingRes
      ? (await tx.reservation.update({ where: resKey, data: resData, select: { id: true } })).id
      : (
          await tx.reservation.create({
            data: {
              propertyId: opts.propertyId,
              confirmationNumber: r.confirmationNumber,
              ...resData,
            },
            select: { id: true },
          })
        ).id;
    if (existingRes) report.reservations.updated += 1;
    else report.reservations.created += 1;

    for (const it of r.items) {
      const typeId = typeIdByCode.get(it.accommodationTypeCode);
      if (!typeId)
        throw new Error(
          `Бронь ${r.confirmationNumber}: категория ${it.accommodationTypeCode} не найдена в БД`,
        );
      const itemData = {
        reservationId,
        accommodationTypeId: typeId,
        // Гости на проживании (Q-102); тариф Exely на проживании не отдаёт — остаётся null
        adults: it.adults,
        children: it.children,
        arrivalDate: asDate(it.arrivalDate),
        departureDate: asDate(it.departureDate),
        price: it.priceMinor,
        status: it.status,
      };
      const existingItem = await tx.reservationItem.findUnique({
        where: { exelyRoomStayId: it.exelyRoomStayId },
        select: { id: true },
      });
      const itemId = existingItem
        ? (
            await tx.reservationItem.update({
              where: { id: existingItem.id },
              data: itemData,
              select: { id: true },
            })
          ).id
        : (
            await tx.reservationItem.create({
              data: { exelyRoomStayId: it.exelyRoomStayId, ...itemData },
              select: { id: true },
            })
          ).id;
      if (existingItem) report.items.updated += 1;
      else report.items.created += 1;
      const holdsUnit = it.status !== 'CANCELLED' && it.status !== 'NO_SHOW';
      // Счёт на проживание + начисление = цена (у отменённых / незаездов — сторнировано);
      // оплаченное в Exely — платёж EXTERNAL (DATA_MODEL §6)
      const { folioId } = await ensureFolioWithAccommodation(tx, {
        reservationItemId: itemId,
        currency: r.currency,
        amountMinor: it.priceMinor,
        description: `Проживание ${it.arrivalDate} → ${it.departureDate}`,
        serviceDate: it.arrivalDate,
        active: holdsUnit,
      });
      const paid = await recordImportedPayment(tx, {
        propertyId: opts.propertyId,
        folioId,
        roomStayId: it.exelyRoomStayId,
        paidMinor: it.paidMinor,
        currency: r.currency,
      });
      if (paid === 'created') report.paymentsImported += 1;
      // ADR-051 (Q-128): отменено / незаезд, оплачено в Exely и не возвращено — Exely держит начисление и баланс 0.
      // У нас начисление за проживание сторнировано, поэтому удержание — отдельным начислением на сумму оплаты;
      // вернулось в активное или появился возврат — удержание сторнируется. Только для перенесённых проживаний.
      const retentionWanted = !holdsUnit && it.paidMinor > 0n && it.refundMinor === 0n;
      // у только что созданного проживания сторнировать нечего — без лишнего запроса на каждое из ~1 800
      if (retentionWanted || existingItem) {
        const retention = await ensureSingleActiveCharge(tx, {
          folioId,
          kind: 'PENALTY',
          matchDescription: RETENTION_DESCRIPTION,
          description: RETENTION_DESCRIPTION,
          amountMinor: it.paidMinor,
          serviceDate: it.arrivalDate,
          wanted: retentionWanted,
        });
        if (retention === 'created') report.retained += 1;
      }

      // Отменённое / незаехавшее проживание ячейку не занимает (запрет пересечений в БД безусловный):
      // назначение не создаём, а существующее снимаем — как делает команда отмены на стойке.
      if (!holdsUnit) {
        const removed = await tx.allocation.deleteMany({ where: { reservationItemId: itemId } });
        report.allocations.released += removed.count;
      }
      if (it.exelyRoomNumber && holdsUnit) {
        const unitId = unitIdByExely.get(it.exelyRoomNumber);
        if (!unitId)
          throw new Error(
            `Бронь ${r.confirmationNumber}: единица «${it.exelyRoomNumber}» не найдена в фонде`,
          );
        const current = await tx.allocation.findMany({
          where: { reservationItemId: itemId },
          select: {
            id: true,
            inventoryUnitId: true,
            startDate: true,
            endDate: true,
            inventoryUnit: { select: { accommodationTypeId: true } },
          },
          orderBy: { startDate: 'asc' },
        });
        // Место решается после прохода по всей пачке: Exely меняет гостей местами, и по одному проживанию
        // обмен не проходит — место из Exely ещё занято не обработанным соседом (14.09.2026)
        seating.push({
          request: {
            itemId,
            typeId,
            desiredUnitId: unitId,
            start: it.arrivalDate,
            end: it.departureDate,
            current: current.map((c) => ({
              unitId: c.inventoryUnitId,
              typeId: c.inventoryUnit.accommodationTypeId,
              start: iso(c.startDate),
              end: iso(c.endDate),
            })),
          },
          current: current.map((c) => ({
            id: c.id,
            unitId: c.inventoryUnitId,
            start: iso(c.startDate),
            end: iso(c.endDate),
          })),
          confirmationNumber: r.confirmationNumber,
          exelyRoomNumber: it.exelyRoomNumber,
        });
      } else if (holdsUnit) {
        report.unassigned += 1;
      }

      for (const gid of it.guestExelyIds) {
        const guestId = guestIdByExely.get(gid)!;
        await tx.stayGuest.upsert({
          where: { reservationItemId_guestId: { reservationItemId: itemId, guestId } },
          create: {
            reservationItemId: itemId,
            guestId,
            isPrimary: gid === r.customer.exelyPersonId,
          },
          update: { isPrimary: gid === r.customer.exelyPersonId },
        });
        report.stayGuests.linked += 1;
      }
    }

    // ADR-050 (Q-127): живая карточка брони приходит целиком (cancelVanished — только cli-sync-day); проживание,
    // которого в ней больше нет, в Exely удалено или перенесено в другую бронь. Отменяем его как отмену: ячейка
    // снимается, начисление сторнируется, штраф не начисляется. Предохранители: карточка не пустая; проживание ещё
    // не закончилось (прошлое уже прожили); уже отменённое / незаезд / выехавшее не трогаем; заселённого гостя и
    // оплаченное проживание не трогаем, а называем в отчёте — это к человеку (Q-134). Повтор ничего не делает.
    if (opts.cancelVanished && r.items.length > 0) {
      const present = new Set(r.items.map((it) => it.exelyRoomStayId));
      const gone = await tx.reservationItem.findMany({
        where: {
          reservationId,
          exelyRoomStayId: { not: null },
          status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] },
          departureDate: { gte: asDate(today) },
        },
        select: {
          id: true,
          exelyRoomStayId: true,
          status: true,
          arrivalDate: true,
          departureDate: true,
          price: true,
          accommodationType: { select: { code: true } },
          folio: { select: { allocations: { where: { payment: { status: 'COMPLETED' } }, select: { amount: true } } } },
        },
      });
      for (const item of gone) {
        if (present.has(item.exelyRoomStayId!)) continue;
        const stay: VanishedStay = {
          confirmationNumber: r.confirmationNumber,
          exelyRoomStayId: item.exelyRoomStayId!,
          accommodationTypeCode: item.accommodationType.code,
          arrivalDate: iso(item.arrivalDate),
          departureDate: iso(item.departureDate),
        };
        const paid = (item.folio?.allocations ?? []).some((p) => p.amount > 0n);
        if (item.status === 'CHECKED_IN' || paid) {
          report.vanishedKept.push({ ...stay, reason: item.status === 'CHECKED_IN' ? 'checked-in' : 'paid' });
          continue;
        }
        await tx.reservationItem.update({ where: { id: item.id }, data: { status: 'CANCELLED' } });
        const removed = await tx.allocation.deleteMany({ where: { reservationItemId: item.id } });
        report.allocations.released += removed.count;
        await ensureFolioWithAccommodation(tx, {
          reservationItemId: item.id,
          currency: r.currency,
          amountMinor: item.price,
          description: `Проживание ${stay.arrivalDate} → ${stay.departureDate}`,
          serviceDate: stay.arrivalDate,
          active: false,
        });
        await tx.auditLog.create({
          data: {
            entityType: 'ReservationItem',
            entityId: item.id,
            action: 'reservation.item.vanished',
            before: { status: item.status, exelyRoomStayId: item.exelyRoomStayId },
            after: {
              status: 'CANCELLED',
              confirmationNumber: r.confirmationNumber,
              reason: 'проживания больше нет в карточке брони Exely (ADR-050)',
            },
          },
        });
        report.vanished.push(stay);
      }
    }
  }

  // ── Места из Exely всей пачкой ──
  // Занятость — только чужие назначения на эти даты (статус проживания не фильтруется: запрет пересечений
  // в БД безусловный). Прежняя пересадка сохраняется, если место из Exely занято, а прежнее своё — свободно.
  if (seating.length > 0) {
    const from = seating.reduce((m, q) => (q.request.start < m ? q.request.start : m), seating[0]!.request.start);
    const to = seating.reduce((m, q) => (q.request.end > m ? q.request.end : m), seating[0]!.request.end);
    const others = await tx.allocation.findMany({
      where: {
        reservationItemId: { notIn: seating.map((q) => q.request.itemId) },
        startDate: { lt: asDate(to) },
        endDate: { gt: asDate(from) },
        inventoryUnit: { accommodationType: { propertyId: opts.propertyId } },
      },
      select: {
        inventoryUnitId: true,
        reservationItemId: true,
        startDate: true,
        endDate: true,
        reservationItem: { select: { reservation: { select: { confirmationNumber: true } } } },
      },
    });
    const numberOf = new Map<string, string>([
      ...others.map((o) => [o.reservationItemId, o.reservationItem.reservation.confirmationNumber] as const),
      ...seating.map((q) => [q.request.itemId, q.confirmationNumber] as const),
    ]);
    const decisions = planSeats(
      seating.map((q) => q.request),
      others.map((o) => ({
        unitId: o.inventoryUnitId,
        itemId: o.reservationItemId,
        start: iso(o.startDate),
        end: iso(o.endDate),
      })),
      today,
    );
    const unchanged = (q: (typeof seating)[number], segments: Segment[]) =>
      q.current.length === segments.length &&
      q.current.every(
        (c, k) => c.unitId === segments[k]!.unitId && c.start === segments[k]!.start && c.end === segments[k]!.end,
      );
    // Сначала снимаются все назначения, которые меняются (ячейка или даты): запрет пересечений в БД проверяет каждую
    // запись сразу, и новое назначение соседа по обмену не встанет, пока старое не снято
    for (const [i, d] of decisions.entries()) {
      const q = seating[i]!;
      const segments = d.kind === 'displaced' ? [] : d.segments;
      if (q.current.length === 0 || unchanged(q, segments)) continue;
      const removed = await tx.allocation.deleteMany({ where: { reservationItemId: q.request.itemId } });
      if (segments.length === 0) report.allocations.released += removed.count;
    }
    for (const [i, d] of decisions.entries()) {
      const q = seating[i]!;
      const req = q.request;
      if (d.kind !== 'displaced') {
        if (!unchanged(q, d.segments))
          for (const seg of d.segments)
            await tx.allocation.create({
              data: {
                reservationItemId: req.itemId,
                inventoryUnitId: seg.unitId,
                startDate: asDate(seg.start),
                endDate: asDate(seg.end),
              },
            });
        // назначение того же проживания переписано (или осталось прежним), а не заведено заново
        if (q.current.length > 0) report.allocations.updated += 1;
        else report.allocations.created += 1;
      }
      if (d.kind === 'desired') continue;
      if (d.kind === 'displaced') {
        displaced.push({
          itemId: req.itemId,
          typeId: req.typeId,
          start: asDate(req.start),
          end: asDate(req.end),
          conflictIndex: report.conflicts.length,
          exelyUnitId: req.desiredUnitId,
          exelyFrom: d.exelyFrom,
        });
        report.unassigned += 1;
      }
      report.conflicts.push({
        confirmationNumber: q.confirmationNumber,
        exelyRoomNumber: q.exelyRoomNumber,
        arrivalDate: req.start,
        departureDate: req.end,
        conflictsWith: numberOf.get(d.conflict.itemId) ?? d.conflict.itemId,
        from: d.conflict.start,
        to: d.conflict.end,
        // «посажен на»: своя ячейка (до переезда); вытесненным ячейки подберёт проход ниже
        movedTo: d.kind === 'displaced' ? null : (codeOf.get(d.segments[0]!.unitId) ?? null),
        ...(d.kind === 'moved'
          ? { split: { at: d.segments[1]!.start, to: codeOf.get(d.segments[1]!.unitId) ?? d.segments[1]!.unitId } }
          : {}),
      });
    }
  }

  await tx.auditLog.create({
    data: {
      entityType: 'Property',
      entityId: opts.propertyId,
      action: 'reservations.import',
      after: JSON.parse(
        JSON.stringify({
          ...report,
          anonymized: opts.anonymizeSalt !== null,
          count: records.length,
        }),
      ),
    },
  });

  // ── Рассадка вытесненных: все назначения из Exely уже сделаны, свободное — действительно свободно ──
  // Гость без ячейки не виден на шахматке вовсе, поэтому пустая ячейка той же категории лучше, чем ничего; исходная
  // комната названа в отчёте, стойка переселит, если нужна именно она. По порядку (ADR-044):
  //  а) переезд уже был — первые ночи на свободной ячейке категории, дальше место из Exely;
  //  б) первая свободная ячейка на весь срок (как было);
  //  в) две ячейки с одним переездом: свободная с первой ночи дольше других, дальше место из Exely или первая свободная.
  // Место из Exely проверяется только по назначениям (как в рассадке пачки), остальные ячейки — и по блокировкам.
  const num = (c: string) => (/^\d+$/.test(c) ? Number(c) : Number.POSITIVE_INFINITY);
  for (const d of displaced) {
    const start = iso(d.start);
    const end = iso(d.end);
    const candidates = await tx.inventoryUnit.findMany({
      where: { accommodationTypeId: d.typeId, active: true },
      select: {
        id: true,
        code: true,
        allocations: {
          where: { startDate: { lt: d.end }, endDate: { gt: d.start } },
          select: { startDate: true, endDate: true },
        },
        blocks: {
          where: { dateFrom: { lt: d.end }, dateTo: { gt: d.start } },
          select: { dateFrom: true, dateTo: true },
        },
      },
    });
    candidates.sort((a, b) => num(a.code) - num(b.code) || a.code.localeCompare(b.code));
    type Unit = (typeof candidates)[number];
    const freeOn = (u: Unit, from: string, to: string) =>
      !u.allocations.some((a) => iso(a.startDate) < to && from < iso(a.endDate)) &&
      (u.id === d.exelyUnitId || !u.blocks.some((b) => iso(b.dateFrom) < to && from < iso(b.dateTo)));
    const exely = candidates.find((u) => u.id === d.exelyUnitId);

    let seats: Array<{ unit: Unit; start: string; end: string }> | null = null;
    if (d.exelyFrom && exely && freeOn(exely, d.exelyFrom, end)) {
      const first = candidates.find((u) => u !== exely && freeOn(u, start, d.exelyFrom!));
      if (first)
        seats = [
          { unit: first, start, end: d.exelyFrom },
          { unit: exely, start: d.exelyFrom, end },
        ];
    }
    if (!seats) {
      const one = candidates.find((u) => freeOn(u, start, end));
      if (one) seats = [{ unit: one, start, end }];
    }
    if (!seats) {
      const freeUntil = (u: Unit) => {
        let night = start;
        while (night < end && freeOn(u, night, nextDay(night))) night = nextDay(night);
        return night;
      };
      // дольше всех свободная с первой ночи; при равенстве — меньший номер (кандидаты уже по номеру, сортировка устойчивая)
      const longest = candidates
        .map((unit) => ({ unit, until: freeUntil(unit) }))
        .filter((x) => x.until > start)
        .sort((a, b) => (a.until < b.until ? 1 : a.until > b.until ? -1 : 0))[0];
      if (longest) {
        const second =
          exely && exely !== longest.unit && freeOn(exely, longest.until, end)
            ? exely
            : candidates.find((u) => u !== longest.unit && freeOn(u, longest.until, end));
        if (second)
          seats = [
            { unit: longest.unit, start, end: longest.until },
            { unit: second, start: longest.until, end },
          ];
      }
    }
    if (!seats) continue;
    for (const seat of seats)
      await tx.allocation.create({
        data: {
          reservationItemId: d.itemId,
          inventoryUnitId: seat.unit.id,
          startDate: asDate(seat.start),
          endDate: asDate(seat.end),
        },
      });
    report.allocations.created += 1;
    report.unassigned -= 1;
    const conflict = report.conflicts[d.conflictIndex]!;
    conflict.movedTo = seats[0]!.unit.code;
    if (seats.length === 2) conflict.split = { at: seats[1]!.start, to: seats[1]!.unit.code };
  }

  return report;
}
