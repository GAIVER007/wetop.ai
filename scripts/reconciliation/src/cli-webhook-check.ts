/**
 * Проверка приёма броней из Channex без ПД: последние внешние события (webhook / лента) и последние брони канала.
 * Запуск: npx tsx scripts/reconciliation/src/cli-webhook-check.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
const db = createPrismaClient();
try {
  const events = await db.externalEvent.findMany({
    where: { provider: 'channex' },
    orderBy: { receivedAt: 'desc' },
    take: 8,
    select: {
      externalEventId: true,
      type: true,
      status: true,
      receivedAt: true,
      processedAt: true,
      lastError: true,
    },
  });
  console.log('Последние события Channex:');
  console.table(
    events.map((e) => ({
      id: e.externalEventId.slice(0, 40),
      type: e.type,
      status: e.status,
      received: e.receivedAt.toISOString().slice(0, 19),
      processed: e.processedAt?.toISOString().slice(0, 19) ?? '',
      error: e.lastError?.slice(0, 60) ?? '',
    })),
  );
  const reservations = await db.reservation.findMany({
    where: { channel: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      confirmationNumber: true,
      channel: true,
      externalId: true,
      status: true,
      arrivalDate: true,
      departureDate: true,
      createdAt: true,
      items: { select: { status: true, allocations: { select: { id: true } } } },
    },
  });
  console.log('Последние брони каналов:');
  console.table(
    reservations.map((r) => ({
      number: r.confirmationNumber,
      channel: r.channel,
      externalId: r.externalId?.slice(0, 36) ?? '',
      status: r.status,
      stay: `${r.arrivalDate.toISOString().slice(0, 10)} → ${r.departureDate.toISOString().slice(0, 10)}`,
      items: r.items.length,
      allocated: r.items.filter((i) => i.allocations.length > 0).length,
      created: r.createdAt.toISOString().slice(0, 19),
    })),
  );
} finally {
  await db.$disconnect();
}
