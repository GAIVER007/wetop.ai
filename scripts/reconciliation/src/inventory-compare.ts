import type { InventorySummary } from '@pms/domain';

export interface CompareRow {
  section: 'TOTALS' | 'BY ACCOMMODATION TYPE';
  label: string;
  pms: number;
  exely: number;
  diff: number;
}

export interface InventoryComparison {
  ok: boolean;
  rows: CompareRow[];
}

export interface CompareInput {
  pms: InventorySummary;
  exely: InventorySummary;
  blocksInPms: number;
  blocksInExely: number;
}

/** PMS против Exely по каждой контрольной строке Gate 1. Допустимое расхождение — 0. */
export function compareInventory(input: CompareInput): InventoryComparison {
  const row = (
    section: CompareRow['section'],
    label: string,
    pms: number,
    exely: number,
  ): CompareRow => ({
    section,
    label,
    pms,
    exely,
    diff: pms - exely,
  });
  const rows: CompareRow[] = [
    row('TOTALS', 'units total', input.pms.totalUnits, input.exely.totalUnits),
    row('TOTALS', 'rooms', input.pms.rooms, input.exely.rooms),
    row('TOTALS', 'beds', input.pms.beds, input.exely.beds),
    row('TOTALS', 'max guests', input.pms.maxGuests, input.exely.maxGuests),
    row('TOTALS', 'physical rooms', input.pms.physicalRooms, input.exely.physicalRooms),
    row('TOTALS', 'blocked', input.blocksInPms, input.blocksInExely),
  ];
  const codes = new Set<string>([
    ...input.exely.byCategory.map((c) => c.code),
    ...input.pms.byCategory.map((c) => c.code),
  ]);
  for (const code of codes) {
    const e = input.exely.byCategory.find((c) => c.code === code);
    const p = input.pms.byCategory.find((c) => c.code === code);
    rows.push(row('BY ACCOMMODATION TYPE', (e ?? p)?.name ?? code, p?.units ?? 0, e?.units ?? 0));
  }
  return { ok: rows.every((r) => r.diff === 0), rows };
}

export function renderInventoryReport(cmp: InventoryComparison, controlDate: string): string {
  const lines: string[] = [
    `# Inventory reconciliation — Gate 1`,
    ``,
    `CONTROL DATE: ${controlDate}`,
    ``,
    `Источник EXELY: аудит 07.09.2026 (\`project-input/exely/audit-2026-09-07/\`). Допуск: 0.`,
    ``,
  ];
  for (const section of ['TOTALS', 'BY ACCOMMODATION TYPE'] as const) {
    lines.push(`## ${section}`, ``, `| Metric | PMS | EXELY | DIFF |`, `|---|---:|---:|---:|`);
    for (const r of cmp.rows.filter((x) => x.section === section)) {
      lines.push(`| ${r.label} | ${r.pms} | ${r.exely} | ${r.diff} |`);
    }
    lines.push(``);
  }
  lines.push(
    `RESULT: ${cmp.ok ? 'OK — расхождение 0 по всем строкам' : 'FAIL — есть расхождения'}`,
    ``,
  );
  return lines.join('\n');
}
