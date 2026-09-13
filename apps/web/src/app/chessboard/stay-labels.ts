import type { ChessboardCell } from '../../lib/api';

/** Линейный проход: подпись на каждом видимом отрезке, включая проживание до начала окна. */
export function stayLabels(
  cells: ChessboardCell[],
): Array<{ index: number; span: number; continues: boolean }> {
  const labels: Array<{ index: number; span: number; continues: boolean }> = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (cell.state !== 'OCCUPIED' || !cell.itemId) continue;
    const index = i;
    while (
      i + 1 < cells.length &&
      cells[i + 1]!.state === 'OCCUPIED' &&
      cells[i + 1]!.itemId === cell.itemId &&
      cells[i + 1]!.itemStatus === cell.itemStatus
    )
      i++;
    labels.push({ index, span: i - index + 1, continues: !cell.isArrival });
  }
  return labels;
}
