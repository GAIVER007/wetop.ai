/**
 * Строка очереди ARI для журнала интеграции (срез 7.2, макет «Журнал интеграции»): что ушло, на какие даты,
 * по каким категориям. Считается из `channel_outbox.payload` — массива сообщений Channex с `date_from`,
 * `date_to` и `room_type_id` (остатки) или `rate_plan_id` (цены и ограничения). Только чтение.
 */
export interface OutboxRowSummary {
  dateFrom: string | null;
  dateTo: string | null;
  /** Имена категорий по маппингу; неизвестный id — сам id, чтобы строка не молчала */
  roomTypes: string[];
  messages: number;
}

export interface OutboxNames {
  /** provider room_type_id → имя категории */
  roomTypeById: Map<string, string>;
  /** provider rate_plan_id → имя категории, к которой привязан тариф */
  ratePlanById: Map<string, string>;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function outboxRowSummary(payload: unknown, names: OutboxNames): OutboxRowSummary {
  const list = Array.isArray(payload) ? payload : [];
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  const roomTypes = new Set<string>();
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const r = m as Record<string, unknown>;
    const from = str(r['date_from']);
    const to = str(r['date_to']);
    if (from && (!dateFrom || from < dateFrom)) dateFrom = from;
    if (to && (!dateTo || to > dateTo)) dateTo = to;
    const rt = str(r['room_type_id']);
    const rp = str(r['rate_plan_id']);
    if (rt) roomTypes.add(names.roomTypeById.get(rt) ?? rt);
    else if (rp) roomTypes.add(names.ratePlanById.get(rp) ?? rp);
  }
  return { dateFrom, dateTo, roomTypes: [...roomTypes], messages: list.length };
}
