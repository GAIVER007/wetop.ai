import { findMarkdownTable } from '@pms/shared';
import { ExelyImportError } from './errors';
import { toMinorUnits } from './normalize-reservation';

/** Услуга из справочника Exely (spravochniki.md §8). Кода у услуг в Exely нет — кодом служит название. */
export interface ExelyService {
  name: string;
  /** integer minor units (тиын), ADR-008 */
  priceMinor: bigint;
  group: string | null;
}

const HEADING = /^##\s+\d*\.?\s*Услуги/m;

export function parseExelyServices(markdown: string): ExelyService[] {
  const table = findMarkdownTable(markdown, HEADING);
  if (table === undefined)
    throw new ExelyImportError('В справочнике нет таблицы под заголовком «Услуги»');
  return table.rows.map((row) => {
    const name = (row['Услуга'] ?? '').trim();
    if (!name) throw new ExelyImportError('Услуга без названия в справочнике');
    const priceRaw = (row['Цена'] ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(priceRaw))
      throw new ExelyImportError(`Услуга «${name}»: цена «${row['Цена'] ?? ''}» не число`);
    const group = (row['Группа'] ?? '').trim();
    return {
      name,
      priceMinor: toMinorUnits(Number(priceRaw), `Услуга «${name}»`),
      group: group && group !== '—' ? group : null,
    };
  });
}
