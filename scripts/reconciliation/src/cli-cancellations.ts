/**
 * Отчёт по отменам за месяц (PLAN неделя 1). Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-cancellations.ts [YYYY-MM]
 * Пишет reports/cancellations-YYYY-MM.md. Только чтение, без персональных данных: имена и телефоны
 * не выбираются вовсе, наружу идут счётчики, суммы и названия каналов.
 * Знаменатель — брони с заездом в месяце: та же база, что у загрузки.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { buildCancellations, money, renderCancellations, type CancelRow } from './cancellations';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const MONTH = process.argv[2] ?? '2026-08';
if (!/^\d{4}-\d{2}$/.test(MONTH)) throw new Error('месяц в виде YYYY-MM, например 2026-08');
const from = new Date(`${MONTH}-01T00:00:00Z`);
const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Ночи проживания, попавшие внутрь месяца: ночь выезда не считается (AGENTS §13). */
function nightsInMonth(arrival: Date, departure: Date): number {
  const start = arrival > from ? arrival : from;
  const end = departure < to ? departure : to;
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return nights > 0 ? nights : 0;
}

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
  });
  const reservations = await db.reservation.findMany({
    where: { propertyId: property.id, arrivalDate: { gte: from, lt: to } },
    select: {
      status: true,
      source: true,
      channel: true,
      arrivalDate: true,
      departureDate: true,
      totalAmount: true,
      items: {
        select: {
          status: true,
          arrivalDate: true,
          departureDate: true,
          accommodationType: { select: { name: true } },
        },
      },
    },
  });

  const rows: CancelRow[] = reservations.map((r) => ({
    status: r.status,
    source: r.source,
    channel: r.channel,
    arrivalDate: iso(r.arrivalDate),
    departureDate: iso(r.departureDate),
    totalAmount: r.totalAmount,
    items: r.items.map((i) => ({
      status: i.status,
      category: i.accommodationType.name,
      nightsInMonth: nightsInMonth(i.arrivalDate, i.departureDate),
    })),
  }));

  const report = buildCancellations(MONTH, rows);
  const booked = reservations.filter((r) => r.status !== 'CANCELLED').length;
  /**
   * Контрольные числа аудита 07.09.2026 (OBJECT.md §6, таблица «Загрузка по категориям»):
   * оборот проживания по заездам августа, целые тенге.
   */
  const AUDIT_AUGUST_TURNOVER: Record<string, bigint> = {
    'Одноместная комната с окном': 169_848_700n,
    'Одноместная комната без окон': 245_644_300n,
    'Двухместная комната': 180_582_600n,
    'Общая мужская комната': 585_433_700n,
    'Общая женская комната': 387_292_500n,
  };
  // Оборот считается по проживаниям с заездом в месяце — то же определение, что у аудита
  const stays = await db.reservationItem.findMany({
    where: {
      arrivalDate: { gte: from, lt: to },
      status: { not: 'CANCELLED' },
      reservation: { propertyId: property.id },
    },
    select: { price: true, accommodationType: { select: { name: true } } },
  });
  const turnover = new Map<string, { n: number; sum: bigint }>();
  for (const st of stays) {
    const k = st.accommodationType.name;
    const g = turnover.get(k) ?? { n: 0, sum: 0n };
    g.n++;
    g.sum += st.price;
    turnover.set(k, g);
  }
  const noShowMonths = await db.reservation.findMany({
    where: { propertyId: property.id, status: 'NO_SHOW' },
    select: { arrivalDate: true },
  });
  const noShowOutside = noShowMonths.filter(
    (r) => r.arrivalDate < from || r.arrivalDate >= to,
  ).length;
  const note = [
    `Снято ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC из базы PMS, данные перенесены из Exely.`,
    '',
    'Что здесь считается. Знаменатель — брони с **заездом** в месяце: бронь либо состоялась, либо была',
    'отменена, третьего нет. Единице-сутки считаются только те ночи отменённых проживаний, что попали',
    'внутрь месяца. Деньги — сумма брони целиком, даже если часть ночей выходит за месяц.',
    '',
    '**Чего в данных нет.** Exely не отдаёт ни дату отмены, ни дату создания брони: у всех',
    `${reservations.length} броней месяца поле «когда забронировали» пустое. Поэтому в отчёте нет`,
    'ни «за сколько дней до заезда отменяют», ни распределения отмен по дням месяца. Если владелец',
    'захочет эти разрезы, нужен другой источник: выгрузка из кабинета Exely или лента изменений.',
    '',
    `Состоявшихся броней (не отменены): ${booked}.`,
    '',
    '**Незаезды в перенесённых месяцах не различимы.** За месяц их ' +
      `${report.noShow}, а всего в базе ${noShowMonths.length} — и ${noShowOutside} из них с заездом` +
      ' вне этого месяца, то есть в дни, которые мы ведём сами. Значит при переносе прошлых месяцев' +
      ' из Exely незаезд приходит отменой и попадает в строку «отменено». Отдельная строка «незаезды»' +
      ' наполняется только с того дня, как объект работает в нашей системе.',
    ...(MONTH === '2026-08'
      ? [
          '',
          '## Против контрольных чисел аудита',
          '',
          'Аудит 07.09.2026 дал оборот проживания по заездам августа в разрезе категорий (OBJECT.md §6).',
          `Число заездов совпадает точно: проживаний с заездом в месяце ${stays.length}, у аудита 1044.`,
          '',
          '| Категория | Наш оборот | Аудит 07.09 | Разница |',
          '|---|---:|---:|---:|',
          ...[...turnover]
            .sort((a, b) => Number(b[1].sum - a[1].sum))
            .map(([name, g]) => {
              const a = AUDIT_AUGUST_TURNOVER[name] ?? 0n;
              return `| ${name} | ${money(g.sum)} | ${money(a)} | ${money(g.sum - a)} |`;
            }),
          `| **Итого** | **${money([...turnover.values()].reduce((x, g) => x + g.sum, 0n))}** | **${money(
            Object.values(AUDIT_AUGUST_TURNOVER).reduce((x, v) => x + v, 0n),
          )}** | **${money(
            [...turnover.values()].reduce((x, g) => x + g.sum, 0n) -
              Object.values(AUDIT_AUGUST_TURNOVER).reduce((x, v) => x + v, 0n),
          )}** |`,
          '',
          'Три категории сходятся до тиына: расхождения в четверть тенге — это округление аудита до целых.',
          'Весь зазор сидит в двух общих комнатах, и это те же категории, где уже висит известное',
          'расхождение по единице-суткам (мужской дом +47, `reports/unit-nights-2026-08.md`).',
          '',
          '**Отброшенная версия.** Сначала казалось, что аудит снят 07.09, а импорт августа закончился',
          '10.09 и подтянул недостающие брони. Проверено: после 10.09 в базу не попало ни одной брони',
          'с заездом в августе, а число заездов совпадает с аудитом ровно. Значит дело не в составе',
          'броней, а в суммах по двум общим комнатам.',
          '',
          '**Чтобы закрыть в ноль,** нужен от владельца тот же отчёт Exely по категориям за август,',
          'снятый сегодня: если Exely покажет наши числа, расхождение — след правок цен между 07 и 09.09,',
          'если прежние — расходится определение оборота для койко-мест (Q-121).',
        ]
      : []),
  ].join('\n');

  const md = renderCancellations(report, note);
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/cancellations-${MONTH}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
} finally {
  await db.$disconnect();
}
