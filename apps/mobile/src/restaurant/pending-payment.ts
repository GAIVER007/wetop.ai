import type { PrivateStorage } from './pending-order';
import { PAYMENT_METHODS, type PaymentMethod } from './payment-input';
export type PaymentInput = {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  currency: string;
};
export type PendingPayment = {
  context: string;
  currency: string;
  request: Omit<PaymentInput, 'currency'> & { idempotencyKey: string };
};
const queues = new Map<string, Promise<unknown>>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(): never {
  throw new Error('Не удалось проверить сохранённый платёж.');
}
function fields(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) return invalid();
  return result;
}
function input(value: unknown): PaymentInput {
  const v = fields(value, ['orderId', 'amount', 'method', 'currency']);
  if (
    typeof v.orderId !== 'string' ||
    !UUID.test(v.orderId) ||
    typeof v.amount !== 'number' ||
    !Number.isSafeInteger(v.amount) ||
    v.amount < 1 ||
    !PAYMENT_METHODS.includes(v.method as PaymentMethod) ||
    typeof v.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(v.currency)
  )
    return invalid();
  return {
    orderId: v.orderId,
    amount: v.amount,
    method: v.method as PaymentMethod,
    currency: v.currency,
  };
}
/** Separate from order creation: one immutable monetary attempt per verified account/branch. */
export class PendingPaymentStore {
  constructor(
    private storage: PrivateStorage,
    private prefix: string,
    private context: string,
    private newKey: () => string,
  ) {}
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const task = (queues.get(this.prefix) ?? Promise.resolve()).then(action, action);
    queues.set(this.prefix, task);
    void task
      .finally(() => {
        if (queues.get(this.prefix) === task) queues.delete(this.prefix);
      })
      .catch(() => {});
    return task;
  }
  private async load(): Promise<PendingPayment | null> {
    const raw = await this.storage.get(this.prefix);
    if (raw === null) return null;
    if (raw.length > 1500) return invalid();
    const saved = fields(JSON.parse(raw), ['version', 'context', 'currency', 'request']);
    if (saved.version !== 1 || saved.context !== this.context) return invalid();
    const request = fields(saved.request, ['orderId', 'amount', 'method', 'idempotencyKey']);
    const key = request.idempotencyKey;
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(key)) return invalid();
    const parsed = input({
      orderId: request.orderId,
      amount: request.amount,
      method: request.method,
      currency: saved.currency,
    });
    return {
      context: this.context,
      currency: parsed.currency,
      request: {
        orderId: parsed.orderId,
        amount: parsed.amount,
        method: parsed.method,
        idempotencyKey: key,
      },
    };
  }
  read(): Promise<PendingPayment | null> {
    return this.exclusive(() => this.load());
  }
  prepare(value: PaymentInput): Promise<PendingPayment> {
    return this.exclusive(async () => {
      if (await this.load()) throw new Error('Сначала подтвердите результат предыдущего платежа.');
      const parsed = input(value);
      const key = this.newKey();
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) return invalid();
      const attempt: PendingPayment = {
        context: this.context,
        currency: parsed.currency,
        request: {
          orderId: parsed.orderId,
          amount: parsed.amount,
          method: parsed.method,
          idempotencyKey: key,
        },
      };
      const raw = JSON.stringify({ version: 1, ...attempt });
      // Context is a hashed ASCII namespace in the native adapter; one small SecureStore record.
      if (raw.length > 1500 || !/^[\x20-\x7e]+$/.test(raw)) return invalid();
      await this.storage.set(this.prefix, raw);
      const verified = await this.load();
      if (JSON.stringify(verified) !== JSON.stringify(attempt)) return invalid();
      return verified!;
    });
  }
  /** Invoke only after a validated successful response for this same immutable request. */
  acknowledge(key: string): Promise<void> {
    return this.exclusive(async () => {
      const saved = await this.load();
      if (!saved || saved.request.idempotencyKey !== key) return invalid();
      await this.storage.remove(this.prefix);
      if ((await this.storage.get(this.prefix)) !== null) return invalid();
    });
  }
}
