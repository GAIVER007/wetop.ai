/**
 * Рассадка проживаний из Exely за один импорт (сквозная проверка 14.09.2026: 13 проживаний на шахматке PMS стояли
 * не на тех койках, что в Exely). Exely меняет гостей местами — A 43 → 46, B 46 → 43 — и цепочками, а цепочки
 * упираются в переезды внутри срока: Exely хранит одну комнату на весь срок, даже если гость переехал посреди него.
 *
 * Пачка планируется целиком, по ночам, и никто не становится хуже, чем был:
 *  1) каждое проживание начинает со своих нынешних ячеек (своя категория, свободны на эти даты);
 *  2) весь срок на место из Exely, как только оно свободно, — повторяется, пока кто-то движется
 *     (цепочки сходятся в любом порядке броней);
 *  3) замкнутый круг — обмен двух или цикл нескольких, где место каждого занято только следующим, — проворачивается
 *     целиком;
 *  4) переезд, который уже был (ADR-044, Q-120): место из Exely занято только в первые ночи и свободно с ночи не позже
 *     сегодняшней — до неё проживание остаётся на своей ячейке, с неё переезжает на место из Exely. Один переезд,
 *     будущий переезд не придумывается;
 *  5) место из Exely занято иначе — проживание остаётся на своей ячейке, сосед по обмену его не выгоняет.
 * Чистая функция, без БД: решения применяет importReservations.
 */

/** Ночи [start, end) на одной ячейке */
export interface Segment {
  unitId: string;
  start: string;
  end: string;
}

export interface SeatRequest {
  itemId: string;
  typeId: string;
  /** Ячейка, которую назначил Exely */
  desiredUnitId: string;
  /** Первая ночь, YYYY-MM-DD */
  start: string;
  /** Дата выезда (ночь не включается), YYYY-MM-DD */
  end: string;
  /** Нынешние назначения проживания в PMS; пусто — без ячейки */
  current: Array<Segment & { typeId: string }>;
}

/** Назначение, с которым столкнулось проживание: чужое или соседа по пачке */
export interface SeatOccupancy {
  unitId: string;
  itemId: string;
  start: string;
  end: string;
}

export type SeatDecision =
  /** Место из Exely на весь срок */
  | { itemId: string; kind: 'desired'; segments: Segment[] }
  /** Переезд уже был: до ночи переезда — своя ячейка, с неё — место из Exely */
  | { itemId: string; kind: 'moved'; segments: Segment[]; conflict: SeatOccupancy }
  /** Место из Exely занято — проживание остаётся на своих ячейках */
  | { itemId: string; kind: 'kept'; segments: Segment[]; conflict: SeatOccupancy }
  /**
   * Своей ячейки нет или она больше не годится — ячейки ищет отдельный проход после импорта.
   * exelyFrom — переезд уже был: с этой ночи до конца срока место из Exely свободно.
   */
  | { itemId: string; kind: 'displaced'; conflict: SeatOccupancy; exelyFrom: string | null };

const DAY = 86_400_000;
const shift = (d: string, days: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export function planSeats(
  requests: readonly SeatRequest[],
  occupied: readonly SeatOccupancy[],
  /** Сегодняшняя ночь объекта (Алматы), YYYY-MM-DD */
  today: string,
): SeatDecision[] {
  const place = new Map<string, Segment[] | null>();
  const whole = (r: SeatRequest, unitId: string): Segment[] => [{ unitId, start: r.start, end: r.end }];
  const wholeOn = (p: Segment[] | null | undefined, r: SeatRequest, unitId: string) =>
    p?.length === 1 && p[0]!.unitId === unitId && p[0]!.start === r.start && p[0]!.end === r.end;
  const same = (a: Segment[], b: Segment[]) =>
    a.length === b.length && a.every((s, i) => s.unitId === b[i]!.unitId && s.start === b[i]!.start && s.end === b[i]!.end);

  const foreignOn = (unitId: string, from: string, to: string, r: SeatRequest) =>
    occupied.find((o) => o.unitId === unitId && o.itemId !== r.itemId && o.start < to && from < o.end);
  const batchOn = (unitId: string, from: string, to: string, r: SeatRequest): SeatOccupancy[] =>
    requests.flatMap((q) =>
      q.itemId === r.itemId
        ? []
        : (place.get(q.itemId) ?? [])
            .filter((s) => s.unitId === unitId && s.start < to && from < s.end)
            .map((s) => ({ unitId, itemId: q.itemId, start: s.start, end: s.end })),
    );
  const segmentFree = (unitId: string, from: string, to: string, r: SeatRequest) =>
    !foreignOn(unitId, from, to, r) && batchOn(unitId, from, to, r).length === 0;
  const fits = (segments: Segment[], r: SeatRequest) =>
    segments.every((s) => segmentFree(s.unitId, s.start, s.end, r));
  /** Первая ночь, с которой место из Exely свободно до конца срока; null — занято в последнюю ночь */
  const exelyFreeFrom = (r: SeatRequest) => {
    let from: string | null = null;
    for (let night = shift(r.end, -1); night >= r.start; night = shift(night, -1)) {
      if (!segmentFree(r.desiredUnitId, night, shift(night, 1), r)) break;
      from = night;
    }
    return from;
  };

  // Сначала те, у кого место из Exely уже есть среди ячеек: при двойной продаже койки место остаётся за тем, кто на ней
  // стоит, а не за тем, чья бронь пришла первой, — иначе гость прыгал бы между койками от прогона к прогону
  const holdsExely = (r: SeatRequest) => r.current.some((s) => s.unitId === r.desiredUnitId);
  const ordered = [...requests.filter(holdsExely), ...requests.filter((r) => !holdsExely(r))];

  // 1) нынешние ячейки: своя категория (или уже место из Exely), свободны на эти даты. Даты проживания изменились —
  //    годится только одна ячейка на весь новый срок, как и раньше
  for (const r of ordered) {
    const cur = [...r.current].sort((a, b) => (a.start < b.start ? -1 : 1));
    let p: Segment[] | null = null;
    if (cur.length > 0 && cur.every((s) => s.unitId === r.desiredUnitId || s.typeId === r.typeId)) {
      const covers =
        cur[0]!.start === r.start &&
        cur.at(-1)!.end === r.end &&
        cur.every((s, i) => i === 0 || cur[i - 1]!.end === s.start);
      if (covers) p = cur.map(({ unitId, start, end }) => ({ unitId, start, end }));
      else if (new Set(cur.map((s) => s.unitId)).size === 1) p = whole(r, cur[0]!.unitId);
    }
    place.set(r.itemId, p && fits(p, r) ? p : null);
  }

  /**
   * Неподвижная занятость ячейки соседом по пачке: сосед уже на своём месте из Exely (эти ночи он не отдаст —
   * ночей на месте из Exely у проживания только прибавляется) или ночи до его переезда (прошедшие, их не переиграть).
   * Сосед на чужом месте неподвижным не считается: он ещё может уйти на своё.
   */
  const settledOn = (unitId: string, from: string, to: string, r: SeatRequest) =>
    requests.some((q) => {
      if (q.itemId === r.itemId) return false;
      const p = place.get(q.itemId);
      if (!p) return false;
      const moved = p.length === 2 && p[1]!.unitId === q.desiredUnitId && p[1]!.end === q.end;
      return p.some(
        (seg, i) =>
          seg.unitId === unitId &&
          seg.start < to &&
          from < seg.end &&
          (seg.unitId === q.desiredUnitId || (moved && i === 0)),
      );
    });

  /**
   * Цель проживания при нынешней рассадке: весь срок на месте из Exely, если на нём нет неподвижной занятости; иначе
   * переезд, который уже был, — место из Exely свободно от неё с ночи не позже сегодняшней, до неё ячейка первой ночи.
   * null — цели нет (переезд был бы в будущем, место из Exely занято в последнюю ночь, своей ячейки нет).
   */
  const target = (r: SeatRequest, history: readonly SeatOccupancy[] = []): Segment[] | null => {
    let from: string | null = null;
    for (let night = shift(r.end, -1); night >= r.start; night = shift(night, -1)) {
      const to = shift(night, 1);
      const past = history.some(
        (h) => h.itemId !== r.itemId && h.unitId === r.desiredUnitId && h.start < to && night < h.end,
      );
      if (past || foreignOn(r.desiredUnitId, night, to, r) || settledOn(r.desiredUnitId, night, to, r)) break;
      from = night;
    }
    if (!from) return null;
    if (from === r.start) return whole(r, r.desiredUnitId);
    const p = place.get(r.itemId);
    const first = p?.find((seg) => seg.start <= r.start && r.start < seg.end);
    if (from > today || !first || first.unitId === r.desiredUnitId) return null;
    return [
      { unitId: first.unitId, start: r.start, end: from },
      { unitId: r.desiredUnitId, start: from, end: r.end },
    ];
  };

  for (let moved = true; moved; ) {
    moved = false;
    // 2) к цели, если она свободна от соседей по пачке, — повторяется, пока кто-то движется
    for (const r of ordered) {
      const t = target(r);
      const p = place.get(r.itemId);
      if (!t || (p && same(t, p)) || !fits(t, r)) continue;
      place.set(r.itemId, t);
      moved = true;
    }
    if (moved) continue;

    // 3) замкнутая группа: цели участников заняты только участниками и между собой не пересекаются — все переходят
    //    к целям разом (обмен, цикл, «место освобождают двое соседей в разные ночи»)
    let goal = new Map<string, Segment[]>();
    for (const r of ordered) {
      const p = place.get(r.itemId);
      const t = target(r);
      if (p && t && !same(t, p)) goal.set(r.itemId, t);
    }
    // цели видят ночи до переезда соседей, которые переезжают в той же группе: они станут историей одновременно
    for (let round = 0; round < requests.length + 1; round++) {
      const history = [...goal].flatMap(([id, t]) => (t.length === 2 ? [{ ...t[0]!, itemId: id }] : []));
      const next = new Map<string, Segment[]>();
      for (const r of ordered) {
        if (!goal.has(r.itemId)) continue;
        const t = target(r, history);
        if (t && !same(t, place.get(r.itemId)!)) next.set(r.itemId, t);
      }
      const stable = next.size === goal.size && [...next].every(([id, t]) => same(t, goal.get(id)!));
      goal = next;
      if (stable) break;
    }
    const rank = new Map(ordered.map((r, i) => [r.itemId, i]));
    const byId = new Map(requests.map((r) => [r.itemId, r]));
    for (let shrunk = true; shrunk && goal.size > 0; ) {
      shrunk = false;
      for (const [id, t] of goal) {
        const r = byId.get(id)!;
        if (t.some((seg) => batchOn(seg.unitId, seg.start, seg.end, r).some((o) => !goal.has(o.itemId)))) {
          goal.delete(id);
          shrunk = true;
        }
      }
      if (shrunk) continue;
      const entries = [...goal];
      search: for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++) {
          const [a, ta] = entries[i]!;
          const [b, tb] = entries[j]!;
          for (const [ka, sa] of ta.entries())
            for (const [kb, sb] of tb.entries()) {
              if (sa.unitId !== sb.unitId || !(sa.start < sb.end && sb.start < sa.end)) continue;
              // ночи до переезда, который уже был, — история: уступает другой; иначе — тот, кто ниже в очереди
              const aHistory = ta.length === 2 && ka === 0;
              const bHistory = tb.length === 2 && kb === 0;
              const yields = aHistory !== bHistory ? (aHistory ? b : a) : rank.get(a)! > rank.get(b)! ? a : b;
              goal.delete(yields);
              shrunk = true;
              break search;
            }
        }
    }
    if (goal.size > 0) {
      for (const [id, t] of goal) place.set(id, t);
      moved = true;
    }
  }

  return requests.map((r): SeatDecision => {
    const p = place.get(r.itemId) ?? null;
    if (wholeOn(p, r, r.desiredUnitId)) return { itemId: r.itemId, kind: 'desired', segments: p! };
    const conflict =
      foreignOn(r.desiredUnitId, r.start, r.end, r) ?? batchOn(r.desiredUnitId, r.start, r.end, r)[0];
    // место из Exely свободно на весь срок, но проживание не на нём — так закончиться не может: шаг 2 его бы пересадил
    if (!conflict) throw new Error(`рассадка: проживание ${r.itemId} не на свободном месте из Exely`);
    if (p) {
      const onExelyAfterMove = p.length === 2 && p[1]!.unitId === r.desiredUnitId && p[1]!.end === r.end;
      return onExelyAfterMove
        ? { itemId: r.itemId, kind: 'moved', segments: p, conflict }
        : { itemId: r.itemId, kind: 'kept', segments: p, conflict };
    }
    const from = exelyFreeFrom(r);
    return {
      itemId: r.itemId,
      kind: 'displaced',
      conflict,
      exelyFrom: from && from !== r.start && from <= today ? from : null,
    };
  });
}
