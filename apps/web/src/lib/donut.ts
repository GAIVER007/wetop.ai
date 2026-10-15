/**
 * Доли для кольца `DonutShare` (RPT2.2c-3, DESIGN.md §8.2). Деньги и их доли считаются целыми числами (ADR-008):
 * сумма делится в промилле методом наибольших остатков, итог всегда ровно 1000. Float остаётся только у геометрии дуг.
 */
export interface DonutItem {
  label: string;
  /** Минорные единицы строкой; ноль и минус в кольцо не попадают */
  valueMinor: string;
}
export interface DonutSlice {
  label: string;
  valueMinor: string;
  permille: number;
  startPermille: number;
  /** Свёрнутый хвост «Прочие» */
  other?: true;
}

export function donutSlices(items: DonutItem[], max = 5): DonutSlice[] {
  const positive = items
    .map((it, i) => ({ ...it, v: BigInt(it.valueMinor), i }))
    .filter((it) => it.v > 0n)
    .sort((a, b) => (a.v === b.v ? a.i - b.i : a.v > b.v ? -1 : 1));
  if (positive.length === 0) return [];
  const head = positive.length > max ? positive.slice(0, max - 1) : positive;
  const tail = positive.length > max ? positive.slice(max - 1) : [];
  const rows: Array<{ label: string; v: bigint; other?: true }> = head.map((h) => ({
    label: h.label,
    v: h.v,
  }));
  if (tail.length)
    rows.push({ label: 'Прочие', v: tail.reduce((n, t) => n + t.v, 0n), other: true });
  const total = rows.reduce((n, r) => n + r.v, 0n);
  const base = rows.map((r) => ({ floor: (r.v * 1000n) / total, rest: (r.v * 1000n) % total }));
  let left = 1000 - base.reduce((n, b) => n + Number(b.floor), 0);
  const order = base
    .map((b, i) => ({ i, rest: b.rest }))
    .sort((a, b) => (a.rest === b.rest ? a.i - b.i : a.rest > b.rest ? -1 : 1));
  const permille = base.map((b) => Number(b.floor));
  for (const o of order) {
    if (left <= 0) break;
    permille[o.i] = (permille[o.i] ?? 0) + 1;
    left -= 1;
  }
  let start = 0;
  return rows.map((r, i) => {
    const p = permille[i] ?? 0;
    const slice: DonutSlice = {
      label: r.label,
      valueMinor: r.v.toString(),
      permille: p,
      startPermille: start,
      ...(r.other ? { other: true as const } : {}),
    };
    start += p;
    return slice;
  });
}
