/**
 * Настройки объекта в Channex: автообновление остатка по событиям брони (hotels-collection.md → Property Settings).
 *
 * Channex советует `allow_availability_autoupdate_on_modification` и `..._on_cancellation` держать в `false`:
 * остаток после изменения и отмены считает PMS и шлёт абсолютные значения (ari.md). До 01.10.2026 объект
 * создавался с `true` во всех трёх полях (разбор reports/order-2026-10-01, пункт 3). Этот скрипт показывает,
 * что стоит у объекта сейчас, и по флагу `--apply` ставит рекомендованные значения. Подтверждение новой брони
 * (`..._on_confirmation`) остаётся `true`: без него остаток в канале живёт до нашей выгрузки.
 *
 * Запуск (адрес и ключ из .env: CHANNEX_API_BASE_URL, CHANNEX_API_KEY; объект из сопоставления PMS):
 *   npx tsx scripts/reconciliation/src/cli-channex-property-settings.ts            показать
 *   npx tsx scripts/reconciliation/src/cli-channex-property-settings.ts --apply    поставить false и показать результат
 *   … --property=<id в Channex>   объект явно, без запроса к API PMS
 *
 * Боевой объект: скрипт умеет и его (в этом и смысл проверки), но пишет только с `--apply`. Остатки и цены не трогает.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
import { serviceFetch } from '../../lib/service-api';
import { RECOMMENDED, settingsReport } from './channel-property-settings';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

async function main(): Promise<void> {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
  const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || 'https://staging.channex.io/api/v1';
  const apply = process.argv.includes('--apply');
  const explicit = process.argv.find((a) => a.startsWith('--property='))?.slice('--property='.length);

  let propertyId = explicit;
  if (!propertyId) {
    const api = process.env.APP_API_URL ?? 'http://localhost:3001';
    const mapping = (await (await serviceFetch(`${api}/channels/channex/mapping`)).json()) as Array<{
      providerPropertyId: string;
    }>;
    propertyId = mapping[0]?.providerPropertyId;
  }
  if (!propertyId) throw new Error('объект в Channex не найден: нет сопоставления, укажите --property=<id>');

  const client = new channex.ChannexClient({ apiKey, baseUrl });
  const before = await client.getProperty(propertyId);
  const current = before.attributes.settings as Record<string, unknown> | undefined;
  const report = settingsReport(current);
  console.log(`объект ${propertyId} (${baseUrl.includes('staging') ? 'staging' : 'боевой'}), сейчас:`);
  for (const line of report.lines) console.log(`  ${line}`);

  if (!report.differs) {
    console.log('настройки совпадают с рекомендацией Channex, менять нечего');
    return;
  }
  if (!apply) {
    console.log('отличаются от рекомендации; поставить рекомендованные: повторите с --apply');
    process.exitCode = 1;
    return;
  }
  const updated = await client.updateProperty(propertyId, { settings: { ...RECOMMENDED } });
  const after = settingsReport(updated.attributes.settings as Record<string, unknown> | undefined);
  console.log('после записи:');
  for (const line of after.lines) console.log(`  ${line}`);
  if (after.differs) throw new Error('Channex принял запрос, но настройки не совпали с рекомендацией; смотрите вывод выше');
  console.log('готово: изменение и отмена брони больше не правят остаток в Channex, его шлёт PMS');
}

await main();
