/**
 * T6: канал обязан знать, что мест нет. Сверяет остаток PMS с остатком в Channex по каждой категории
 * и дате. Особое внимание нулям: где в PMS ноль, в Channex должен быть ноль (Channex сам ставит stop sell).
 * Только чтение. Запуск: npx tsx scripts/reconciliation/src/cli-channex-ari.ts [дней]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const days = Number(process.argv[2] ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('дней — целое 1..365');
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const api = process.env.APP_API_URL ?? 'http://localhost:3001';

const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const to = plus(today, days - 1);

const mapping = (await (await fetch(`${api}/channels/channex/mapping`)).json()) as Array<{
  localAccommodationTypeCode: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
}>;
const mapped = mapping.filter((m) => m.providerRoomTypeId && m.localAccommodationTypeCode);
if (mapped.length === 0) throw new Error('маппинг Channex пуст — сначала setup');
const propertyId = mapped[0]!.providerPropertyId;

const client = new channex.ChannexClient(
  process.env.CHANNEX_API_BASE_URL?.trim()
    ? { apiKey, baseUrl: process.env.CHANNEX_API_BASE_URL.trim() }
    : { apiKey },
);
const channexAvail = await client.getAvailability(propertyId, today, to);

interface Row {
  category: string;
  date: string;
  pms: number;
  channex: number;
}
const rows: Row[] = [];
for (let i = 0; i < days; i += 1) {
  const date = plus(today, i);
  const next = plus(date, 1);
  const av = (await (
    await fetch(`${api}/availability?arrival=${date}&departure=${next}`)
  ).json()) as {
    byCategory: Record<string, { available: number }>;
  };
  for (const m of mapped) {
    const code = m.localAccommodationTypeCode!;
    rows.push({
      category: code,
      date,
      pms: av.byCategory[code]?.available ?? 0,
      channex: channexAvail[m.providerRoomTypeId!]?.[date] ?? -1,
    });
  }
}

const diffs = rows.filter((r) => r.pms !== r.channex);
// Направление расхождения важнее его величины: канал, у которого мест БОЛЬШЕ, чем у нас, продаст лишнее.
const oversell = diffs.filter((r) => r.channex > r.pms);
const undersell = diffs.filter((r) => r.channex < r.pms);
const zeros = rows.filter((r) => r.pms === 0);
const zerosBad = zeros.filter((r) => r.channex !== 0);
const md = [
  `# ARI: остаток PMS против Channex (${today} → ${to})`,
  '',
  `Снято ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Объект Channex \`${propertyId}\`.`,
  'Проверяется главное для T6: там, где в PMS мест нет, канал обязан видеть ноль и перестать продавать.',
  '',
  `| Показатель | Значение |`,
  `|---|---:|`,
  `| Проверено клеток (категория × дата) | ${rows.length} |`,
  `| Расхождений остатка | ${diffs.length} |`,
  `| ОПАСНО: у канала мест больше, чем у нас | ${oversell.length} |`,
  `| Безопасно: у канала мест меньше (недопродажа) | ${undersell.length} |`,
  `| Ночей с нулём в PMS | ${zeros.length} |`,
  `| Из них ноль НЕ доехал до канала | ${zerosBad.length} |`,
  '',
  oversell.length === 0 && zerosBad.length === 0
    ? diffs.length === 0
      ? '**RESULT: OK** — остатки совпадают клетка в клетку.'
      : '**RESULT: OK по овербукингу** — канал нигде не показывает мест больше, чем есть, и все нули доехали. Остаются расхождения в безопасную сторону (канал недопродаёт), список ниже.'
    : '**RESULT: FAIL — риск овербукинга**: канал показывает мест больше, чем есть.',
  '',
  ...(diffs.length
    ? [
        '| Категория | Дата | PMS | Channex | Направление |',
        '|---|---|---:|---:|---|',
        ...diffs
          .slice(0, 60)
          .map(
            (r) =>
              `| ${r.category} | ${r.date} | ${r.pms} | ${r.channex} | ${r.channex > r.pms ? '**канал продаст лишнее**' : 'канал недопродаёт'} |`,
          ),
        '',
      ]
    : []),
].join('\n');
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(ROOT, `reports/channex-ari-${today}.md`);
writeFileSync(out, md);
console.log(md);
console.log(`→ ${out}`);
// Код выхода 1 только при реальном риске: канал продаёт больше, чем есть, или ноль не доехал
process.exitCode = oversell.length === 0 && zerosBad.length === 0 ? 0 : 1;
