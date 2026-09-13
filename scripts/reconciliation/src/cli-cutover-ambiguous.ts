/**
 * Лист разбора для дня переезда (ADR-024, Q-109). Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-cutover-ambiguous.ts
 *   npm run cutover:ambiguous
 * Пишет reports/cutover-ambiguous-<дата>.md — группы перенесённых из Exely броней OTA, которые
 * Channex при подключении канала пришлёт заново, а PMS не сможет сопоставить сама: канал и состав
 * проживаний у них одинаковые. Только чтение; персональных данных не выбираем — номера, даты,
 * категории, ячейки и суммы.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { groupAmbiguous, money, type AmbiguousRow } from './cutover-ambiguous';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

/** Сутки объекта: Алматы, UTC+5 (AGENTS.md §13). */
const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
  });
  // Тот же отбор, что у ADR-024 в `importedOtaCandidates`: бронь канала без номера на стороне канала
  const reservations = await db.reservation.findMany({
    where: {
      propertyId: property.id,
      source: 'OTA',
      OR: [{ externalId: null }, { externalId: '' }],
      status: { not: 'CANCELLED' },
      items: { some: { status: { not: 'CANCELLED' }, departureDate: { gt: new Date(today) } } },
    },
    select: {
      confirmationNumber: true,
      channel: true,
      totalAmount: true,
      items: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { arrivalDate: 'asc' },
        select: {
          arrivalDate: true,
          departureDate: true,
          accommodationType: { select: { name: true } },
          allocations: { select: { inventoryUnit: { select: { code: true } } } },
          folio: { select: { allocations: { select: { amount: true } } } },
        },
      },
    },
  });

  const rows: AmbiguousRow[] = reservations.map((r) => ({
    confirmationNumber: r.confirmationNumber,
    channel: r.channel,
    stays: r.items.map((i) => ({
      category: i.accommodationType.name,
      arrival: iso(i.arrivalDate),
      departure: iso(i.departureDate),
    })),
    units: r.items.flatMap((i) => i.allocations.map((a) => a.inventoryUnit.code)),
    totalAmountMinor: r.totalAmount,
    paidMinor: r.items.reduce(
      (s, i) => s + (i.folio?.allocations.reduce((x, p) => x + p.amount, 0n) ?? 0n),
      0n,
    ),
  }));

  const groups = groupAmbiguous(rows);
  const inGroups = groups.reduce((s, g) => s + g.rows.length, 0);
  const byAmount = groups.filter((g) => g.byAmount).length;

  const md = [
    `# Разбор двойников на переезде — ${today}`,
    '',
    'Кого касается: Booking.com, Expedia и Trip.com — только эти каналы Channex подтягивает старыми',
    'бронями при подключении. Agoda, Hostelworld и Ostrovok приходят чистыми, их брони переносятся руками',
    'по `CUTOVER.md`.',
    '',
    `Перенесённых из Exely будущих броней OTA без номера на стороне канала: **${rows.length}**.`,
    `Из них в группах-двойниках: **${inGroups}** в **${groups.length}** группах.`,
    `Разбираются по сумме без имени гостя: **${byAmount}** групп из ${groups.length}.`,
    '',
    '## Почему это надо разбирать руками',
    '',
    'PMS сопоставляет присланную Channex бронь с перенесённой по каналу и составу проживаний (категория,',
    'заезд, выезд) — номера брони на стороне канала у перенесённых нет, Exely его не отдаёт. Когда',
    'кандидат один, связывание проходит само и ячейка из Exely сохраняется. Когда кандидатов несколько,',
    'PMS не выбирает: ревизия отклоняется, её видно на `/channels` со списком номеров, кнопка «Обработать',
    'заново». Если выбрать неверно, гость окажется в чужой койке, а вторая бронь займёт лишнее место.',
    '',
    '## Как разбирать',
    '',
    '1. В ревизии Channex посмотреть сумму. Если в группе суммы разные (столбец «Разбор» ниже) — этого',
    '   достаточно: связывать с бронью на ту же сумму.',
    '2. Если суммы совпадают — сверить имя гостя из ревизии с карточкой брони. В рабочей базе имена',
    '   настоящие; в базе для разработки они заменены псевдонимами (ADR-018), поэтому сверять именем',
    '   можно только после переноса базы в Казахстан.',
    '3. Оставить одну перенесённую бронь, лишние в группе отменить, затем «Обработать заново» по очереди.',
    '4. После разбора проверить ячейки: у связанной брони остаётся ячейка из Exely, она указана ниже.',
    '',
    '## Группы',
    '',
  ];

  if (groups.length === 0) md.push('Двойников нет — все брони каналов сопоставятся сами.');
  for (const [n, g] of groups.entries()) {
    md.push(
      `### ${n + 1}. ${g.channel} — ${g.rows.length} брони`,
      '',
      `Состав: ${g.composition}`,
      '',
      `Разбор: ${g.byAmount ? '**по сумме** — суммы в группе разные' : '**только по имени гостя** — суммы совпадают'}`,
      '',
      '| Бронь | Ячейка | Сумма | Оплачено |',
      '|---|---|---:|---:|',
      ...g.rows.map(
        (r) =>
          `| ${r.confirmationNumber} | ${r.units.join(', ') || '**нет**'} | ${money(r.totalAmountMinor)} | ${money(r.paidMinor)} |`,
      ),
      '',
    );
  }

  md.push(
    '## Что меняется со временем',
    '',
    'Список живой: пока каналы не переключены, брони приходят и отменяются, группы появляются и',
    'исчезают. Пересчитать перед самым переключением канала — `npm run cutover:ambiguous`.',
    '',
  );

  const out = resolve(ROOT, `reports/cutover-ambiguous-${today}.md`);
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  writeFileSync(out, md.join('\n'));
  console.log(md.join('\n'));
  console.log(`→ ${out}`);
} finally {
  await db.$disconnect();
}
