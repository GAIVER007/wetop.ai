import type { AccommodationKind } from '@pms/domain';
import { findMarkdownTable } from '@pms/shared';
import { ExelyImportError } from './errors';

export interface ExelyAccommodationType {
  exelyId: string;
  name: string;
  shortName: string;
  kind: AccommodationKind;
  /** Максимум взрослых: «1 или 2» → 2 */
  capacityAdults: number;
  extraBeds: number;
  childrenWithoutBed: number;
  active: boolean;
}

const HEADING = /^##\s+\d*\.?\s*Категории размещения/m;

function parseTypeKind(raw: string, id: string): AccommodationKind {
  const v = raw.trim().toLowerCase();
  if (v === 'номер') return 'PRIVATE_ROOM';
  if (v === 'койко-место') return 'DORM_BED';
  throw new ExelyImportError(`Категория ${id}: неизвестный тип «${raw}»`);
}

/** «1», «1 или 2», «2» → максимум. Пусто/не число — ошибка. */
function parseMaxAdults(raw: string, id: string): number {
  const nums = (raw.match(/\d+/g) ?? []).map(Number);
  if (nums.length === 0)
    throw new ExelyImportError(`Категория ${id}: не разобрать «Взрослых» = «${raw}»`);
  return Math.max(...nums);
}

function parseInt0(raw: string, id: string, field: string): number {
  const v = raw.trim();
  if (!/^\d+$/.test(v))
    throw new ExelyImportError(`Категория ${id}: поле «${field}» = «${raw}» не целое`);
  return Number(v);
}

export function parseExelyAccommodationTypes(markdown: string): ExelyAccommodationType[] {
  const table = findMarkdownTable(markdown, HEADING);
  if (table === undefined) {
    throw new ExelyImportError('В справочнике нет таблицы под заголовком «Категории размещения»');
  }
  return table.rows.map((row) => {
    const exelyId = (row['ID Exely'] ?? '').trim();
    if (!/^\d+$/.test(exelyId))
      throw new ExelyImportError(`Категория с некорректным ID Exely: «${exelyId}»`);
    return {
      exelyId,
      name: (row['Название'] ?? '').trim(),
      shortName: (row['Короткое имя'] ?? '').trim(),
      kind: parseTypeKind(row['Тип'] ?? '', exelyId),
      capacityAdults: parseMaxAdults(row['Взрослых'] ?? '', exelyId),
      extraBeds: parseInt0(row['Доп. места'] ?? '', exelyId, 'Доп. места'),
      childrenWithoutBed: parseInt0(row['Детей без места'] ?? '', exelyId, 'Детей без места'),
      active: (row['Активна'] ?? '').trim().toLowerCase() === 'да',
    };
  });
}
