/**
 * Учения сторожа системы (срез 11, план §8 шаг 11.9). Подбрасывает в dev-базу техническую поломку, зовёт проход
 * сторожа и показывает, что он сделал; в конце убирает за собой.
 *
 *   npx tsx scripts/ops/guard-drill.ts outbox   упавшая отправка ARI → сторож делает полную выгрузку (Channex staging) → закрыта
 *   npx tsx scripts/ops/guard-drill.ts event    бронь канала отклонена правилом → сторож НЕ повторяет, эскалирует → убрали → закрыта
 *
 * Пишет только в технические таблицы (`channel_outbox`, `external_events`) строки с меткой GUARD-DRILL; брони, гости,
 * счета не трогаются. Работает с API на 127.0.0.1:3001 (API_URL). Полная выгрузка идёт туда же, куда смотрит API, —
 * скрипт отказывается работать, если CHANNEX_API_BASE_URL не staging (пустой — staging, умолчание клиента).
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const MARK = `GUARD-DRILL ${new Date().toISOString()}`;
const kind = process.argv[2];
if (kind !== 'outbox' && kind !== 'event') {
  console.error('Учения: outbox | event');
  process.exit(2);
}
// Адрес Channex — CHANNEX_API_BASE_URL, как у API (до 24.09.2026 здесь читалась CHANNEX_BASE_URL, которой никто не задаёт)
const base = process.env.CHANNEX_API_BASE_URL?.trim() ?? '';
if (kind === 'outbox' && base && !base.includes('staging')) {
  console.error('CHANNEX_API_BASE_URL не staging — учения с полной выгрузкой запрещены');
  process.exit(2);
}

type Incident = {
  id: string;
  kind: string;
  status: string;
  fixAttempts: number;
  lastFixResult: string | null;
  resolvedBy: string | null;
  title: string;
};
const post = async (path: string) => (await fetch(`${API}${path}`, { method: 'POST' })).json();
const get = async (path: string) => (await fetch(`${API}${path}`)).json();
const tick = async () =>
  post('/guard/tick') as Promise<{
    fixes: unknown[];
    resolved: number;
    escalated: number;
    checkErrors: unknown[];
  }>;
const find = async (k: string) =>
  ((await get('/guard/incidents?status=all&limit=50')) as Incident[]).filter(
    (i) => i.kind === k,
  )[0];
const show = (label: string, i: Incident | undefined) =>
  console.log(
    `  ${label}: ${i ? `${i.status}${i.resolvedBy ? ` (${i.resolvedBy})` : ''}, попыток ${i.fixAttempts}, «${i.lastFixResult ?? '—'}»` : 'нет'}`,
  );

const db = createPrismaClient();
const t0 = Date.now();
try {
  if (kind === 'outbox') {
    const row = await db.channelOutbox.create({
      data: {
        provider: 'channex',
        kind: 'AVAILABILITY',
        payload: [],
        status: 'FAILED',
        attempts: 6,
        lastError: `${MARK}: Channex POST /availability: HTTP 503`,
      },
    });
    console.log(`1. подброшена упавшая отправка ARI ${row.id}`);
    const a = await tick();
    show('проход 1', await find('outbox.failed'));
    console.log(`  починок в проходе: ${JSON.stringify(a.fixes)}`);
    await tick();
    const done = await find('outbox.failed');
    show('проход 2', done);
    await db.channelOutbox.delete({ where: { id: row.id } });
    console.log(
      `2. строка учений удалена; итог: ${done?.status === 'RESOLVED' ? 'PASS — сторож починил сам и закрыл' : 'FAIL'} за ${Math.round((Date.now() - t0) / 1000)} с`,
    );
  } else {
    const id = `guard-drill-${Date.now()}`;
    await db.externalEvent.create({
      data: {
        provider: 'channex',
        externalEventId: id,
        type: 'booking_new',
        payloadHash: 'guard-drill',
        status: 'FAILED',
        attemptCount: 6,
        lastError: `${MARK}: Бронь BDC-DRILL (Booking.com): перенесённых из Exely броней с таким же составом проживаний несколько — PMS не выбирает сама (ADR-024)`,
      },
    });
    console.log(`1. подброшена отклонённая бронь канала, ревизия ${id}`);
    const a = await tick();
    const inc = (
      (await get('/guard/incidents?status=all&limit=50')) as Array<Incident & { subjectId: string }>
    ).find((i) => i.subjectId === id);
    show('проход 1', inc);
    console.log(`  починок в проходе: ${a.fixes.length} (ожидается 0 — правило не повторяют)`);
    await db.externalEvent.delete({
      where: { provider_externalEventId: { provider: 'channex', externalEventId: id } },
    });
    await tick();
    const after = (
      (await get('/guard/incidents?status=all&limit=50')) as Array<Incident & { subjectId: string }>
    ).find((i) => i.subjectId === id);
    show('после разбора', after);
    const ok =
      inc?.kind === 'event.rejected' &&
      inc.status === 'ESCALATED' &&
      a.fixes.length === 0 &&
      after?.status === 'RESOLVED';
    console.log(
      `2. итог: ${ok ? 'PASS — не повторял, отдал человеку, закрыл после разбора' : 'FAIL'} за ${Math.round((Date.now() - t0) / 1000)} с`,
    );
  }
} finally {
  await db.$disconnect();
}
