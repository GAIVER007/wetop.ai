export interface RetailPayload { productId: string; quantityUnits: string; method: string }
export type RetailIntent = { v: 1; key: string; payload: RetailPayload; status: 'pending' | 'retry' | 'hold' | 'confirmed'; createdAt: number; blocked?: boolean; warning?: string };
/** Stable owner, NOT session identity. Current session expiry only authorizes dispatch. */
export function retailScope(parts: readonly string[]) {
  if (parts.length !== 7 || parts.some(p => !p)) throw new Error('Объект формы: неполный контекст');
  return `bar:retail:v1:${JSON.stringify(parts.slice(0, 6))}`;
}
export function validateRetailDraft(payload: RetailPayload, products: readonly string[], methods: readonly string[]) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.productId) || !products.includes(payload.productId)) throw new Error('Выберите доступный товар');
  if (!/^[0-9]+$/.test(payload.quantityUnits) || payload.quantityUnits.length > 19 || BigInt(payload.quantityUnits) <= 0n || BigInt(payload.quantityUnits) > 9223372036854775807n) throw new Error('Количество: нужно целое число от 1 до 9223372036854775807');
  if (!methods.includes(payload.method)) throw new Error('Выберите доступный способ оплаты');
}
export function createRetailRecovery(storage: Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'key' | 'length'>>, slot: string,
  now = Date.now, uuid = () => crypto.randomUUID(), expiresAt = Number.POSITIVE_INFINITY,
  publish: (record: RetailIntent | null) => void = () => {}) {
  let busy = false, memory: RetailIntent | null = null;
  const live = () => { if (now() >= expiresAt) throw new Error('Войдите заново и выберите тот же объект для продолжения продажи.'); };
  const decode = (raw: string): RetailIntent => {
    const r = JSON.parse(raw) as RetailIntent;
    if (r.v !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.key) || !['pending','retry','hold','confirmed'].includes(r.status) ||
      !Number.isFinite(r.createdAt) || r.createdAt > now() || !r.payload ||
      typeof r.payload.productId !== 'string' || !r.payload.productId || typeof r.payload.quantityUnits !== 'string' ||
      !/^[0-9]+$/.test(r.payload.quantityUnits) || typeof r.payload.method !== 'string' || !r.payload.method)
      throw new Error('Повреждено сохранённое намерение. Требуется сверка; новая продажа заблокирована.');
    return { ...r, payload: { ...r.payload }, status: r.status === 'pending' ? 'retry' : r.status };
  };
  const load = (): RetailIntent | null => {
    const raw = storage.getItem(slot);
    const candidates: RetailIntent[] = raw ? [decode(raw)] : [];
    // Discover old expiry-namespaced records for this owner only. Never remove originals.
    for (let i = 0; i < (storage.length ?? 0); i++) {
      const key = storage.key?.(i);
      if (!key || key === slot || !key.startsWith('bar:retail:v1:')) continue;
      let parts: unknown;
      try { parts = JSON.parse(key.slice('bar:retail:v1:'.length)); } catch { continue; }
      if (!Array.isArray(parts) || parts.length !== 7 || `bar:retail:v1:${JSON.stringify(parts.slice(0,6))}` !== slot) continue;
      const legacy = storage.getItem(key);
      if (legacy) {
        const r = decode(legacy);
        if (r.status === 'confirmed') continue;
        // Only an exact, owner-scoped completed intent may retire this legacy candidate.
        const proof = storage.getItem(`${slot}:resolved:${r.key}`);
        if (proof) {
          const completed = decode(proof);
          if (completed.status !== 'confirmed' || completed.key !== r.key || completed.createdAt !== r.createdAt ||
            JSON.stringify(completed.payload) !== JSON.stringify(r.payload))
            throw new Error('Подтверждение не совпадает с исходной продажей. Нужна сверка журнала.');
        } else candidates.push(r);
      }
    }
    if (new Set(candidates.map(r => r.key)).size > 1) throw new Error('Найдено несколько незавершённых продаж. Нужна сверка журнала.');
    if (candidates.some(r => r.createdAt !== candidates[0]!.createdAt || JSON.stringify(r.payload) !== JSON.stringify(candidates[0]!.payload)))
      throw new Error('Сохранённые данные одной продажи не совпадают. Нужна сверка журнала.');
    return candidates[0] ?? null;
  };
  const emit = (r: RetailIntent | null) => { memory = r; publish(r); };
  const write = (record: RetailIntent | null) => {
    const raw = record === null ? '' : JSON.stringify(record);
    storage.setItem(slot, raw);
    if (storage.getItem(slot) !== raw) throw new Error('Не удалось сохранить ключ продажи');
  };
  return {
    read() { const r = load(); emit(r); return r; },
    async submit(payload: RetailPayload, send: (key: string, payload: RetailPayload) => Promise<unknown>) {
      if (busy) throw new Error('Продажа уже отправляется. Дождитесь ответа.');
      if (memory?.status === 'confirmed') throw new Error('Продажа уже подтверждена.');
      busy = true;
      let dispatched = false;
      let record: RetailIntent | null = memory;
      try {
        live();
        const old = load();
        if (memory?.blocked) throw new Error('Не удалось сохранить продажу. Нужна сверка журнала.');
        if (old?.status === 'confirmed') throw new Error('Продажа уже подтверждена.');
        if (old && JSON.stringify(old.payload) !== JSON.stringify(payload)) throw new Error('Восстановите исходные поля продажи.');
        record = old ?? { v: 1, key: uuid(), payload: { ...payload }, status: 'pending', createdAt: now() };
        // Publish a fail-closed in-memory hold even if pre-dispatch persistence partially fails.
        emit({ ...record, status: 'pending' });
        write({ ...record, status: 'pending' });
        live();
        dispatched = true;
        let failed = false, warning: string | undefined;
        try { await send(record.key, { ...record.payload }); }
        catch (error) { failed = true; warning = error instanceof Error ? error.message : String(error); }
        record = { ...record, status: failed ? 'hold' : 'confirmed' };
        if (warning === undefined) delete record.warning;
        else record.warning = warning;
        emit(record); // Preserve available result before any further storage operation.
        const current = load();
        if (current?.key !== record.key || current.createdAt !== record.createdAt || JSON.stringify(current.payload) !== JSON.stringify(record.payload)) throw new Error('Сохранённая продажа изменилась. Нужна сверка журнала.');
        live();
        write(record);
        return record;
      } catch (error) {
        if (record) {
          const held: RetailIntent = { ...record, status: 'hold', blocked: true,
            warning: [record.warning, dispatched ? 'Продажа отправлена, но результат требует сверки' : 'Продажа не отправлена: не удалось сохранить данные', error instanceof Error ? error.message : String(error)].filter(Boolean).join('. ') };
          emit(held);
          return held;
        }
        throw error;
      } finally { busy = false; }
    },
    newIntent() {
      try {
        const completed = load();
        if (busy || memory?.blocked || completed?.status !== 'confirmed') throw new Error('Сначала нужно подтвердить результат исходной продажи.');
        live();
        // Persist/read back exact completion BEFORE clearing the canonical confirmed record.
        // This local migration proof survives newIntent; it is not server reconciliation.
        const marker = `${slot}:resolved:${completed.key}`, raw = JSON.stringify(completed);
        storage.setItem(marker, raw);
        if (storage.getItem(marker) !== raw) throw new Error('Не удалось сохранить подтверждение ключа');
        write(null); emit(null);
      }
      catch (error) { if (memory) emit({ ...memory, status: 'hold', blocked: true, warning: 'Не удалось сохранить подтверждение продажи. Нужна сверка журнала.' }); throw error; }
    },
  };
}
