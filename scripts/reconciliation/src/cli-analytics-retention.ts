/**
 * Хранение сырых данных счётчика сайта (срез 8, план §12): сессии старше N месяцев удаляются, с ними
 * каскадом просмотры и события. Персональных данных в них нет, но объём расти вечно не должен.
 * Суточных итогов пока нет — на объёме хостела отчёт за любой период считается по сырым строкам.
 * С 24.09.2026 то же самое раз в сутки делает API (`apps/api/src/analytics/retention.service.ts`); скрипт —
 * ручной путь и `--dry`, чтобы посмотреть, сколько уйдёт.
 *
 * Запуск: npm run analytics:retention -- [--months=13] [--dry]
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { WEB_RETENTION_MONTHS, webRetentionCutoff } from '@pms/domain';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const months = Number(arg('months') ?? WEB_RETENTION_MONTHS);
const dry = process.argv.includes('--dry');
if (!Number.isInteger(months) || months < 1) {
  console.error('--months должен быть целым числом ≥ 1');
  process.exit(2);
}
const cutoff = webRetentionCutoff(new Date(), months);

const db = createPrismaClient();
try {
  const sites = await db.trackedSite.findMany({ select: { id: true, name: true } });
  let total = 0;
  for (const site of sites) {
    const where = { siteId: site.id, startedAt: { lt: cutoff } };
    const count = await db.webSession.count({ where });
    total += count;
    if (count && !dry) await db.webSession.deleteMany({ where });
    console.log(`${site.name}: сессий старше ${cutoff.toISOString().slice(0, 10)} — ${count}`);
  }
  console.log(`${dry ? 'К удалению' : 'Удалено'}: ${total} сессий (хранение ${months} мес.)`);
} finally {
  await db.$disconnect();
}
