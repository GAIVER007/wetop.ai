import type { HousekeepingStatus } from '../chessboard/build';

/**
 * Цикл уборки ячейки (22.09.2026, поручение владельца по снимку шахматки: «требует уборки → убрано →
 * проверено → после проверено номер становится доступным»).
 *
 * Статусы модели прежние (DATA_MODEL §4: DIRTY | CLEAN | INSPECTED), новое — порядок. Вперёд только по
 * одному шагу: из «требует уборки» — в «убрано», из «убрано» — в «проверено». «Проверено» — конец цикла:
 * ячейка доступна, значка в строке шахматки у неё нет. Назад — только в «требует уборки», с любого шага
 * (ячейку испачкали, проверка не прошла). Перепрыгнуть проверку нельзя — иначе «проверено» ничего не значит.
 *
 * «Доступна» здесь — слово о готовности ячейки к гостю, а не availability для каналов и не запрет
 * заселения: DATA_MODEL §4 предупреждает, что блокировка заселения по уборке «в лоб» парализует смену
 * (вопрос владельцу — Q-156).
 */
export const HOUSEKEEPING_FLOW: readonly HousekeepingStatus[] = ['DIRTY', 'CLEAN', 'INSPECTED'];

/** Статус словами стойки: что с ячейкой делать, а у последнего шага — что она доступна (DESIGN.md §14) */
export const HOUSEKEEPING_RU: Readonly<Record<HousekeepingStatus, string>> = {
  DIRTY: 'требует уборки',
  CLEAN: 'убрано, ждёт проверки',
  INSPECTED: 'проверено, доступна',
};

/** Следующий шаг цикла; у «проверено» его нет — ячейка доступна */
export function nextHousekeepingStatus(from: HousekeepingStatus): HousekeepingStatus | null {
  return HOUSEKEEPING_FLOW[HOUSEKEEPING_FLOW.indexOf(from) + 1] ?? null;
}

/** Куда можно перевести ячейку из текущего статуса: вперёд на шаг, назад — в «требует уборки» */
export function housekeepingTargets(from: HousekeepingStatus): HousekeepingStatus[] {
  const next = nextHousekeepingStatus(from);
  const targets: HousekeepingStatus[] = next ? [next] : [];
  if (from !== 'DIRTY') targets.push('DIRTY');
  return targets;
}

/** Почему переход невозможен — словами для стойки; null, если переход разрешён или статус тот же */
export function housekeepingRefusal(
  from: HousekeepingStatus,
  to: HousekeepingStatus,
): string | null {
  if (from === to || housekeepingTargets(from).includes(to)) return null;
  if (from === 'DIRTY' && to === 'INSPECTED')
    return 'Ячейка требует уборки: сначала «Убрано», потом «Проверено»';
  if (from === 'INSPECTED' && to === 'CLEAN')
    return 'Ячейка уже проверена и доступна; если её испачкали — «Требует уборки»';
  return `Из «${HOUSEKEEPING_RU[from]}» нельзя перевести в «${HOUSEKEEPING_RU[to]}»`;
}
