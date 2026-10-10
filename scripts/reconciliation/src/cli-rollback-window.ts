/**
 * Сверка окна отката (CUTOVER.md ROLLBACK, шаг 6). Берёт из Channex все ревизии броней объекта за окно
 * [--from, --to], находит каждую в журнале входящих событий PMS и печатает:
 *   1) ни одна ли бронь не потеряна (ревизия без события, событие FAILED/не обработано);
 *   2) что администратор повторяет в Exely, если канал возвращается к Exely (создать / изменить / отменить / сверить).
 * Работает без API PMS — откатываются как раз тогда, когда PMS может лежать: читает Channex и базу напрямую.
 * Только чтение. Без ПД: номера броней, каналы, даты, суммы.
 *
 * Запуск: npx tsx scripts/reconciliation/src/cli-rollback-window.ts --from=2026-09-13T13:00:00Z [--to=…] [--channel=Booking.com]
 * Пишет reports/rollback-window-<начало окна, ГГГГ-ММ-ДДTЧЧММZ>.md. Код выхода: 0 — всё принято и разобрано; 1 — есть потери или неразобранные.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { channex } from '@pms/integrations';
import {
  exelyActions,
  matchRevisions,
  parseChannexTime,
  type ChannexRevision,
  type ExelyAction,
  type RevisionOutcome,
} from './rollback-window';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const from = new Date(arg('from') ?? '');
const to = arg('to') ? new Date(arg('to')!) : new Date();
const channelFilter = arg('channel');
if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to)
  throw new Error(
    'нужно --from=<ISO UTC> раньше --to=<ISO UTC>, например --from=2026-09-13T13:00:00Z',
  );
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');

const db = createPrismaClient();
try {
  const mapping = await db.channelMapping.findFirst({
    where: { provider: 'channex' },
    select: { providerPropertyId: true },
  });
  if (!mapping) throw new Error('маппинг Channex пуст — объект не настроен');
  const propertyId = mapping.providerPropertyId;
  const client = new channex.ChannexClient({
    ...(process.env.CHANNEX_API_BASE_URL?.trim()
      ? { apiKey, baseUrl: process.env.CHANNEX_API_BASE_URL.trim() }
      : { apiKey }),
    allowProduction: channex.channexProductionAllowed(),
  });

  // bookings-collection.md «Booking Revisions List» + api-reference.md: filter[property_id], order[field], pagination (limit ≤ 100)
  interface RevisionAttrs {
    booking_id: string;
    unique_id: string;
    ota_name: string;
    status: string;
    inserted_at: string;
    arrival_date: string;
    departure_date: string;
    amount: string;
  }
  const revisions: ChannexRevision[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const q = new URLSearchParams({
      'filter[property_id]': propertyId,
      'order[inserted_at]': 'desc',
      'pagination[page]': String(page),
      'pagination[limit]': '100',
    });
    const res = await client.request<{ data: Array<{ id: string; attributes: RevisionAttrs }> }>(
      'GET',
      `/booking_revisions?${q.toString()}`,
    );
    let older = false;
    for (const r of res.data) {
      const a = r.attributes;
      const insertedAt = parseChannexTime(a.inserted_at);
      if (insertedAt < from) {
        older = true;
        continue;
      }
      if (insertedAt > to) continue;
      if (channelFilter && a.ota_name !== channelFilter) continue;
      if (!['new', 'modified', 'cancelled'].includes(a.status)) continue;
      revisions.push({
        revisionId: r.id,
        bookingId: a.booking_id,
        uniqueId: a.unique_id,
        otaName: a.ota_name,
        status: a.status as ChannexRevision['status'],
        insertedAt,
        arrivalDate: a.arrival_date,
        departureDate: a.departure_date,
        amount: a.amount,
      });
    }
    if (older || res.data.length < 100) break;
  }

  const events = await db.externalEvent.findMany({
    where: { provider: 'channex', externalEventId: { in: revisions.map((r) => r.revisionId) } },
    select: {
      externalEventId: true,
      status: true,
      receivedVia: true,
      receivedAt: true,
      processedAt: true,
      lastError: true,
    },
  });
  const reservations = await db.reservation.findMany({
    where: { externalId: { in: [...new Set(revisions.map((r) => r.uniqueId))] } },
    select: {
      confirmationNumber: true,
      externalId: true,
      status: true,
      arrivalDate: true,
      departureDate: true,
      totalAmount: true,
    },
  });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const matched = matchRevisions(revisions, events);
  const actions = exelyActions(
    revisions,
    reservations.map((r) => ({
      confirmationNumber: r.confirmationNumber,
      externalId: r.externalId,
      status: r.status,
      arrivalDate: iso(r.arrivalDate),
      departureDate: iso(r.departureDate),
      totalMinor: r.totalAmount,
    })),
  );

  const s = matched.summary;
  const ok =
    s.missing === 0 &&
    s.failed === 0 &&
    s.pending === 0 &&
    !actions.some((a) => a.action === 'lost');
  const OUTCOME: Record<RevisionOutcome, string> = {
    processed: '✅ принята',
    pending: '⏳ в работе',
    failed: '❌ не разобрана',
    missing: '❌ ПОТЕРЯНА',
  };
  const ACTION: Record<ExelyAction, string> = {
    lost: '❌ брони нет в PMS — разобрать сейчас',
    create: 'создать в Exely',
    modify: 'изменить в Exely',
    cancel: 'отменить в Exely',
    verify: 'есть в Exely (перенесена) — сверить даты',
    none: 'ничего: создана и отменена в окне',
  };
  const t = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 19) : '—');
  const lines = [
    `# Окно отката: брони из Channex за ${t(from)} — ${t(to)} UTC`,
    '',
    `Объект Channex \`${propertyId}\`${channelFilter ? `, канал ${channelFilter}` : ', все каналы'}. Шаг 6 плана отката (CUTOVER.md ROLLBACK).`,
    `Снято ${t(new Date())} UTC. Источник: список ревизий Channex и журнал входящих событий PMS; API PMS не нужен.`,
    '',
    ok
      ? '**RESULT: OK** — каждая ревизия Channex за окно принята и разобрана PMS, потерь нет.'
      : '**RESULT: FAIL** — есть потерянные или неразобранные брони, откат не закрывать, пока не разобраны.',
    '',
    '| Показатель | Значение |',
    '|---|---:|',
    `| Ревизий в Channex за окно | ${s.revisions} |`,
    `| Приняты и разобраны PMS | ${s.processed} (webhook ${s.byWebhook}, опрос ленты ${s.byPull}) |`,
    `| В работе | ${s.pending} |`,
    `| Не разобраны (FAILED) | ${s.failed} |`,
    `| **Потеряны** (ревизии нет в PMS) | ${s.missing} |`,
    '',
    '## Что повторить в Exely, если канал возвращается к Exely',
    '',
    actions.length === 0
      ? 'За окно броней из каналов не было — в Exely повторять нечего.'
      : '| Канал | Бронь канала | Номер в PMS | Действие | Итоговые даты | Сумма | Ревизий |',
    ...(actions.length === 0
      ? []
      : [
          '|---|---|---|---|---|---:|---:|',
          ...actions.map(
            (a) =>
              `| ${a.otaName} | ${a.uniqueId} | ${a.pmsNumber ?? '—'} | ${ACTION[a.action]} | ${a.arrivalDate} → ${a.departureDate} | ${a.amount} | ${a.revisions} |`,
          ),
        ]),
    '',
    '## Все ревизии окна',
    '',
    '| Время в Channex | Канал | Бронь | Статус | Даты | В PMS | Как пришла | Принята | Разобрана |',
    '|---|---|---|---|---|---|---|---|---|',
    ...matched.rows.map(
      (r) =>
        `| ${t(r.revision.insertedAt)} | ${r.revision.otaName} | ${r.revision.uniqueId} | ${r.revision.status} | ${r.revision.arrivalDate} → ${r.revision.departureDate} | ${OUTCOME[r.outcome]} | ${r.event?.receivedVia ?? '—'} | ${t(r.event?.receivedAt ?? null)} | ${t(r.event?.processedAt ?? null)} |`,
    ),
    '',
  ];
  const outDir = resolve(ROOT, 'reports');
  mkdirSync(outDir, { recursive: true });
  // Время в имени: окон за одни сутки бывает несколько, и отчёт одного окна не должен затирать другой
  const file = resolve(
    outDir,
    `rollback-window-${from.toISOString().slice(0, 16).replace(':', '')}Z.md`,
  );
  writeFileSync(file, lines.join('\n'));
  console.log(lines.slice(0, 16).join('\n'));
  console.log(`→ ${file}`);
  process.exitCode = ok ? 0 : 1;
} finally {
  await db.$disconnect();
}
