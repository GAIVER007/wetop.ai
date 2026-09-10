/**
 * Backfill даты услуги у начислений за проживание: до 10.09.2026 они создавались без `service_date`,
 * поэтому не попадали в отчёт «Деньги за период» (фильтр по дате услуги, NULL под условие не подходит).
 * Дата услуги = дата заезда проживания. Идемпотентно: трогает только строки с пустой датой.
 * Запуск: npx tsx scripts/imports/src/cli-backfill-charge-dates.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
const db = createPrismaClient();
try {
  const before = await db.charge.count({ where: { kind: 'ACCOMMODATION', serviceDate: null } });
  console.log(`начислений за проживание без даты услуги: ${before}`);
  if (before === 0) console.log('нечего заполнять');
  else {
    const n = await db.$executeRaw`
      UPDATE charges AS c
         SET service_date = ri.arrival_date
        FROM folios f
        JOIN reservation_items ri ON ri.id = f.reservation_item_id
       WHERE c.folio_id = f.id
         AND c.kind = 'ACCOMMODATION'
         AND c.service_date IS NULL`;
    console.log(`проставлено дат: ${n}`);
  }
  const left = await db.charge.count({ where: { kind: 'ACCOMMODATION', serviceDate: null } });
  console.log(`осталось без даты: ${left}`);
} finally {
  await db.$disconnect();
}
