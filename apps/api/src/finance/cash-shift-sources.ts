import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { DbTx } from '@pms/database';

type CashSourceScope = { propertyId: string | null; locationId: string; currency: string };
type Source = {
  id: string;
  kind: string;
  method: string;
  method_to: string | null;
  amount: bigint;
  currency: string;
};

/** Existing money sources, each exactly once. Non-cash benefits never enter a register. */
export async function readCashShiftSnapshot(db: DbTx, scope: CashSourceScope, registerId: string) {
  const rows = scope.propertyId
    ? await db.$queryRaw<Source[]>`
      SELECT ('p:'||id)::text id,'PAYMENT'::text kind,method::text,NULL::text method_to,amount,currency::text FROM payments
       WHERE property_id=${scope.propertyId}::uuid AND status='COMPLETED'
      UNION ALL SELECT ('r:'||r.id)::text,'REFUND',p.method::text,NULL::text,r.amount,p.currency::text FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.property_id=${scope.propertyId}::uuid
      UNION ALL SELECT ('c:'||c.id)::text,c.kind::text,c.method::text,c.method_to::text,c.amount,
        coalesce(s.currency,receipt.currency,${scope.currency})::text
        FROM cash_operations c LEFT JOIN bar_sales s ON s.cash_operation_id=c.id
        LEFT JOIN bar_supplier_payments bp ON bp.cash_operation_id=c.id LEFT JOIN bar_receipts receipt ON receipt.id=bp.receipt_id
       WHERE c.property_id=${scope.propertyId}::uuid AND c.status='COMPLETED'`
    : await db.$queryRaw<Source[]>`
      SELECT ('p:'||id)::text id,'PAYMENT'::text kind,method::text,NULL::text method_to,amount,currency::text FROM restaurant_payments
       WHERE location_id=${scope.locationId}::uuid AND status='COMPLETED'
      UNION ALL SELECT ('c:'||c.id)::text,
        CASE WHEN c.kind='INCOME' AND (c.appointment_id IS NOT NULL OR EXISTS(SELECT 1 FROM bar_sales s WHERE s.restaurant_cash_operation_id=c.id)) THEN 'PAYMENT'
             WHEN c.kind='EXPENSE' AND (c.appointment_id IS NOT NULL OR c.order_id IS NOT NULL) THEN 'REFUND'
             ELSE c.kind::text END,
        c.method::text,c.method_to::text,c.amount,c.currency::text FROM restaurant_cash_operations c
       WHERE c.location_id=${scope.locationId}::uuid AND c.status='COMPLETED'`;
  const handovers = await db.$queryRaw<
    Source[]
  >`SELECT ('h:'||h.id)::text id,'HANDOVER'::text kind,'CASH'::text method,NULL::text method_to,h.amount,r.currency::text
    FROM cash_handovers h JOIN cash_registers r ON r.id=h.register_id WHERE h.register_id=${registerId}::uuid AND h.acknowledged_at IS NOT NULL`;
  rows.push(...handovers);
  const balances: Record<string, bigint> = { CASH: 0n },
    expenses: Record<string, bigint> = {},
    received: Record<string, bigint> = {},
    refunds: Record<string, bigint> = {};
  const add = (target: Record<string, bigint>, method: string, amount: bigint) => {
    target[method] = (target[method] ?? 0n) + amount;
  };
  for (const row of rows) {
    if (['EXTERNAL', 'DEPOSIT', 'CARD_GUARANTEE', 'BONUS', 'GIFT_CERTIFICATE'].includes(row.method))
      continue;
    if (row.currency !== scope.currency)
      throw new ConflictException(
        'Источники кассы содержат несовместимую валюту. Нужна отдельная сверка.',
      );
    add(
      balances,
      row.method,
      row.kind === 'PAYMENT' || row.kind === 'INCOME' ? row.amount : -row.amount,
    );
    if (row.kind === 'TRANSFER' && row.method_to) add(balances, row.method_to, row.amount);
    if (row.kind === 'EXPENSE') add(expenses, row.method, row.amount);
    if (row.kind === 'PAYMENT') add(received, row.method, row.amount);
    if (row.kind === 'REFUND') add(refunds, row.method, row.amount);
  }
  const strings = (values: Record<string, bigint>) =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
  return {
    balances: strings(balances),
    expenses: strings(expenses),
    received: strings(received),
    refunds: strings(refunds),
    fingerprint: createHash('sha256')
      .update(
        JSON.stringify(
          rows
            .map((r) => ({ ...r, amount: String(r.amount) }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        ),
      )
      .digest('hex'),
  };
}

/** Separate physical handovers reduce available cash, without entering business expenses. */
export async function acknowledgedCashHandovers(
  db: Pick<DbTx, '$queryRaw'>,
  scope: { propertyId?: string; locationId?: string },
): Promise<bigint> {
  const [row] = await db.$queryRaw<
    Array<{ amount: bigint }>
  >`SELECT coalesce(sum(h.amount),0)::bigint amount FROM cash_handovers h JOIN cash_registers r ON r.id=h.register_id
    WHERE h.acknowledged_at IS NOT NULL AND (r.property_id=${scope.propertyId ?? null}::uuid OR r.location_id=${scope.locationId ?? null}::uuid)`;
  return BigInt(row?.amount ?? 0);
}
