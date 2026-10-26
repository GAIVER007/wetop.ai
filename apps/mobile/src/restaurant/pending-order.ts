export type OrderPayload = {
  tableId: string | null;
  guestCount: number;
  notes?: string | null;
  items: { menuItemId: string; qty: number; notes?: string | null; modifierIds: string[] }[];
};
export type PendingOrder = {
  context: string;
  request: OrderPayload & { creationRequestKey: string };
};
export interface PrivateStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
const KEY = /^[A-Za-z0-9_-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const queues = new Map<string, Promise<unknown>>();
function invalid(): never {
  throw new Error('Не удалось проверить сохранённую отправку заказа.');
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) return invalid();
  return result;
}
function integer(value: unknown, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max)
    return invalid();
  return value as number;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) return invalid();
  return value;
}
function note(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > max) return invalid();
  return value.trim() || null;
}
function payload(value: unknown): OrderPayload {
  const source = object(value, ['tableId', 'guestCount', 'notes', 'items']);
  if (!Array.isArray(source.items) || source.items.length < 1 || source.items.length > 100)
    return invalid();
  return {
    tableId: source.tableId === null ? null : id(source.tableId),
    guestCount: integer(source.guestCount, 1000),
    notes: note(source.notes, 4000),
    items: source.items.map((value) => {
      const item = object(value, ['menuItemId', 'qty', 'notes', 'modifierIds']);
      if (!Array.isArray(item.modifierIds) || item.modifierIds.length > 50) return invalid();
      const modifiers = item.modifierIds.map(id);
      if (new Set(modifiers).size !== modifiers.length) return invalid();
      return {
        menuItemId: id(item.menuItemId),
        qty: integer(item.qty, 999),
        notes: note(item.notes, 500),
        modifierIds: modifiers,
      };
    }),
  };
}
/** One recoverable attempt per account, organization, branch and environment. No network side effects. */
export class PendingOrderStore {
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
  private async load(): Promise<{ attempt: PendingOrder; count: number } | null> {
    const manifest = await this.storage.get(this.prefix);
    if (manifest === null) return null;
    const root = object(JSON.parse(manifest), ['version', 'key', 'count']);
    if (root.version !== 1 || typeof root.key !== 'string' || !KEY.test(root.key)) return invalid();
    const count = integer(root.count, 1024);
    let raw = '';
    for (let index = 0; index < count; index++) {
      const chunk = await this.storage.get(`${this.prefix}.${root.key}.${index}`);
      if (chunk === null) return invalid();
      raw += chunk;
      if (raw.length > 131072) return invalid();
    }
    const saved = object(JSON.parse(raw), ['context', 'request']);
    if (saved.context !== this.context) return invalid();
    const request = object(saved.request, [
      'tableId',
      'guestCount',
      'notes',
      'items',
      'creationRequestKey',
    ]);
    if (request.creationRequestKey !== root.key) return invalid();
    const { creationRequestKey, ...fields } = request;
    return {
      attempt: {
        context: this.context,
        request: { ...payload(fields), creationRequestKey: creationRequestKey as string },
      },
      count,
    };
  }
  read(): Promise<PendingOrder | null> {
    return this.exclusive(async () => (await this.load())?.attempt ?? null);
  }
  prepare(input: OrderPayload): Promise<PendingOrder> {
    return this.exclusive(async () => {
      if (await this.load()) throw new Error('Сначала подтвердите результат предыдущей отправки.');
      const fields = payload(input);
      const key = this.newKey();
      if (!KEY.test(key)) return invalid();
      const attempt = { context: this.context, request: { ...fields, creationRequestKey: key } };
      const raw = JSON.stringify(attempt);
      if (raw.length > 131072) throw new Error('Заказ слишком большой для безопасного сохранения.');
      // 400 Unicode code points occupy at most 1600 UTF-8 bytes per SecureStore value.
      const chars = Array.from(raw);
      const count = Math.ceil(chars.length / 400);
      for (let i = 0; i < count; i++)
        await this.storage.set(
          `${this.prefix}.${key}.${i}`,
          chars.slice(i * 400, (i + 1) * 400).join(''),
        );
      // Publish the manifest only after all chunks were saved. Never send before prepare resolves.
      await this.storage.set(this.prefix, JSON.stringify({ version: 1, key, count }));
      const verified = await this.load();
      if (!verified || JSON.stringify(verified.attempt) !== raw) return invalid();
      return verified.attempt;
    });
  }
  /** Call only after a valid server acknowledgement for this exact key. */
  acknowledge(key: string): Promise<void> {
    return this.exclusive(async () => {
      const saved = await this.load();
      if (!saved || saved.attempt.request.creationRequestKey !== key) return invalid();
      await this.storage.remove(this.prefix);
      if ((await this.storage.get(this.prefix)) !== null) return invalid();
      for (let i = 0; i < saved.count; i++)
        await this.storage.remove(`${this.prefix}.${key}.${i}`).catch(() => {});
    });
  }
}
