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
/** Метка неподтверждённой операции: ключ и время отправки (сверка с кассой, 28.10.2026) */
export type PendingMarker = Readonly<{ idempotencyKey: string; startedAt: number }>;
/** Без ответа и без операции в кассе дольше 2 минут: запрос до сервера не дошёл или откатился */
export const MONEY_MARKER_STALE_MS = 2 * 60 * 1000;
const parseMarker = (value: string | null): PendingMarker | null => {
  if (!value) return null;
  const at = value.lastIndexOf('@');
  if (at < 0) return { idempotencyKey: value, startedAt: 0 }; // метка до исправления: без времени
  const startedAt = Number(value.slice(at + 1));
  return { idempotencyKey: value.slice(0, at), startedAt: Number.isFinite(startedAt) ? startedAt : 0 };
};

/** One mounted request. Persistence contains only scope IDs and an opaque operation ID.
 * An unresolved remount cannot reconstruct a reason, so it must reconcile, never replay new input.
 */
export class AppointmentMoneyOperation {
  status: 'idle' | 'pending' | 'unknown' | 'blocked' = 'blocked';
  private storage?: MarkerStorage;
  private key = '';
  private request: PreparedMoneyRequest | undefined;
  private wasUnknown = false;
  private marker = '';

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
      const marker = `${idempotencyKey}@${Date.now()}`;
      this.storage.setItem(this.key, marker);
      if (this.storage.getItem(this.key) !== marker) throw new Error('marker');
      this.marker = marker;
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

  /** Метка, оставшаяся от прошлого открытия (вкладка закрылась без ответа): её ключ сверяют с кассой */
  pendingMarker(): PendingMarker | null {
    if (this.status !== 'blocked' || !this.storage) return null;
    try { return parseMarker(this.storage.getItem(this.key)); } catch { return null; }
  }

  /**
   * Ответ кассы по ключу метки: операция есть (деньги прошли) или её нет дольше 2 минут (не дошла). Тогда метка
   * снимается и можно принимать оплату дальше; повтор старого ключа сервер всё равно не проведёт второй раз.
   * Снимается только та метка, которую сверяли: если другая вкладка успела поставить свою, она остаётся.
   */
  reconcile(found: boolean, now: number, expected: PendingMarker | null = this.pendingMarker()): boolean {
    if (this.status !== 'blocked' || !this.storage || !expected) return false;
    if (!found && now - expected.startedAt < MONEY_MARKER_STALE_MS) return false;
    try {
      const current = parseMarker(this.storage.getItem(this.key));
      if (!current || current.idempotencyKey !== expected.idempotencyKey || current.startedAt !== expected.startedAt) return false;
      this.storage.removeItem(this.key);
      this.status = 'idle';
      return true;
    } catch { return false; }
  }

  settle(result: JournalResult | null | undefined): boolean {
    if (this.status !== 'pending' || !this.request) return false;
    const confirmed = Boolean(result?.message) && !result?.error && !result?.outcome;
    if (confirmed || (result?.outcome === 'rejected' && !this.wasUnknown)) {
      try {
        if (this.storage?.getItem(this.key) === this.marker) {
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
