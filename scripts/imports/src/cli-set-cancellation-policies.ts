/**
 * Политика штрафа по тарифам (Q-103, ответ управляющего 10.09.2026, голосом).
 *
 * Правило объекта: отмена заранее бесплатна везде; штраф появляется только в день заезда и при незаезде
 * (это проверяет домен, `penaltyDue`). Сумма зависит от тарифа — её и расставляет этот скрипт:
 *   • прямые продажи и стойка — штрафа нет: «от стойки мы условно не можем брать штраф»;
 *   • тарифы ОТА — стоимость первой ночи: Trip.com, Agoda, Expedia с полной онлайн-оплатой;
 *     Booking предоплаты не даёт, поэтому там начисление ставится, а стойка сторнирует его,
 *     если списать с карты не удалось;
 *   • невозвратный тариф Островка — вся стоимость брони.
 * Идемпотентно. Запуск: npx tsx scripts/imports/src/cli-set-cancellation-policies.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

/** Ключ — код тарифа (exely-<id>), значение — политика. Тарифы из OBJECT.md §3. */
const POLICY: Record<string, 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY'> = {
  'exely-10157482': 'NONE', // Базовый тариф — сайт и стойка
  'exely-10158310': 'FIRST_NIGHT', // Тариф для ОТА +35%
  'exely-10159064': 'FIRST_NIGHT', // Тариф для ОТА в USD +35%
  'exely-10162781': 'NONE', // Стандартный тариф для Островка
  'exely-10162782': 'FULL_STAY', // Невозвратный тариф Островок −10%
  'exely-10162783': 'NONE', // В2В Островок
};

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const plans = await db.ratePlan.findMany({
    where: { propertyId: property.id },
    select: { id: true, code: true, name: true, cancellationPenalty: true },
    orderBy: { code: 'asc' },
  });
  let changed = 0;
  for (const p of plans) {
    const want = POLICY[p.code];
    if (!want) {
      console.log(`  ${p.code} «${p.name}»: политика не задана в скрипте — пропускаю`);
      continue;
    }
    if (p.cancellationPenalty === want) {
      console.log(`  ${p.code} «${p.name}»: уже ${want}`);
      continue;
    }
    await db.ratePlan.update({ where: { id: p.id }, data: { cancellationPenalty: want } });
    console.log(`  ${p.code} «${p.name}»: ${p.cancellationPenalty} → ${want}`);
    changed += 1;
  }
  console.log(`Изменено тарифов: ${changed} из ${plans.length}`);
} finally {
  await db.$disconnect();
}
