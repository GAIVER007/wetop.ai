/** Соседние полугодия словами: «← 2-е полугодие 2025», а не безликое «Следующее полугодие» (аудит 22.10.2026 P2-8) */
export function halfLinks(year: number, half: 1 | 2) {
  const link = (y: number, h: 1 | 2) => ({ href: `/reports/form-910?year=${y}&half=${h}`, y, h });
  const p = half === 1 ? link(year - 1, 2) : link(year, 1);
  const n = half === 1 ? link(year, 2) : link(year + 1, 1);
  return {
    prev: { href: p.href, label: `← ${p.h}-е полугодие ${p.y}` },
    next: { href: n.href, label: `${n.h}-е полугодие ${n.y} →` },
  };
}
