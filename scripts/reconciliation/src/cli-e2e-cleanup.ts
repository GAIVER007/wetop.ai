/**
 * Уборка после e2e: брони, созданные автотестами, занимают настоящие ячейки в общей базе и
 * вытесняют импорт из Exely (в логе синхронизации это видно как «ячейка N занята 20260910-XXXXXX»).
 * Скрипт отменяет их через API — той же командой, что и стойка, поэтому ячейки освобождаются,
 * начисления сторнируются, а журнал действий видит настоящую отмену.
 *
 * Метка — заметка брони `E2E-АВТОТЕСТ`, её ставят сами тесты. Ничего другого скрипт не трогает.
 * Запуск: npx tsx scripts/reconciliation/src/cli-e2e-cleanup.ts [--dry]
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const E2E_NOTE = 'E2E-АВТОТЕСТ';
const API = process.env['E2E_API_URL'] ?? 'http://127.0.0.1:3001';
const dry = process.argv.includes('--dry');

const db = createPrismaClient();
try {
  const marked = await db.reservation.findMany({
    where: {
      status: { notIn: ['CANCELLED'] },
      items: { some: { allocations: { some: {} } } },
      OR: [
        { notes: E2E_NOTE },
        // Прогоны до появления метки: номер выдан самой PMS. У броней из Exely номер другого вида
        // (`…-513903-…`), и их гости тоже анонимизированы в «Тест-» — по фамилии их различить нельзя.
        { primaryGuest: { lastName: { startsWith: 'Тест-' } } },
      ],
    },
    select: { confirmationNumber: true, status: true, notes: true },
    orderBy: { createdAt: 'asc' },
  });
  // Номер, выданный PMS: ГГГГММДД + шесть знаков. У Exely и каналов формат другой — они не попадут.
  const ownNumber = /^\d{8}-[A-Z0-9]{6}$/;
  const mine = marked.filter((r) => r.notes === E2E_NOTE || ownNumber.test(r.confirmationNumber));
  console.log(
    `Броней автотестов с занятыми ячейками: ${mine.length} (кандидатов по фамилии было ${marked.length})`,
  );
  let freed = 0;
  const failed: string[] = [];
  for (const r of mine) {
    if (dry) {
      console.log(
        `  ${r.confirmationNumber} (${r.status}) — ${r.notes === E2E_NOTE ? 'метка' : 'фамилия Тест-'}`,
      );
      continue;
    }
    const res = await fetch(`${API}/reservations/${encodeURIComponent(r.confirmationNumber)}/cancel`, {
      method: 'POST',
    });
    if (res.ok) {
      freed += 1;
      continue;
    }
    // Выселенную бронь отменить нельзя — снимаем только назначение, ночь уже состоялась
    const removed = await db.allocation.deleteMany({
      where: { reservationItem: { reservation: { confirmationNumber: r.confirmationNumber } } },
    });
    if (removed.count) freed += 1;
    else failed.push(`${r.confirmationNumber} (${r.status}): HTTP ${res.status}`);
  }
  if (!dry) console.log(`Освобождено броней: ${freed}`);
  if (failed.length) {
    console.log('Не удалось убрать:');
    for (const f of failed) console.log(`  ${f}`);
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
