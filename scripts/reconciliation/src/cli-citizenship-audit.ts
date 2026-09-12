/**
 * Сверка гражданства гостей (наблюдение 12.09.2026, Q-117): колонка `citizenship` объявлена CHAR(3),
 * Postgres дополняет короткие значения пробелами, и пустой `citizenshipCode` из Exely лежит в базе как '   '.
 * Скрипт считает, у скольких гостей гражданство только из пробелов или не похоже на код ISO 3166-1 alpha-3,
 * кто из них пришёл импортом и кого ждут будущие заезды. ПД не печатает: только счётчики и номера броней.
 *
 * Данные НЕ меняет. `--apply` — одноразовая чистка «пробелы → NULL» с записью в журнал по каждому гостю;
 * запускать только по решению владельца (Q-117).
 *
 * Запуск: npm run citizenship:audit -- [--apply] [--date=YYYY-MM-DD]
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { normalizeCitizenship } from '@pms/domain';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const apply = process.argv.includes('--apply');
const almatyToday = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const today = arg('date') ?? almatyToday;
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error('--date=YYYY-MM-DD');
  process.exit(2);
}

const ALPHA3 = /^[A-Z]{3}$/;
const PENDING_STATUSES = new Set(['TENTATIVE', 'CONFIRMED']);
type Kind = 'null' | 'blank' | 'code' | 'malformed';
const kindOf = (raw: string | null): Kind => {
  if (raw === null) return 'null';
  const n = normalizeCitizenship(raw);
  if (n === null) return 'blank';
  return ALPHA3.test(n) ? 'code' : 'malformed';
};
/** Значение как есть, с видимыми пробелами и длиной в байтах — чтобы было видно, что именно лежит в CHAR(3) */
const show = (raw: string) => `${JSON.stringify(raw)} (${Buffer.byteLength(raw)} байт)`;

const db = createPrismaClient();
try {
  const guests = await db.guest.findMany({
    select: {
      id: true,
      citizenship: true,
      exelyPersonId: true,
      /** заказчик брони — именно его гражданство проверяет заселение (reservations.service checkIn) */
      primaryReservations: {
        select: { confirmationNumber: true, status: true, departureDate: true },
      },
      stays: {
        select: {
          reservationItem: {
            select: {
              status: true,
              departureDate: true,
              reservation: { select: { confirmationNumber: true } },
            },
          },
        },
      },
    },
  });

  const byKind: Record<Kind, typeof guests> = { null: [], blank: [], code: [], malformed: [] };
  for (const g of guests) byKind[kindOf(g.citizenship)].push(g);

  const distinct = (rows: typeof guests) => {
    const m = new Map<string, number>();
    for (const g of rows) m.set(g.citizenship!, (m.get(g.citizenship!) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  /**
   * Брони, где гостя ещё ждут: статус ожидания и выезд позже сегодня — и будущие заезды, и просроченные.
   * Два пути: заказчик брони (его проверяет заселение) и карточки проживаний (StayGuest).
   */
  const pendingNumbers = (g: (typeof guests)[number]) => {
    const pending = (x: { status: string; departureDate: Date }) =>
      PENDING_STATUSES.has(x.status) && x.departureDate.toISOString().slice(0, 10) > today;
    return new Set([
      ...g.primaryReservations.filter(pending).map((r) => r.confirmationNumber),
      ...g.stays
        .map((st) => st.reservationItem)
        .filter(pending)
        .map((it) => it.reservation.confirmationNumber),
    ]);
  };
  const inHouse = (g: (typeof guests)[number]) =>
    g.stays.some((s) => s.reservationItem.status === 'CHECKED_IN');

  const lines: string[] = [];
  lines.push(`# Сверка гражданства гостей — ${today}`);
  lines.push('');
  lines.push(
    'Колонка `guests.citizenship` — CHAR(3): пустая строка хранится как три пробела и читается программой как ' +
      'истинное значение. Считаем, у скольких гостей гражданство «пробелами», кто из них из импорта Exely и кого ждут заезды.',
  );
  lines.push('');
  lines.push('| Гражданство | Гостей |');
  lines.push('|---|---:|');
  lines.push(`| всего гостей | ${guests.length} |`);
  lines.push(`| NULL (не указано) | ${byKind.null.length} |`);
  lines.push(`| **только пробелы** | **${byKind.blank.length}** |`);
  lines.push(`| код alpha-3 | ${byKind.code.length} |`);
  lines.push(`| другое (не код) | ${byKind.malformed.length} |`);
  lines.push('');

  for (const [title, rows] of [
    ['Только пробелы', byKind.blank],
    ['Другое (не код)', byKind.malformed],
  ] as const) {
    if (!rows.length) continue;
    const fromExely = rows.filter((g) => g.exelyPersonId).length;
    const pending = rows.filter((g) => pendingNumbers(g).size > 0);
    const living = rows.filter(inHouse).length;
    lines.push(`## ${title}: ${rows.length}`);
    lines.push('');
    lines.push('| Значение в базе | Гостей |');
    lines.push('|---|---:|');
    for (const [v, n] of distinct(rows)) lines.push(`| ${show(v)} | ${n} |`);
    lines.push('');
    lines.push(
      `- из импорта Exely (есть \`exely_person_id\`): ${fromExely}, заведены в PMS: ${rows.length - fromExely}`,
    );
    lines.push(`- ожидают заселения (статус ожидания, выезд позже ${today}): ${pending.length}`);
    lines.push(
      `- статус CHECKED_IN (перенесены из Exely уже заселёнными, проверка PMS не участвовала): ${living}`,
    );
    const numbers = [...new Set(pending.flatMap((g) => [...pendingNumbers(g)]))].sort();
    if (numbers.length)
      lines.push(
        `- их брони (${numbers.length}): ${numbers.slice(0, 12).join(', ')}${numbers.length > 12 ? ', …' : ''}`,
      );
    lines.push('');
  }

  const codes = distinct(byKind.code).slice(0, 8);
  if (codes.length) {
    lines.push('## Коды стран (для справки, первые 8)');
    lines.push('');
    lines.push('| Код | Гостей |');
    lines.push('|---|---:|');
    for (const [v, n] of codes) lines.push(`| ${v} | ${n} |`);
    lines.push('');
  }

  if (apply) {
    const ids = byKind.blank.map((g) => g.id);
    if (!ids.length) {
      lines.push('`--apply`: чистить нечего.');
    } else {
      const done = await db.$transaction(async (tx) => {
        const res = await tx.guest.updateMany({
          where: { id: { in: ids } },
          data: { citizenship: null },
        });
        await tx.auditLog.createMany({
          data: ids.map((id) => ({
            entityType: 'Guest',
            entityId: id,
            action: 'guest.citizenship.blank-cleanup',
            after: { fields: ['citizenship'], reason: 'Q-117: CHAR(3) padding → NULL' },
          })),
        });
        return res.count;
      });
      lines.push(
        `## Чистка выполнена (\`--apply\`): гражданство «пробелами» → NULL у ${done} гостей, журнал записан`,
      );
    }
  } else {
    lines.push(
      `Данные не изменены. Одноразовая чистка «пробелы → NULL» с записью в журнал: \`npm run citizenship:audit -- --apply\` — только по решению владельца (Q-117).`,
    );
  }
  console.log(lines.join('\n'));
} finally {
  await db.$disconnect();
}
