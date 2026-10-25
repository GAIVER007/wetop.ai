import type { PendingPaymentStore, PendingPayment, PaymentInput } from './pending-payment';
import type { RestaurantOrder } from './contracts';
import { readOrders } from './data';
export type PaymentSubmissionState =
  | { kind: 'idle' | 'saving' | 'sending' | 'storage-error' | 'context-changed' }
  | { kind: 'pending' | 'unknown'; attempt: PendingPayment }
  | {
      kind: 'confirmed' | 'confirmed-pending-cleanup';
      order: RestaurantOrder;
      key: string;
      attempt: PendingPayment;
    };
/** Network retries are explicit and always reload the immutable persisted attempt. */
export class PaymentSubmission {
  private state: PaymentSubmissionState = { kind: 'idle' };
  private busy = false;
  private listeners = new Set<() => void>();
  constructor(
    private store: Pick<PendingPaymentStore, 'read' | 'prepare' | 'acknowledge'>,
    private send: (request: PendingPayment['request']) => Promise<unknown>,
    private isCurrent: () => boolean,
  ) {}
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(state: PaymentSubmissionState) {
    this.state = state;
    this.listeners.forEach((fn) => fn());
  }
  private current(): boolean {
    if (this.isCurrent()) return true;
    this.publish({ kind: 'context-changed' });
    return false;
  }
  async restore() {
    if (this.busy || !this.current() || this.state.kind.startsWith('confirmed')) return;
    this.busy = true;
    this.publish({ kind: 'saving' });
    try {
      const attempt = await this.store.read();
      if (this.current()) this.publish(attempt ? { kind: 'pending', attempt } : { kind: 'idle' });
    } catch {
      if (this.current()) this.publish({ kind: 'storage-error' });
    } finally {
      this.busy = false;
    }
  }
  async submit(payload: PaymentInput) {
    if (this.busy || !this.current() || this.state.kind !== 'idle') return;
    this.busy = true;
    this.publish({ kind: 'saving' });
    try {
      const attempt = await this.store.prepare(payload);
      if (this.current()) await this.transmit(attempt);
    } catch {
      if (this.current()) this.publish({ kind: 'storage-error' });
    } finally {
      this.busy = false;
    }
  }
  async retry() {
    if (
      this.busy ||
      !this.current() ||
      (this.state.kind !== 'pending' && this.state.kind !== 'unknown')
    )
      return;
    const expected = JSON.stringify(this.state.attempt);
    this.busy = true;
    try {
      const attempt = await this.store.read();
      if (!attempt || JSON.stringify(attempt) !== expected)
        throw new Error('Saved attempt changed');
      if (this.current()) await this.transmit(attempt);
    } catch {
      if (this.current()) this.publish({ kind: 'storage-error' });
    } finally {
      this.busy = false;
    }
  }
  private async transmit(attempt: PendingPayment) {
    if (!this.current()) return;
    this.publish({ kind: 'sending' });
    let order: RestaurantOrder;
    try {
      const result = await this.send(
        JSON.parse(JSON.stringify(attempt.request)) as PendingPayment['request'],
      );
      if (!this.current()) return;
      order = readOrders({ items: [result], nextCursor: null }).items[0]!;
      if (order.id !== attempt.request.orderId || order.currency !== attempt.currency)
        throw new Error('Payment confirmation mismatch');
    } catch {
      if (this.current()) this.publish({ kind: 'unknown', attempt });
      return;
    }
    const key = attempt.request.idempotencyKey;
    this.publish({ kind: 'confirmed-pending-cleanup', order, key, attempt });
    try {
      await this.store.acknowledge(key);
      if (this.current()) this.publish({ kind: 'confirmed', order, key, attempt });
    } catch {
      this.current();
    }
  }
  async finish() {
    if (this.busy || !this.current() || this.state.kind !== 'confirmed-pending-cleanup') return;
    this.busy = true;
    const { order, key, attempt } = this.state;
    try {
      const saved = await this.store.read();
      if (!this.current()) return;
      if (saved) {
        if (saved.request.idempotencyKey !== key) throw new Error('Different pending attempt');
        await this.store.acknowledge(key);
      }
      if (this.current()) this.publish({ kind: 'confirmed', order, key, attempt });
    } catch {
      this.current();
    } finally {
      this.busy = false;
    }
  }
}
