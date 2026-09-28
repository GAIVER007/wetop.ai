/**
 * Сверка цен и ограничений в обе стороны. То, что PMS публикует в Channex (`daily_rates` + `restrictions`
 * → POST /restrictions, см. apps/api/src/channels/ari.ts → buildRestrictionValues), читаем назад через
 * GET /restrictions (ari.md → Get Availability Or Restrictions Per Rate Plan) и сравниваем клетка в клетку:
 * дата × категория × тариф — цена, min_stay, stop_sell, closed_to_arrival, closed_to_departure, max_stay.
 * Только чтение, только staging. Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-channex-rates.ts [дней=14]
 * Пишет reports/channex-rates-YYYY-MM-DD.md. Код выхода 1 при любом расхождении.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { channex } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const days = Number(process.argv[2] ?? 14);
if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('дней — целое 1..365');
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || channex.CHANNEX_STAGING_URL;
// Боевой Channex до Gate 9 не трогаем даже чтением (AGENTS.md §9): скрипт отказывается работать вне staging
if (!baseUrl.includes('staging')) throw new Error(`Только staging: ${baseUrl}`);

const PROVIDER = 'channex';
/** Сегодня по Алматы (UTC+5), как в остальных cli-channex-* */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const to = plus(today, days - 1);
const dates = Array.from({ length: days }, (_, i) => plus(today, i));

/** Тиыны → "15400.00" для отчёта, без float */
const money = (minor: bigint) => {
  const sign = minor < 0n ? '-' : '';
  const abs = minor < 0n ? -minor : minor;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
};

// ── PMS: маппинг, цены, ограничения ──
const db = createPrismaClient();
type Diff = {
  date: string;
  category: string;
  tariff: string;
  field: string;
  pms: string;
  channex: string;
  direction: string;
  /** Канал продаёт там, так или по такой цене, как мы не разрешали */
  danger: boolean;
};
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true, currency: true },
  });
  const rows = await db.channelMapping.findMany({
    where: { propertyId: property.id, provider: PROVIDER },
    include: {
      accommodationType: { select: { id: true, code: true, name: true, capacityAdults: true } },
      ratePlan: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  // Полные строки маппинга: категория + тариф PMS ↔ тариф Channex (как в fullSync)
  const mapped = rows.flatMap((m) =>
    m.providerRatePlanId && m.accommodationType && m.ratePlan
      ? [
          {
            providerPropertyId: m.providerPropertyId,
            providerRatePlanId: m.providerRatePlanId,
            category: m.accommodationType,
            ratePlan: m.ratePlan,
          },
        ]
      : [],
  );
  if (mapped.length === 0) throw new Error('маппинг Channex пуст — сначала setup');
  const propertyId = mapped[0]!.providerPropertyId;

  const ratePlanIds = [...new Set(mapped.map((m) => m.ratePlan.id))];
  const categoryIds = [...new Set(mapped.map((m) => m.category.id))];
  const where = {
    ratePlanId: { in: ratePlanIds },
    accommodationTypeId: { in: categoryIds },
    date: { gte: asDate(today), lte: asDate(to) },
  };
  const [dailyRates, restrictions] = await Promise.all([
    db.dailyRate.findMany({
      where,
      select: {
        date: true,
        accommodationTypeId: true,
        ratePlanId: true,
        occupancy: true,
        price: true,
      },
    }),
    db.restriction.findMany({ where }),
  ]);
  // Цена публикуется по primary occupancy = вместимость категории (sync.service → occupancyByCategory)
  const priceAt = new Map<string, bigint>();
  for (const r of dailyRates)
    priceAt.set(`${iso(r.date)}|${r.accommodationTypeId}|${r.ratePlanId}|${r.occupancy}`, r.price);
  const restrAt = new Map(
    restrictions.map((r) => [`${iso(r.date)}|${r.accommodationTypeId}|${r.ratePlanId}`, r]),
  );

  // ── Channex: одним запросом за период по всем тарифам объекта (сужаем до сопоставленных) ──
  const client = new channex.ChannexClient({ apiKey, baseUrl });
  const readback = await client.getRestrictions(
    propertyId,
    today,
    to,
    mapped.map((m) => m.providerRatePlanId),
    [
      'availability',
      'rate',
      'min_stay_arrival',
      'min_stay_through',
      'max_stay',
      'stop_sell',
      'closed_to_arrival',
      'closed_to_departure',
    ],
  );

  // ── Сравнение клетка в клетку. Ожидаемое — ровно то, что строит buildRestrictionValues ──
  const diffs: Diff[] = [];
  /**
   * Channex на staging отдаёт stop_sell=true везде, где остаток по тарифу 0 (проверено 11.09.2026:
   * все такие клетки имели availability 0, открытые — >0; в ari.md это не описано). Это не расхождение
   * ограничений — сам остаток сверяет cli-channex-ari.ts, — поэтому считаем и показываем отдельно.
   */
  const closedByZero: Array<{ date: string; category: string; tariff: string; pms: string }> = [];
  let cells = 0;
  let noPrice = 0;
  let missing = 0;
  const byPlan = new Map<
    string,
    { tariff: string; category: string; channexPlan: string; cells: number; diffs: number }
  >();
  for (const m of mapped) {
    const group = {
      tariff: `${m.ratePlan.name} (${m.ratePlan.code})`,
      category: `${m.category.name} (${m.category.code})`,
      channexPlan: m.providerRatePlanId,
      cells: 0,
      diffs: 0,
    };
    byPlan.set(m.providerRatePlanId, group);
    const plan = readback[m.providerRatePlanId] ?? {};
    for (const date of dates) {
      cells += 1;
      group.cells += 1;
      const ctx = { date, category: m.category.code, tariff: m.ratePlan.code };
      const r = restrAt.get(`${date}|${m.category.id}|${m.ratePlan.id}`);
      const price =
        priceAt.get(`${date}|${m.category.id}|${m.ratePlan.id}|${m.category.capacityAdults}`) ??
        null;
      if (price === null) noPrice += 1;
      const expected = {
        rate: price,
        stop_sell: price === null || (r?.stopSell ?? false),
        min_stay_arrival: r?.minStay ?? 1,
        min_stay_through: r?.minStay ?? 1,
        max_stay: r?.maxStay ?? 0,
        closed_to_arrival: r?.closedToArrival ?? false,
        closed_to_departure: r?.closedToDeparture ?? false,
      };
      const cell = plan[date];
      const before = diffs.length;
      if (!cell) {
        missing += 1;
        diffs.push({
          ...ctx,
          field: '—',
          pms: price === null ? 'нет цены' : money(price),
          channex: '—',
          direction: '**нет данных в Channex** за эту дату',
          danger: true,
        });
      } else {
        const reasons =
          Array.isArray(cell.unavailable_reasons) && cell.unavailable_reasons.length
            ? ` (unavailable_reasons: ${JSON.stringify(cell.unavailable_reasons).slice(0, 120)})`
            : '';
        // Цена: сравниваем только там, где она у нас есть — без цены мы её не публикуем, а закрываем продажу
        if (expected.rate !== null) {
          if (cell.rate === undefined)
            diffs.push({
              ...ctx,
              field: 'rate',
              pms: money(expected.rate),
              channex: '—',
              direction: '**в канале нет цены**',
              danger: true,
            });
          else {
            const got = channex.channexDecimalToMinor(cell.rate);
            if (got !== expected.rate)
              diffs.push({
                ...ctx,
                field: 'rate',
                pms: money(expected.rate),
                channex: money(got),
                direction:
                  got < expected.rate
                    ? '**у нас выше — канал продаёт дешевле**'
                    : 'у нас ниже — канал продаёт дороже',
                danger: got < expected.rate,
              });
          }
        }
        const flag = (
          field: 'stop_sell' | 'closed_to_arrival' | 'closed_to_departure',
          pms: boolean,
          got: boolean | undefined,
        ) => {
          if (got === pms) return;
          diffs.push({
            ...ctx,
            field,
            pms: pms ? 'закрыто' : 'открыто',
            channex: got === undefined ? '—' : got ? 'закрыто' : 'открыто',
            direction:
              got === undefined
                ? '**в канале поля нет**'
                : pms
                  ? '**у нас закрыто, канал открыт — продаст**'
                  : `у нас открыто, канал закрыт — недопродажа${reasons}`,
            danger: pms || got === undefined,
          });
        };
        if (!expected.stop_sell && cell.stop_sell === true && cell.availability === 0)
          closedByZero.push({ ...ctx, pms: price === null ? 'нет цены' : money(price) });
        else flag('stop_sell', expected.stop_sell, cell.stop_sell);
        flag('closed_to_arrival', expected.closed_to_arrival, cell.closed_to_arrival);
        flag('closed_to_departure', expected.closed_to_departure, cell.closed_to_departure);
        const num = (
          field: 'min_stay_arrival' | 'min_stay_through' | 'max_stay',
          pms: number,
          got: number | undefined,
        ) => {
          if (got === pms) return;
          diffs.push({
            ...ctx,
            field,
            pms: String(pms),
            channex: got === undefined ? '—' : String(got),
            direction:
              got === undefined
                ? '**в канале поля нет**'
                : got < pms
                  ? field === 'max_stay'
                    ? 'у нас больше — канал ограничивает сильнее'
                    : '**у нас больше — канал примет более короткое проживание**'
                  : field === 'max_stay'
                    ? '**у нас меньше — канал примет более долгое проживание**'
                    : 'у нас меньше — канал ограничивает сильнее',
            danger:
              got === undefined || (field === 'max_stay' ? got > pms && pms !== 0 : got < pms),
          });
        };
        num('min_stay_arrival', expected.min_stay_arrival, cell.min_stay_arrival);
        num('min_stay_through', expected.min_stay_through, cell.min_stay_through);
        num('max_stay', expected.max_stay, cell.max_stay);
      }
      if (diffs.length > before) group.diffs += 1;
    }
  }

  const byField = (f: string) => diffs.filter((d) => d.field === f).length;
  const danger = diffs.filter((d) => d.danger);
  const md = [
    `# Цены и ограничения: PMS против Channex (${today} → ${to})`,
    '',
    `CONTROL DATE: ${today}`,
    `PERIOD: ${today} → ${to} (${days} дн.)`,
    '',
    `Снято ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Объект Channex \`${propertyId}\` (staging), валюта ${property.currency}.`,
    `Источник PMS: \`daily_rates\` (occupancy = вместимость категории, как при публикации) и \`restrictions\`;`,
    `ожидаемое строится по правилам публикации (нет цены → stop_sell; min_stay пусто → 1; max_stay пусто → 0).`,
    `Источник Channex: GET /restrictions (ari.md). Допуск: 0 клеток. Клетки, где канал закрыт из-за нулевого`,
    `остатка (stop_sell=true при availability=0 — поведение staging, в ari.md не описано), считаются отдельно.`,
    '',
    `## TOTALS`,
    '',
    `| Показатель | Значение |`,
    `|---|---:|`,
    `| Тарифов в маппинге (категория × тариф) | ${mapped.length} |`,
    `| Проверено клеток (дата × категория × тариф) | ${cells} |`,
    `| Клеток без цены в PMS (ожидаем stop_sell в канале) | ${noPrice} |`,
    `| Клеток нет в Channex | ${missing} |`,
    `| Расхождений всего (строк) | ${diffs.length} |`,
    `| — по цене | ${byField('rate')} |`,
    `| — по min_stay_arrival / min_stay_through | ${byField('min_stay_arrival')} / ${byField('min_stay_through')} |`,
    `| — по max_stay | ${byField('max_stay')} |`,
    `| — по stop_sell | ${byField('stop_sell')} |`,
    `| — по closed_to_arrival / closed_to_departure | ${byField('closed_to_arrival')} / ${byField('closed_to_departure')} |`,
    `| ОПАСНО: канал продаёт там, так или дешевле, чем мы разрешили | ${danger.length} |`,
    `| Закрыто каналом при нулевом остатке (не расхождение; остаток сверяет cli-channex-ari.ts) | ${closedByZero.length} |`,
    '',
    `## BY TARIFF × CATEGORY`,
    '',
    `| Тариф | Категория | Тариф Channex | Клеток | Совпало | Клеток с расхождением |`,
    `|---|---|---|---:|---:|---:|`,
    ...[...byPlan.values()].map(
      (g) =>
        `| ${g.tariff} | ${g.category} | \`${g.channexPlan}\` | ${g.cells} | ${g.cells - g.diffs} | ${g.diffs} |`,
    ),
    '',
    diffs.length === 0
      ? '**RESULT: OK** — цены и ограничения совпадают клетка в клетку.'
      : danger.length === 0
        ? `**RESULT: FAIL** — ${diffs.length} расхожд. в безопасную сторону (канал ограничивает сильнее или продаёт дороже), список ниже.`
        : `**RESULT: FAIL — риск**: ${danger.length} расхожд., где канал продаёт там, так или дешевле, чем мы разрешили; всего ${diffs.length}.`,
    '',
    ...(diffs.length
      ? [
          `## РАСХОЖДЕНИЯ (первые ${Math.min(diffs.length, 100)} из ${diffs.length})`,
          '',
          `| Дата | Категория | Тариф | Поле | PMS | Channex | Направление |`,
          `|---|---|---|---|---:|---:|---|`,
          ...diffs
            .slice(0, 100)
            .map(
              (d) =>
                `| ${d.date} | ${d.category} | ${d.tariff} | ${d.field} | ${d.pms} | ${d.channex} | ${d.direction} |`,
            ),
          '',
        ]
      : []),
    ...(closedByZero.length
      ? [
          `## ЗАКРЫТО КАНАЛОМ ПРИ НУЛЕВОМ ОСТАТКЕ (первые ${Math.min(closedByZero.length, 100)} из ${closedByZero.length})`,
          '',
          `| Дата | Категория | Тариф | Цена PMS | Channex |`,
          `|---|---|---|---:|---|`,
          ...closedByZero
            .slice(0, 100)
            .map(
              (d) =>
                `| ${d.date} | ${d.category} | ${d.tariff} | ${d.pms} | stop_sell=true, availability=0 |`,
            ),
          '',
        ]
      : []),
  ].join('\n');
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/channex-rates-${today}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  process.exitCode = diffs.length === 0 ? 0 : 1;
} finally {
  await db.$disconnect();
}
