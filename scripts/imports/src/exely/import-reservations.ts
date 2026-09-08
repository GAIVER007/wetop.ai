import type { DbTx } from '@pms/database';
import { anonymizeGuest, anonymizeReservationNotes } from './anonymize';
import type { EntityCounts } from './import-inventory';
import type { GuestImportRecord, ReservationImportRecord } from './normalize-reservation';

export interface ReservationsImportOptions {
  propertyId: string;
  /** Соль анонимизации для dev-БД (ADR-018). null — только для production в РК, по отдельному разрешению. */
  anonymizeSalt: string | null;
}
export interface ReservationsImportReport {
  reservations: EntityCounts;
  items: EntityCounts;
  guests: EntityCounts;
  allocations: EntityCounts;
  stayGuests: { linked: number };
  /** Проживания без назначенной единицы (Exely: roomId = null) */
  unassigned: number;
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
    allocations: zero(),
    stayGuests: { linked: 0 },
    unassigned: 0,
  };
  const types = await tx.accommodationType.findMany({
    where: { propertyId: opts.propertyId },
    select: { id: true, code: true },
  });
  const typeIdByCode = new Map(types.map((t) => [t.code, t.id]));
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
      citizenship: data.citizenship,
      gender: data.gender,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
    };
    if (existing) {
      await tx.guest.update({ where: { id: existing.id }, data: fields });
      report.guests.updated += 1;
      return existing.id;
    }
    const created = await tx.guest.create({
      data: { exelyPersonId: g.exelyPersonId, ...fields },
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

      if (it.exelyRoomNumber) {
        const unitId = unitIdByExely.get(it.exelyRoomNumber);
        if (!unitId)
          throw new Error(
            `Бронь ${r.confirmationNumber}: единица «${it.exelyRoomNumber}» не найдена в фонде`,
          );
        const existingAlloc = await tx.allocation.findFirst({
          where: { reservationItemId: itemId },
          select: { id: true },
        });
        const allocData = {
          inventoryUnitId: unitId,
          startDate: asDate(it.arrivalDate),
          endDate: asDate(it.departureDate),
        };
        if (existingAlloc) {
          await tx.allocation.update({ where: { id: existingAlloc.id }, data: allocData });
          report.allocations.updated += 1;
        } else {
          await tx.allocation.create({ data: { reservationItemId: itemId, ...allocData } });
          report.allocations.created += 1;
        }
      } else {
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
  return report;
}
