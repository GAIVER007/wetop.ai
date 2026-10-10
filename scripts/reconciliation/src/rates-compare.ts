/** Сверка календаря цен: PMS (`daily_rates`) против снимка Exely. Допустимое расхождение — 0 строк. */
export interface RateRow {
  date: string;
  ratePlanExelyId: string;
  accommodationTypeExelyId: string;
  occupancy: number;
  priceMinor: bigint;
}
export interface RateGroupResult {
  ratePlanExelyId: string;
  accommodationTypeExelyId: string;
  occupancy: number;
  exely: number;
  pms: number;
  matched: number;
  priceDiff: number;
  missingInPms: number;
  extraInPms: number;
}
export interface RateSample {
  kind: 'priceDiff' | 'missingInPms' | 'extraInPms';
  date: string;
  ratePlanExelyId: string;
  accommodationTypeExelyId: string;
  occupancy: number;
  exely: bigint | null;
  pms: bigint | null;
}
export interface RatesComparison {
  ok: boolean;
  totals: {
    exely: number;
    pms: number;
    matched: number;
    priceDiff: number;
    missingInPms: number;
    extraInPms: number;
  };
  byTariff: RateGroupResult[];
  samples: RateSample[];
}

const groupKey = (r: Pick<RateRow, 'ratePlanExelyId' | 'accommodationTypeExelyId' | 'occupancy'>) =>
  `${r.ratePlanExelyId}|${r.accommodationTypeExelyId}|${r.occupancy}`;
const rowKey = (r: RateRow) => `${groupKey(r)}|${r.date}`;

export function compareRates(input: { exely: RateRow[]; pms: RateRow[] }): RatesComparison {
  const groups = new Map<string, RateGroupResult>();
  const group = (r: RateRow): RateGroupResult => {
    const k = groupKey(r);
    let g = groups.get(k);
    if (!g) {
      g = {
        ratePlanExelyId: r.ratePlanExelyId,
        accommodationTypeExelyId: r.accommodationTypeExelyId,
        occupancy: r.occupancy,
        exely: 0,
        pms: 0,
        matched: 0,
        priceDiff: 0,
        missingInPms: 0,
        extraInPms: 0,
      };
      groups.set(k, g);
    }
    return g;
  };
  const pmsByKey = new Map(input.pms.map((r) => [rowKey(r), r]));
  const seen = new Set<string>();
  const samples: RateSample[] = [];
  const sample = (
    kind: RateSample['kind'],
    r: RateRow,
    exely: bigint | null,
    pms: bigint | null,
  ) => {
    if (samples.length < 50)
      samples.push({
        kind,
        date: r.date,
        ratePlanExelyId: r.ratePlanExelyId,
        accommodationTypeExelyId: r.accommodationTypeExelyId,
        occupancy: r.occupancy,
        exely,
        pms,
      });
  };
  for (const e of input.exely) {
    const g = group(e);
    g.exely += 1;
    const k = rowKey(e);
    const p = pmsByKey.get(k);
    if (!p) {
      g.missingInPms += 1;
      sample('missingInPms', e, e.priceMinor, null);
      continue;
    }
    seen.add(k);
    if (p.priceMinor === e.priceMinor) g.matched += 1;
    else {
      g.priceDiff += 1;
      sample('priceDiff', e, e.priceMinor, p.priceMinor);
    }
  }
  for (const p of input.pms) {
    const g = group(p);
    g.pms += 1;
    if (!seen.has(rowKey(p))) {
      g.extraInPms += 1;
      sample('extraInPms', p, null, p.priceMinor);
    }
  }
  const byTariff = [...groups.values()].sort((a, b) =>
    groupKey(a) < groupKey(b) ? -1 : groupKey(a) > groupKey(b) ? 1 : 0,
  );
  const totals = byTariff.reduce(
    (t, g) => ({
      exely: t.exely + g.exely,
      pms: t.pms + g.pms,
      matched: t.matched + g.matched,
      priceDiff: t.priceDiff + g.priceDiff,
      missingInPms: t.missingInPms + g.missingInPms,
      extraInPms: t.extraInPms + g.extraInPms,
    }),
    { exely: 0, pms: 0, matched: 0, priceDiff: 0, missingInPms: 0, extraInPms: 0 },
  );
  return {
    ok: totals.priceDiff === 0 && totals.missingInPms === 0 && totals.extraInPms === 0,
    totals,
    byTariff,
    samples,
  };
}

export interface RatesReportContext {
  controlDate: string;
  period: { from: string; to: string };
  names: { ratePlans: Record<string, string>; accommodationTypes: Record<string, string> };
  restrictions?: { exely: number; pms: number };
}

export function renderRatesReport(cmp: RatesComparison, ctx: RatesReportContext): string {
  const rp = (id: string) => ctx.names.ratePlans[id] ?? id;
  const at = (id: string) => ctx.names.accommodationTypes[id] ?? id;
  const lines: string[] = [
    `# Rates reconciliation — Gate 3 (цены)`,
    ``,
    `CONTROL DATE: ${ctx.controlDate}`,
    `PERIOD: ${ctx.period.from} → ${ctx.period.to}`,
    ``,
    `Источник EXELY: снимок календаря цен (\`project-input/exely/prices/\`). Допуск: 0 строк.`,
    ``,
    `## TOTALS`,
    ``,
    `| Metric | Value |`,
    `|---|---:|`,
    `| rows in EXELY | ${cmp.totals.exely} |`,
    `| rows in PMS | ${cmp.totals.pms} |`,
    `| matched (same price) | ${cmp.totals.matched} |`,
    `| price differs | ${cmp.totals.priceDiff} |`,
    `| missing in PMS | ${cmp.totals.missingInPms} |`,
    `| extra in PMS | ${cmp.totals.extraInPms} |`,
  ];
  if (ctx.restrictions)
    lines.push(
      `| restrictions EXELY / PMS | ${ctx.restrictions.exely} / ${ctx.restrictions.pms} |`,
    );
  lines.push(
    ``,
    `## BY TARIFF × CATEGORY × OCCUPANCY`,
    ``,
    `| Tariff | Category | Occ | EXELY | PMS | matched | diff | missing | extra |`,
    `|---|---|---:|---:|---:|---:|---:|---:|---:|`,
  );
  for (const g of cmp.byTariff)
    lines.push(
      `| ${rp(g.ratePlanExelyId)} | ${at(g.accommodationTypeExelyId)} | ${g.occupancy} | ${g.exely} | ${g.pms} | ${g.matched} | ${g.priceDiff} | ${g.missingInPms} | ${g.extraInPms} |`,
    );
  if (cmp.samples.length) {
    lines.push(
      ``,
      `## SAMPLES (first ${cmp.samples.length})`,
      ``,
      `| kind | date | tariff | category | occ | EXELY | PMS |`,
      `|---|---|---|---|---:|---:|---:|`,
    );
    for (const s of cmp.samples)
      lines.push(
        `| ${s.kind} | ${s.date} | ${rp(s.ratePlanExelyId)} | ${at(s.accommodationTypeExelyId)} | ${s.occupancy} | ${s.exely ?? '—'} | ${s.pms ?? '—'} |`,
      );
  }
  const restrOk = !ctx.restrictions || ctx.restrictions.exely === ctx.restrictions.pms;
  lines.push(
    ``,
    `RESULT: ${cmp.ok && restrOk ? 'OK — расхождение 0 по всем строкам' : 'FAIL — есть расхождения'}`,
    ``,
  );
  return lines.join('\n');
}
