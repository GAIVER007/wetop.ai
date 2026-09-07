import type { InventoryUnitKind } from '@pms/domain';
import { findMarkdownTable } from '@pms/shared';
import { ExelyImportError } from './errors';

export interface ExelyInventoryUnitRow {
  exelyRoomNumber: string;
  categoryName: string;
  kind: InventoryUnitKind;
  capacity: number;
}

export interface ExelyBuildingRow {
  name: string;
  floors: string[];
}

export interface ExelyInventoryExport {
  /** «Всего записей: N» из шапки выгрузки; null, если строки нет */
  declaredTotal: number | null;
  buildings: ExelyBuildingRow[];
  units: ExelyInventoryUnitRow[];
}

const UNITS_HEADING = /^##\s+Единицы продажи/m;
const BUILDINGS_HEADING = /^##\s+Здания и этажи/m;

/** Тип единицы в Exely → kind. Любое другое значение — ошибка, не догадка. */
function parseKind(raw: string, roomNumber: string): InventoryUnitKind {
  const v = raw.trim().toLowerCase();
  if (v === 'номер') return 'ROOM';
  if (v === 'койко-место') return 'BED';
  throw new ExelyImportError(
    `Единица ${roomNumber}: неизвестный тип «${raw}» (ожидается «номер» или «койко-место»)`,
  );
}

function parseCapacity(raw: string, roomNumber: string): number {
  if (!/^\d+$/.test(raw.trim())) {
    throw new ExelyImportError(`Единица ${roomNumber}: вместимость «${raw}» не целое число`);
  }
  const n = Number(raw);
  if (n < 1) throw new ExelyImportError(`Единица ${roomNumber}: вместимость ${n} < 1`);
  return n;
}

export function parseExelyInventory(markdown: string): ExelyInventoryExport {
  const unitsTable = findMarkdownTable(markdown, UNITS_HEADING);
  if (unitsTable === undefined) {
    throw new ExelyImportError('В выгрузке нет таблицы под заголовком «## Единицы продажи»');
  }
  const required = ['№ комнаты в Exely', 'Категория', 'Тип', 'Вместимость'];
  for (const h of required) {
    if (!unitsTable.headers.includes(h)) {
      throw new ExelyImportError(`Таблица «Единицы продажи»: нет колонки «${h}»`);
    }
  }

  const seen = new Set<string>();
  const units = unitsTable.rows.map((row) => {
    const exelyRoomNumber = (row['№ комнаты в Exely'] ?? '').trim();
    if (exelyRoomNumber === '') throw new ExelyImportError('Строка без номера комнаты в Exely');
    if (seen.has(exelyRoomNumber)) {
      throw new ExelyImportError(`Дубль номера единицы в выгрузке: ${exelyRoomNumber}`);
    }
    seen.add(exelyRoomNumber);
    const categoryName = (row['Категория'] ?? '').trim();
    if (categoryName === '')
      throw new ExelyImportError(`Единица ${exelyRoomNumber}: пустая категория`);
    return {
      exelyRoomNumber,
      categoryName,
      kind: parseKind(row['Тип'] ?? '', exelyRoomNumber),
      capacity: parseCapacity(row['Вместимость'] ?? '', exelyRoomNumber),
    };
  });

  const buildingsTable = findMarkdownTable(markdown, BUILDINGS_HEADING);
  const buildings: ExelyBuildingRow[] = (buildingsTable?.rows ?? []).map((row) => ({
    name: (row['Корпус'] ?? '').trim(),
    floors: (row['Этажи'] ?? '')
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f !== ''),
  }));

  const totalMatch = /Всего записей:\s*(\d+)/.exec(markdown);
  const declaredTotal = totalMatch?.[1] !== undefined ? Number(totalMatch[1]) : null;

  return { declaredTotal, buildings, units };
}
