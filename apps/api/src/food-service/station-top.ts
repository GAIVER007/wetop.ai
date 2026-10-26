export type SoldLine = { station: 'KITCHEN' | 'BAR'; name: string; qty: number; price: bigint };
export type TopLine = { name: string; qty: number; revenueMinor: string };
export function topByStation(lines: SoldLine[]): { KITCHEN: TopLine[]; BAR: TopLine[] } {
  const ranked: {
    KITCHEN: Map<string, { qty: number; revenue: bigint }>;
    BAR: Map<string, { qty: number; revenue: bigint }>;
  } = { KITCHEN: new Map(), BAR: new Map() };
  for (const line of lines) {
    const existing = ranked[line.station].get(line.name) ?? { qty: 0, revenue: 0n };
    existing.qty += line.qty;
    existing.revenue += line.price * BigInt(line.qty);
    ranked[line.station].set(line.name, existing);
  }
  const list = (station: 'KITCHEN' | 'BAR'): TopLine[] =>
    [...ranked[station]]
      .map(([name, value]) => ({ name, qty: value.qty, revenueMinor: value.revenue.toString() }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'))
      .slice(0, 3);
  return { KITCHEN: list('KITCHEN'), BAR: list('BAR') };
}
