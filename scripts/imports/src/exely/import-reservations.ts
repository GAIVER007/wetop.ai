import { ensureFolioWithAccommodation, recordImportedPayment, type DbTx } from '@pms/database';
import { anonymizeGuest, anonymizeReservationNotes } from './anonymize';
import { guestCitizenshipOnUpdate } from './guest-fields';
import type { EntityCounts } from './import-inventory';
import type { GuestImportRecord, ReservationImportRecord } from './normalize-reservation';
import { planSeats, type SeatRequest } from './seat-plan';

export interface ReservationsImportOptions {
  propertyId: string;
  /** Соль анонимизации для dev-БД (ADR-018). null — только для production в РК, по отдельному разрешению. */
  anonymizeSalt: string | null;
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
}
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
}
const zero = (): EntityCounts => ({ created: 0, updated: 0 });
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

/**
 * Идемпотентный импорт броней (внутри одной транзакции). Ключи: Reservation (property, confirmation_number),
 * ReservationItem.exely_room_stay_id, Guest.exely_person_id, Allocation — одна на проживание при импорте.
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
  };
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
  }> = [];
  /** Проживания с ячейкой из Exely: места раздаются всей пачкой после основного прохода (seat-plan.ts) */
  const seating: Array<{
    request: SeatRequest;
    currentId: string | null;
    currentCode: string | null;
    confirmationNumber: string;
    exelyRoomNumber: string;
  }> = [];
  const units = await tx.inventoryUnit.findMany({
    where: { accommodationType: { propertyId: opts.propertyId } },
    select: { id: true, exelyRoomNumber: true },
  });
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
        const current = await tx.allocation.findFirst({
          where: { reservationItemId: itemId },
          select: {
            id: true,
            inventoryUnitId: true,
            inventoryUnit: { select: { code: true, accommodationTypeId: true } },
          },
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
            current: current
              ? { unitId: current.inventoryUnitId, typeId: current.inventoryUnit.accommodationTypeId }
              : null,
          },
          currentId: current?.id ?? null,
          currentCode: current?.inventoryUnit.code ?? null,
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
  }

  // ── Места из Exely всей пачкой ──
  // Занятость — только чужие назначения на эти даты (статус проживания не фильтруется: запрет пересечений
  // в БД безусловный). Прежняя пересадка сохраняется, если место из Exely занято, а прежнее своё — свободно.
  if (seating.length > 0) {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
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
    );
    // Сначала снимаются назначения, которые меняют ячейку: иначе запрет пересечений не пустит соседа по обмену
    for (const [i, d] of decisions.entries()) {
      const q = seating[i]!;
      const target = d.kind === 'displaced' ? null : d.unitId;
      if (q.currentId && q.request.current!.unitId !== target) {
        const removed = await tx.allocation.deleteMany({ where: { reservationItemId: q.request.itemId } });
        if (d.kind === 'displaced') report.allocations.released += removed.count;
      }
    }
    for (const [i, d] of decisions.entries()) {
      const q = seating[i]!;
      const req = q.request;
      if (d.kind !== 'displaced') {
        const data = { inventoryUnitId: d.unitId, startDate: asDate(req.start), endDate: asDate(req.end) };
        if (q.currentId && req.current!.unitId === d.unitId) {
          await tx.allocation.update({ where: { id: q.currentId }, data });
          report.allocations.updated += 1;
        } else {
          await tx.allocation.create({ data: { reservationItemId: req.itemId, ...data } });
          // пересадка на место из Exely — назначение того же проживания переписано, а не заведено заново
          if (q.currentId) report.allocations.updated += 1;
          else report.allocations.created += 1;
        }
      }
      if (d.kind === 'desired') continue;
      if (d.kind === 'displaced') {
        displaced.push({
          itemId: req.itemId,
          typeId: req.typeId,
          start: asDate(req.start),
          end: asDate(req.end),
          conflictIndex: report.conflicts.length,
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
        // «посажен на»: прежняя пересадка; вытесненным ячейку подберёт проход ниже
        movedTo: d.kind === 'kept' ? q.currentCode : null,
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
  // Гость без ячейки не виден на шахматке вовсе, поэтому пустая ячейка той же категории лучше, чем
  // ничего; исходная комната названа в отчёте, стойка переселит, если нужна именно она.
  const num = (c: string) => (/^\d+$/.test(c) ? Number(c) : Number.POSITIVE_INFINITY);
  for (const d of displaced) {
    const free = await tx.inventoryUnit.findMany({
      where: {
        accommodationTypeId: d.typeId,
        active: true,
        allocations: { none: { startDate: { lt: d.end }, endDate: { gt: d.start } } },
        blocks: { none: { dateFrom: { lt: d.end }, dateTo: { gt: d.start } } },
      },
      select: { id: true, code: true },
    });
    free.sort((a, b) => num(a.code) - num(b.code) || a.code.localeCompare(b.code));
    const unit = free[0];
    if (!unit) continue;
    await tx.allocation.create({
      data: {
        reservationItemId: d.itemId,
        inventoryUnitId: unit.id,
        startDate: d.start,
        endDate: d.end,
      },
    });
    report.allocations.created += 1;
    report.unassigned -= 1;
    report.conflicts[d.conflictIndex]!.movedTo = unit.code;
  }

  return report;
}
