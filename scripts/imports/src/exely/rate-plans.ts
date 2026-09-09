/**
 * Тарифы из справочника аудита (`spravochniki.md`, раздел «Тарифные планы»). Q-082: до решения владельца
 * тарифы без продаж импортируются с active=false — это умолчание, совпадающее с фактом «не продаются».
 */
import { findMarkdownTable } from '@pms/shared';
import { ExelyImportError } from './errors';

export interface ExelyRatePlanRow {
  exelyId: string;
  name: string;
  enabled: boolean;
  pricePeriod: string;
  channels: string[];
  arrivalsAugust: number;
}
export interface RatePlanImportPlan {
  ratePlans: Array<{
    code: string;
    name: string;
    currency: string;
    active: boolean;
    exelyId: string;
    note: string | null;
  }>;
  links: Array<{ ratePlanCode: string; accommodationTypeCode: string }>;
}
const HEADING = /^##\s+\d*\.?\s*Тарифные планы/m;

export function parseExelyRatePlans(markdown: string): ExelyRatePlanRow[] {
  const table = findMarkdownTable(markdown, HEADING);
  if (!table)
    throw new ExelyImportError('В справочнике нет таблицы под заголовком «Тарифные планы»');
  return table.rows.map((row) => {
    const exelyId = (row['ID'] ?? '').trim();
    if (!/^\d+$/.test(exelyId)) throw new ExelyImportError(`Тариф с некорректным ID: «${exelyId}»`);
    const rawChannels = (row['Каналы'] ?? '').trim();
    const channels =
      /^(нет|—|-)/.test(rawChannels) || rawChannels === ''
        ? []
        : rawChannels
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c && !/^—/.test(c));
    const arrivals = (row['Заездов в августе'] ?? '0').replace(/\D/g, '');
    return {
      exelyId,
      name: (row['Название'] ?? '').trim(),
      enabled: (row['Включён'] ?? '').trim().toLowerCase() === 'да',
      pricePeriod: (row['Цены загружены'] ?? '').trim(),
      channels,
      arrivalsAugust: arrivals === '' ? 0 : Number(arrivals),
    };
  });
}

export function buildRatePlanImportPlan(
  rows: ExelyRatePlanRow[],
  accommodationTypeCodes: string[],
  currency: string,
): RatePlanImportPlan {
  const ratePlans = rows.map((r) => ({
    code: `exely-${r.exelyId}`,
    name: r.name,
    currency,
    active: r.enabled && r.arrivalsAugust > 0,
    exelyId: r.exelyId,
    note: r.channels.length
      ? `Каналы в Exely: ${r.channels.join(', ')}`
      : r.arrivalsAugust === 0
        ? 'Без продаж и без каналов в Exely (Q-082)'
        : null,
  }));
  const links = ratePlans.flatMap((p) =>
    accommodationTypeCodes.map((accommodationTypeCode) => ({
      ratePlanCode: p.code,
      accommodationTypeCode,
    })),
  );
  return { ratePlans, links };
}
