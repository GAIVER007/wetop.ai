import { createHash, randomUUID } from 'node:crypto';

export class ExpenseIntentConflict extends Error {}
export type ExpenseQuery = (sql: string, values?: unknown[]) => Promise<unknown[]>;
export interface ExpenseDatabase { transaction<T>(fn: (query: ExpenseQuery) => Promise<T>): Promise<T> }
export type ExpenseInput = { categoryId: string; title: string; documentDate: string; amountMinor: string; currency: string; supplierReceiptId?: string; marketingExpenseId?: string };
type Intent = { normalized_payload_hash: string; result_id: string };
/** Link-only persistence: does not call or duplicate any cash writer. */
export class ExpenseStore {
  constructor(private readonly db: ExpenseDatabase) {}
  private async intent(location: string, actor: string | null, key: string, action: string, payload: unknown, write: (q: ExpenseQuery, id: string) => Promise<void>) {
    if (!key || key.length > 200) throw new Error('Invalid intent key');
    const hash = createHash('sha256').update(JSON.stringify([action,payload])).digest('hex');
    return this.db.transaction(async q => {
      await q('SELECT id FROM locations WHERE id=$1::uuid FOR NO KEY UPDATE',[location]);
      const old = (await q('SELECT normalized_payload_hash,result_id FROM payment_write_intents WHERE location_id=$1::uuid AND intent_key=$2',[location,key]))[0] as Intent | undefined;
      if (old) {
        if (old.normalized_payload_hash !== hash) throw new ExpenseIntentConflict('Payment intent payload conflict');
        return { id: old.result_id };
      }
      const id = randomUUID();
      // Claim and effect commit atomically. Location serialization plus UNIQUE covers concurrent retries.
      await q(`INSERT INTO payment_write_intents(id,location_id,intent_key,action,normalized_payload_hash,result_id,created_by_id) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7::uuid) RETURNING id`,[randomUUID(),location,key,action,hash,id,actor]);
      await write(q,id);
      return { id };
    });
  }
  create(location: string, actor: string | null, key: string, p: ExpenseInput) {
    const normalized = { categoryId:p.categoryId,title:p.title.trim(),documentDate:p.documentDate,amountMinor:p.amountMinor,currency:p.currency,supplierReceiptId:p.supplierReceiptId ?? null,...(p.marketingExpenseId ? {marketingExpenseId:p.marketingExpenseId} : {}) };
    return this.intent(location,actor,key,'EXPENSE_DOCUMENT',normalized,async(q,id)=>{
      await q(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state,supplier_receipt_id,created_by_id,marketing_expense_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::date,$6::bigint,$7,'ACTIVE',$8::uuid,$9::uuid,$10::uuid) RETURNING id`,[id,location,normalized.categoryId,normalized.title,normalized.documentDate,normalized.amountMinor,normalized.currency,normalized.supplierReceiptId,actor,normalized.marketingExpenseId ?? null]);
    });
  }
  link(location: string, actor: string | null, key: string, documentId: string, sourceType: 'HOTEL_CASH'|'RESTAURANT_CASH', sourceId: string) {
    return this.intent(location,actor,key,'EXPENSE_LINK',{documentId,sourceType,sourceId},async(q,id)=>{
      await q(`INSERT INTO expense_settlements(id,location_id,expense_document_id,cash_operation_id,restaurant_cash_operation_id,created_by_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid) RETURNING id`,[id,location,documentId,sourceType==='HOTEL_CASH'?sourceId:null,sourceType==='RESTAURANT_CASH'?sourceId:null,actor]);
    });
  }
  list(location: string, cursor: string | null, limit: number) {
    return this.db.transaction(q=>q(`SELECT id,title,category_id AS "categoryId",document_date::text AS "documentDate",amount_minor::text AS "amountMinor",currency,state,version,expense_paid_minor(id)::text AS "paidMinor",(amount_minor-expense_paid_minor(id))::text AS "remainingMinor" FROM expense_documents WHERE location_id=$1::uuid AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $3`,[location,cursor,limit]));
  }
}
