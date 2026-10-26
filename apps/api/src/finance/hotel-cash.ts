import { randomUUID } from 'node:crypto';
import { type Prisma, type DbTx } from '@pms/database';
/** Default-off compatibility: no held column is referenced before cutover. */
export async function createHotelCash(tx: DbTx, data: Prisma.CashOperationUncheckedCreateInput) {
  if (process.env.EXPENSE_LINKS_ENABLED !== '1') return tx.cashOperation.create({data,select:{id:true,occurredAt:true}});
  // Lock the verified property's currency until the event commits; never infer old events.
  const [property] = await tx.$queryRaw<Array<{currency:string}>>`SELECT currency FROM properties WHERE id=${data.propertyId}::uuid FOR SHARE`;
  if (!property || !/^[A-Z]{3}$/.test(property.currency)) throw new Error('Hotel cash currency is not verified');
  const [row] = await tx.$queryRaw<Array<{id:string;occurredAt:Date}>>`
    INSERT INTO cash_operations(id,property_id,kind,method,method_to,amount,category_id,note,created_by_id,related_id,occurred_at,currency_snapshot,cash_shift_id)
    VALUES(${randomUUID()}::uuid,${data.propertyId}::uuid,${data.kind}::"CashOperationKind",${data.method}::"PaymentMethod",${data.methodTo??null}::"PaymentMethod",${data.amount}::bigint,${data.categoryId??null}::uuid,${data.note??null},${data.createdById??null}::uuid,${data.relatedId??null}::uuid,${data.occurredAt?new Date(data.occurredAt as string):new Date()},${property.currency},${data.cashShiftId??null}::uuid)
    RETURNING id,occurred_at AS "occurredAt"`;
  if (!row) throw new Error('Hotel cash event was not created');
  return row;
}
