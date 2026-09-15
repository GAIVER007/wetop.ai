/**
 * Gate 6: балансы перенесённых счетов против Exely. Для каждого проживания из снимка карточек Exely
 * (project-input/exely/api/<дата>/bookings) сравниваем «к оплате» Exely (toPayAmount) с балансом счёта PMS.
 * Ожидание: активные (New / CheckedIn / CheckedOut) — diff 0; отменённые — PMS 0 (начисление сторнировано, Q-103),
 * Exely хранит полную сумму. Без ПД — только ID проживаний и суммы. Запуск: npx tsx scripts/reconciliation/src/cli-balances.ts [YYYY-MM-DD]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { toMinorUnits } from '@pms/imports';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const DAY = process.argv[2] ?? '2026-09-08';
const DIR = resolve(ROOT, `project-input/exely/api/${DAY}/bookings`);

interface Stay {
  id: string;
  status: string;
  amountMinor: bigint;
  toPayMinor: bigint;
}
const stays: Stay[] = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const b = JSON.parse(readFileSync(resolve(DIR, f), 'utf-8')) as {
    roomStays?: Array<{
      id: string;
      status: string;
      totalPrice?: { amount?: number; toPayAmount?: number };
    }>;
  };
  for (const s of b.roomStays ?? [])
    stays.push({
      id: s.id,
      status: s.status,
      amountMinor: toMinorUnits(s.totalPrice?.amount ?? 0, s.id),
      toPayMinor: toMinorUnits(s.totalPrice?.toPayAmount ?? 0, s.id),
    });
}

const db = createPrismaClient();
try {
  const items = await db.reservationItem.findMany({
    where: { exelyRoomStayId: { in: stays.map((s) => s.id) } },
    select: {
      exelyRoomStayId: true,
      status: true,
      folio: {
        select: {
          charges: { select: { amount: true, voidedAt: true } },
          allocations: { select: { amount: true, payment: { select: { status: true } } } },
          refunds: { select: { amount: true } },
        },
      },
    },
  });
  const pms = new Map(
    items.map((it) => {
      const f = it.folio;
      const charged =
        f?.charges.filter((c) => !c.voidedAt).reduce((x, c) => x + c.amount, 0n) ?? 0n;
      const paid =
        f?.allocations
          .filter((a) => a.payment.status === 'COMPLETED')
          .reduce((x, a) => x + a.amount, 0n) ?? 0n;
      const refunded = f?.refunds.reduce((x, r) => x + r.amount, 0n) ?? 0n;
      return [
        it.exelyRoomStayId!,
        { hasFolio: !!f, status: it.status, balance: charged - paid + refunded },
      ];
    }),
  );
  const groups: Record<
    string,
    { n: number; ok: number; noFolio: number; mismatch: string[]; exely: bigint; pms: bigint }
  > = {};
  for (const s of stays) {
    const active = s.status !== 'Cancelled';
    const g = (groups[active ? 'active' : 'cancelled'] ??= {
      n: 0,
      ok: 0,
      noFolio: 0,
      mismatch: [],
      exely: 0n,
      pms: 0n,
    });
    g.n += 1;
    const p = pms.get(s.id);
    if (!p || !p.hasFolio) {
      g.noFolio += 1;
      continue;
    }
    const expected = active ? s.toPayMinor : 0n;
    g.exely += s.toPayMinor;
    g.pms += p.balance;
    if (p.balance === expected) g.ok += 1;
    else g.mismatch.push(`${s.id} (${s.status}): PMS ${p.balance}, Exely к оплате ${s.toPayMinor}`);
  }
  const money = (m: bigint) => {
    const d = (m < 0n ? -m : m).toString().padStart(3, '0');
    return `${m < 0n ? '−' : ''}${d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${d.slice(-2)} ₸`;
  };
  const a = groups['active'] ?? { n: 0, ok: 0, noFolio: 0, mismatch: [], exely: 0n, pms: 0n };
  const c = groups['cancelled'] ?? { n: 0, ok: 0, noFolio: 0, mismatch: [], exely: 0n, pms: 0n };
  const bad = a.mismatch.length + a.noFolio + c.mismatch.length + c.noFolio;
  const md = [
    `# Балансы счетов против Exely (снимок карточек ${DAY})`,
    '',
    `Снято ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Баланс PMS = активные начисления − распределённые платежи + возвраты.`,
    'Exely «к оплате» = `totalPrice.toPayAmount` проживания. Перенос: оплаченное (`amount − toPayAmount`) — платёж `EXTERNAL exely:<roomStayId>`.',
    '',
    '| Группа | Проживаний | Сходятся | Без счёта | Расходятся | Σ Exely «к оплате» | Σ баланс PMS |',
    '|---|---|---|---|---|---|---|',
    `| Активные (New / CheckedIn / CheckedOut) | ${a.n} | ${a.ok} | ${a.noFolio} | ${a.mismatch.length} | ${money(a.exely)} | ${money(a.pms)} |`,
    `| Отменённые (ожидание PMS: 0, начисление сторнировано — Q-103) | ${c.n} | ${c.ok} | ${c.noFolio} | ${c.mismatch.length} | ${money(c.exely)} | ${money(c.pms)} |`,
    '',
    // Честно про силу доказательства: обе стороны выведены из одного снимка Exely, и для проживания,
    // которого не касалась стойка, равенство выполняется алгебраически (charged = amount,
    // paid = amount − toPay ⇒ balance = toPay). Значит сверка ловит только то, что расходится после
    // переноса: правки на стойке, платежи, возвраты, пропавшие счета. Разбор — reports/exely-import-review-2026-09-15.md.
    '> Что эта сверка доказывает: импорт положил на счёт ровно то, что отдал Exely, и после переноса баланс никто',
    '> не сломал. Она НЕ доказывает, что сама сумма верна: оплаченное считается как `amount − toPayAmount` из того же',
    '> снимка, поэтому у нетронутого проживания равенство выполняется само собой.',
    '',
    bad === 0
      ? '**Расхождение 0 по активным; отменённые — 0 в PMS по правилу §6.** Gate 6 по перенесённым счетам закрыт.'
      : `**Расхождения: ${bad}.**\n\n${[...a.mismatch, ...c.mismatch]
          .slice(0, 40)
          .map((m) => `- ${m}`)
          .join('\n')}`,
    '',
  ].join('\n');
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/balances-${DAY}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  process.exitCode = bad === 0 ? 0 : 1;
} finally {
  await db.$disconnect();
}
