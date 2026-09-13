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
  // Контрольное число аудита 07.09.2026 (CLAUDE.md §6): оборот по заездам августа
  const AUDIT_AUGUST_TURNOVER = 1_568_801_800n;
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
          '**Против контрольного числа.** Аудит 07.09.2026 дал оборот по заездам августа ' +
            `${money(AUDIT_AUGUST_TURNOVER)}; здесь состоявшиеся брони дают ${money(report.keptAmount)}, ` +
            `разница ${money(report.keptAmount - AUDIT_AUGUST_TURNOVER)}. Правило проекта — ноль, поэтому ` +
            'разницу надо закрыть. Наиболее вероятная причина: аудит снимался 07.09, а полный импорт ' +
            'августа закончился 10.09 и подтянул брони, которых в срезе аудита не было (тогда же загрузка ' +
            'выросла с 79,7 % до 80,8 %). Проверяется выгрузкой августа из кабинета Exely по тому же ' +
            'определению оборота.',
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
