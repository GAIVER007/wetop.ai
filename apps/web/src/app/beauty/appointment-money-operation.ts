import type { JournalResult } from './journal-actions';

export type MoneyRequest = Readonly<{
  kind: 'pay' | 'refund';
  method: string;
  amountMinor: number;
  reason?: string;
  /** оплата сертификатом: код (решение 21.10.2026 §3) */
  certificateCode?: string;
}>;
export type PreparedMoneyRequest = MoneyRequest & { readonly idempotencyKey: string };
type MarkerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** One mounted request. Persistence contains only scope IDs and an opaque operation ID.
 * An unresolved remount cannot reconstruct a reason, so it must reconcile, never replay new input.
 */
export class AppointmentMoneyOperation {
  status: 'idle' | 'pending' | 'unknown' | 'blocked' = 'blocked';
  private storage?: MarkerStorage;
  private key = '';
  private request: PreparedMoneyRequest | undefined;
  private wasUnknown = false;

  constructor(
    scope: string,
    appointmentId: string,
    storage?: MarkerStorage,
    private uuid = () => crypto.randomUUID(),
  ) {
    try {
      const parsed = JSON.parse(scope);
      const ids = [parsed.organizationId, parsed.businessId, parsed.locationId, appointmentId];
      if (ids.some((id) => typeof id !== 'string' || !id.trim())) return;
      this.key = `wetop:beauty:money:${JSON.stringify(ids)}`;
      this.storage = storage ?? sessionStorage;
      this.status = this.storage.getItem(this.key) === null ? 'idle' : 'blocked';
    } catch {
      // No safe identity/storage means no dispatch.
    }
  }

  begin(input: MoneyRequest): PreparedMoneyRequest | null {
    if (this.status !== 'idle' || !this.storage) return null;
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return null;
    if (!input.method || (input.kind === 'refund' && !input.reason?.trim())) return null;
    try {
      // Check again immediately before dispatch; never overwrite a surviving marker.
      if (this.storage.getItem(this.key) !== null) { this.status = 'blocked'; return null; }
      const idempotencyKey = this.uuid();
      this.storage.setItem(this.key, idempotencyKey);
      if (this.storage.getItem(this.key) !== idempotencyKey) throw new Error('marker');
      const request: PreparedMoneyRequest = Object.freeze({
        ...input,
        ...(input.reason === undefined ? {} : { reason: input.reason.trim() }),
        idempotencyKey,
      });
      this.request = request;
      this.wasUnknown = false;
      this.status = 'pending';
      return request;
    } catch {
      this.status = 'blocked';
      return null;
    }
  }

  retry(): PreparedMoneyRequest | null {
    if (this.status !== 'unknown' || !this.request) return null;
    this.status = 'pending';
    return this.request;
  }

  settle(result: JournalResult | null | undefined): boolean {
    if (this.status !== 'pending' || !this.request) return false;
    const confirmed = Boolean(result?.message) && !result?.error && !result?.outcome;
    if (confirmed || (result?.outcome === 'rejected' && !this.wasUnknown)) {
      try {
        if (this.storage?.getItem(this.key) === this.request.idempotencyKey) {
          this.storage.removeItem(this.key);
          this.status = 'idle';
        } else this.status = 'blocked';
      } catch { this.status = 'blocked'; }
      this.request = undefined;
      return confirmed;
    }
    this.wasUnknown = true;
    this.status = 'unknown';
    return false;
  }
}
