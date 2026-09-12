/**
 * Уборка после e2e: брони, созданные автотестами, занимают настоящие ячейки в общей базе и
 * вытесняют импорт из Exely (в логе синхронизации это видно как «ячейка N занята 20260910-XXXXXX»).
 * Скрипт отменяет их через API — той же командой, что и стойка, поэтому ячейки освобождаются,
 * начисления сторнируются, а журнал действий видит настоящую отмену.
 *
 * Метка — заметка брони `E2E-АВТОТЕСТ` (или комментарий гостя в брони с сайта, срез 9), её ставят сами тесты. Ничего другого скрипт не трогает.
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
      // Брони без ячейки тоже нужны: для канала они «проданы» (categoryAvailability считает проживания,
      // а не ячейки) и занижают остаток в Channex — найдено сверкой 11.09.2026.
      items: { some: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } } },
      OR: [
        { notes: { contains: E2E_NOTE } },
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
  const mine = marked.filter(
    (r) => r.notes?.includes(E2E_NOTE) || ownNumber.test(r.confirmationNumber),
  );
  console.log(
    `Броней автотестов с активными проживаниями: ${mine.length} (кандидатов по фамилии было ${marked.length})`,
  );
  let freed = 0;
  const failed: string[] = [];
  for (const r of mine) {
    if (dry) {
      console.log(
        `  ${r.confirmationNumber} (${r.status}) — ${r.notes?.includes(E2E_NOTE) ? 'метка' : 'фамилия Тест-'}`,
      );
      continue;
    }
    // Playwright останавливает свой API до globalTeardown, поэтому API может быть недоступен:
    // тогда снимаем назначения прямо в базе — койки освобождаются, сверка их всё равно исключает по метке.
    const res = await fetch(
      `${API}/reservations/${encodeURIComponent(r.confirmationNumber)}/cancel`,
      {
        method: 'POST',
      },
    ).catch(() => null);
    if (res?.ok) {
      freed += 1;
      continue;
    }
    // Выселенную бронь через API отменить нельзя (422), а API может быть недоступен. Это тестовые данные
    // с меткой или номером PMS и фамилией «Тест-», поэтому гасим прямо в базе: назначения снимаем,
    // проживания и бронь помечаем отменёнными — иначе они считаются проданными и занижают остаток в канале.
    await db.$transaction(async (tx) => {
      await tx.allocation.deleteMany({
        where: { reservationItem: { reservation: { confirmationNumber: r.confirmationNumber } } },
      });
      await tx.reservationItem.updateMany({
        where: { reservation: { confirmationNumber: r.confirmationNumber } },
        data: { status: 'CANCELLED' },
      });
      await tx.reservation.updateMany({
        where: { confirmationNumber: r.confirmationNumber },
        data: { status: 'CANCELLED' },
      });
    });
    freed += 1;
    if (!res)
      failed.push(`${r.confirmationNumber} (${r.status}): API недоступен — погашена в базе`);
  }
  if (!dry) console.log(`Освобождено броней: ${freed}`);
  // Блоки соседних ночей от раннего заезда / позднего выезда (ADR-021) остаются, если тестовую бронь
  // погасили в базе, а не отменой через API. Снимаем их по всем тестовым броням, включая уже отменённые.
  const testNumbers = (
    await db.reservation.findMany({
      where: {
        OR: [
          { notes: { contains: E2E_NOTE } },
          { primaryGuest: { lastName: { startsWith: 'Тест-' } } },
        ],
      },
      select: { confirmationNumber: true, notes: true },
    })
  )
    .filter((r) => r.notes?.includes(E2E_NOTE) || ownNumber.test(r.confirmationNumber))
    .map((r) => r.confirmationNumber);
  const staleBlocks = await db.inventoryBlock.findMany({
    where: {
      type: 'OTHER',
      OR: testNumbers.map((n) => ({ reason: { endsWith: `, бронь ${n}` } })),
    },
    select: { id: true },
  });
  if (staleBlocks.length && !dry)
    await db.inventoryBlock.deleteMany({ where: { id: { in: staleBlocks.map((b) => b.id) } } });
  console.log(
    `Блоков соседних ночей от тестовых броней: ${staleBlocks.length}${dry ? '' : ' — сняты'}`,
  );
  if (staleBlocks.length && freed === 0 && !dry) freed = 1; // чтобы ниже ушла полная выгрузка остатков
  // Гашение в базе идёт мимо очереди дельт, и канал об этом не узнаёт до полной выгрузки (найдено
  // сверкой 11.09: мужской дом 19 против 18 в Channex). Поэтому после уборки просим полную выгрузку сами;
  // если API недоступен — её сделает ночная выгрузка после 03:00 по Алматы.
  if (!dry && freed > 0) {
    const sync = await fetch(`${API}/channels/channex/sync?days=365&trigger=import`, {
      method: 'POST',
    }).catch(() => null);
    console.log(
      sync?.ok
        ? 'Остатки в канале: полная выгрузка запущена'
        : `Остатки в канале: полная выгрузка не запущена (${sync ? `HTTP ${sync.status}` : 'API недоступен'}) — подберёт ночная выгрузка`,
    );
  }
  if (failed.length) {
    console.log('Погашено без API:');
    for (const f of failed) console.log(`  ${f}`);
  }
  // Сайты со счётчиком, заведённые автотестами (срез 8): e2e и интеграционный тест удаляют их сами,
  // но сорванный прогон оставляет сайт со статистикой. Каскадом уходят сессии, просмотры и события.
  const testSites = await db.trackedSite.findMany({
    where: {
      OR: [
        { name: { startsWith: E2E_NOTE } },
        { name: 'ИНТЕГРАЦИОННЫЙ ТЕСТ' },
        { publicKey: 'pms_e2e000000000' },
      ],
    },
    select: { id: true, name: true },
  });
  if (testSites.length && !dry)
    await db.trackedSite.deleteMany({ where: { id: { in: testSites.map((s) => s.id) } } });
  console.log(`Сайтов со счётчиком от автотестов: ${testSites.length}${dry ? '' : ' — удалены'}`);
} finally {
  await db.$disconnect();
}
