/**
 * Проверка приёма броней из Channex без ПД: последние внешние события (webhook / лента) и последние брони канала.
 * Пишет отчёт в reports/webhook-check-<дата>.md — иначе «бронь приходит сама» подтверждается только
 * текстом в переписке, а машинного следа не остаётся.
 * Запуск: npx tsx scripts/reconciliation/src/cli-webhook-check.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
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
      receivedVia: true,
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
      via: e.receivedVia,
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

  // ── машинный след: без файла утверждение «бронь пришла сама» ничем не подтверждается ──
  const stamp = new Date().toISOString();
  const VIA = { WEBHOOK: 'сама (webhook)', PULL: 'опрос ленты', MANUAL: 'вручную' } as const;
  const byWebhook = events.filter((e) => e.receivedVia === 'WEBHOOK').length;
  const lines = [
    `# Приём броней из Channex — проверка`,
    '',
    `CONTROL: ${stamp.slice(0, 19)} UTC · событий в выборке ${events.length}, из них по webhook ${byWebhook}`,
    '',
    '## Последние события канала',
    '',
    '| Событие | Тип | Как дошло | Статус | Получено | Обработано | Ошибка |',
    '|---|---|---|---|---|---|---|',
    ...events.map(
      (e) =>
        `| \`${e.externalEventId.slice(0, 40)}\` | ${e.type} | ${VIA[e.receivedVia]} | ${e.status} | ` +
        `${e.receivedAt.toISOString().slice(0, 19)} | ${e.processedAt?.toISOString().slice(0, 19) ?? '—'} | ` +
        `${e.lastError?.slice(0, 60) ?? ''} |`,
    ),
    '',
    '## Последние брони каналов',
    '',
    '| Бронь | Канал | Статус | Проживание | Проживаний | С ячейкой | Создана |',
    '|---|---|---|---|---:|---:|---|',
    ...reservations.map(
      (r) =>
        `| ${r.confirmationNumber} | ${r.channel} | ${r.status} | ` +
        `${r.arrivalDate.toISOString().slice(0, 10)} → ${r.departureDate.toISOString().slice(0, 10)} | ` +
        `${r.items.length} | ${r.items.filter((i) => i.allocations.length > 0).length} | ` +
        `${r.createdAt.toISOString().slice(0, 19)} |`,
    ),
    '',
    byWebhook
      ? 'RESULT: OK — есть события, дошедшие по webhook, то есть бронь приходит без опроса ленты.'
      : 'RESULT: событий по webhook в выборке нет — приём подтверждён только опросом ленты.',
    '',
  ];
  mkdirSync('reports', { recursive: true });
  const file = `reports/webhook-check-${stamp.slice(0, 10)}.md`;
  writeFileSync(file, lines.join('\n'), 'utf-8');
  console.log(`→ ${file}`);
} finally {
  await db.$disconnect();
}
