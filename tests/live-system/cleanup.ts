import type { Db } from '@pms/database';

/** Delete only this run's synthetic records. Never broad surname/age cleanup on shared DB. */
export async function cleanupAudit(db: Db, marker: string): Promise<void> {
  if (!/^E2E-АВТОТЕСТ audit-[0-9a-f-]{36}$/.test(marker)) throw new Error('Invalid audit marker');
  await db.$transaction(
    async (tx) => {
      const reservations = await tx.reservation.findMany({
        where: { notes: { startsWith: marker } },
        include: { items: { include: { folio: true } }, primaryGuest: true },
      });
      for (const r of reservations) {
        if (!r.primaryGuest || r.primaryGuest.notes !== marker) {
          // Guest notes are set immediately after create; before that the unique synthetic surname is required.
          if (r.primaryGuest?.lastName !== `Аудит-${marker.slice(-12)}`)
            throw new Error('Foreign guest: cleanup refused');
        }
        const guestId = r.primaryGuestId!;
        if (await tx.reservation.count({ where: { primaryGuestId: guestId, id: { not: r.id } } }))
          throw new Error('Guest reused: cleanup refused');
        const itemIds = r.items.map((i) => i.id);
        const folioIds = r.items.flatMap((i) => (i.folio ? [i.folio.id] : []));
        const payments = await tx.payment.findMany({
          where: { allocations: { some: { folioId: { in: folioIds } } } },
          include: { allocations: true },
        });
        if (
          payments.some(
            (p) => p.note !== marker || p.allocations.some((a) => !folioIds.includes(a.folioId)),
          )
        )
          throw new Error('Foreign payment: cleanup refused');
        const paymentIds = payments.map((p) => p.id);
        await tx.refund.deleteMany({ where: { folioId: { in: folioIds } } });
        await tx.paymentAllocation.deleteMany({ where: { folioId: { in: folioIds } } });
        await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
        await tx.charge.deleteMany({ where: { folioId: { in: folioIds } } });
        await tx.folio.deleteMany({ where: { id: { in: folioIds } } });
        await tx.allocation.deleteMany({ where: { reservationItemId: { in: itemIds } } });
        await tx.stayGuest.deleteMany({ where: { reservationItemId: { in: itemIds } } });
        await tx.reservationItem.deleteMany({ where: { id: { in: itemIds } } });
        await tx.reservation.delete({ where: { id: r.id } });
        await tx.guestDocument.deleteMany({ where: { guestId } });
        await tx.guest.delete({ where: { id: guestId } });
        // API audit records remain as evidence. No existing audit history is removed.
      }
      await tx.trackedSite.deleteMany({ where: { name: marker } });
      await tx.inventoryBlock.deleteMany({ where: { reason: marker } });
    },
    { timeout: 30_000 },
  );
}
