/**
 * Рассадка проживаний из Exely за один импорт (сквозная проверка 14.09.2026: 13 проживаний на шахматке PMS стояли
 * не на тех койках, что в Exely). Exely меняет гостей местами — A 43 → 46, B 46 → 43 — и цепочками. Прежний импорт
 * сажал по одному проживанию: место из Exely было ещё занято не обработанным соседом, оба оставались на старых
 * местах, и так на каждом прогоне.
 *
 * Здесь пачка планируется целиком, и никто не становится хуже, чем был:
 *  1) каждое проживание начинает со своей нынешней ячейки (если она своей категории и свободна на эти даты);
 *  2) проживание переходит на место из Exely, как только оно свободно, — повторяется, пока кто-то движется
 *     (цепочки сходятся в любом порядке броней);
 *  3) замкнутый круг — обмен двух или цикл нескольких, где место каждого занято только следующим, — проворачивается
 *     целиком;
 *  4) место из Exely занято чужой бронью (в том числе в прошлые ночи: Exely хранит одну комнату на весь срок, даже
 *     если гость переехал посреди него) — проживание остаётся на своей ячейке, и сосед по обмену его не выгоняет.
 *     Сажать с переездом внутри срока — вопрос владельцу Q-120, здесь не угадывается.
 * Чистая функция, без БД: решения применяет importReservations.
 */
export interface SeatRequest {
  itemId: string;
  typeId: string;
  /** Ячейка, которую назначил Exely */
  desiredUnitId: string;
  /** Первая ночь, YYYY-MM-DD */
  start: string;
  /** Дата выезда (ночь не включается), YYYY-MM-DD */
  end: string;
  /** Где проживание сидит в PMS сейчас */
  current: { unitId: string; typeId: string } | null;
}

/** Назначение, с которым столкнулось проживание: чужое или соседа по пачке */
export interface SeatOccupancy {
  unitId: string;
  itemId: string;
  start: string;
  end: string;
}

export type SeatDecision =
  /** Место из Exely */
  | { itemId: string; kind: 'desired'; unitId: string }
  /** Место из Exely занято — проживание остаётся на своей ячейке */
  | { itemId: string; kind: 'kept'; unitId: string; conflict: SeatOccupancy }
  /** Своей ячейки нет или она больше не годится — свободную ячейку категории ищет отдельный проход после импорта */
  | { itemId: string; kind: 'displaced'; conflict: SeatOccupancy };

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  a.start < b.end && b.start < a.end;

export function planSeats(
  requests: readonly SeatRequest[],
  occupied: readonly SeatOccupancy[],
): SeatDecision[] {
  // Сначала те, кто уже сидит на месте из Exely: при двойной продаже койки место остаётся за тем, кто на ней стоит,
  // а не за тем, чья бронь пришла первой, — иначе гость прыгал бы между койками от прогона к прогону
  const ordered = [
    ...requests.filter((r) => r.current?.unitId === r.desiredUnitId),
    ...requests.filter((r) => r.current?.unitId !== r.desiredUnitId),
  ];
  const seat = new Map<string, string | null>();
  const foreignHolder = (unitId: string, r: SeatRequest) =>
    occupied.find((o) => o.unitId === unitId && o.itemId !== r.itemId && overlaps(o, r));
  const batchHolders = (unitId: string, r: SeatRequest) =>
    requests.filter((q) => q.itemId !== r.itemId && seat.get(q.itemId) === unitId && overlaps(q, r));
  const free = (unitId: string, r: SeatRequest) =>
    !foreignHolder(unitId, r) && batchHolders(unitId, r).length === 0;

  // 1) нынешние ячейки: своя категория (или уже место из Exely) и свободна на эти даты
  for (const r of ordered) {
    const c = r.current;
    const usable = c !== null && (c.unitId === r.desiredUnitId || c.typeId === r.typeId);
    seat.set(r.itemId, usable && free(c.unitId, r) ? c.unitId : null);
  }

  for (let moved = true; moved; ) {
    moved = false;
    // 2) на место из Exely, если оно свободно
    for (const r of ordered)
      if (seat.get(r.itemId) !== r.desiredUnitId && free(r.desiredUnitId, r)) {
        seat.set(r.itemId, r.desiredUnitId);
        moved = true;
      }
    if (moved) continue;
    // 3) замкнутый круг: место каждого занято только следующим, чужих броней на этих местах нет
    const next = new Map<string, string>();
    for (const r of ordered) {
      const s = seat.get(r.itemId);
      if (!s || s === r.desiredUnitId || foreignHolder(r.desiredUnitId, r)) continue;
      const holders = batchHolders(r.desiredUnitId, r);
      if (holders.length === 1) next.set(r.itemId, holders[0]!.itemId);
    }
    const byId = new Map(requests.map((r) => [r.itemId, r]));
    for (const from of next.keys()) {
      const path: string[] = [];
      let cursor: string | undefined = from;
      while (cursor !== undefined && !path.includes(cursor)) {
        path.push(cursor);
        cursor = next.get(cursor);
      }
      if (cursor === undefined) continue;
      const cycle = path.slice(path.indexOf(cursor)).map((id) => byId.get(id)!);
      const clash = cycle.some((a, i) =>
        cycle.some((b, j) => i !== j && a.desiredUnitId === b.desiredUnitId && overlaps(a, b)),
      );
      if (clash) continue;
      for (const r of cycle) seat.set(r.itemId, r.desiredUnitId);
      moved = true;
      break;
    }
  }

  return requests.map((r): SeatDecision => {
    const s = seat.get(r.itemId);
    if (s === r.desiredUnitId) return { itemId: r.itemId, kind: 'desired', unitId: r.desiredUnitId };
    const neighbour = batchHolders(r.desiredUnitId, r)[0];
    const conflict =
      foreignHolder(r.desiredUnitId, r) ??
      (neighbour
        ? { unitId: r.desiredUnitId, itemId: neighbour.itemId, start: neighbour.start, end: neighbour.end }
        : null);
    // место из Exely свободно, но проживание не на нём — так закончиться не может: шаг 2 его бы пересадил
    if (!conflict) throw new Error(`рассадка: проживание ${r.itemId} не на свободном месте из Exely`);
    return s
      ? { itemId: r.itemId, kind: 'kept', unitId: s, conflict }
      : { itemId: r.itemId, kind: 'displaced', conflict };
  });
}
