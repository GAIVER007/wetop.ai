import type { CancelPreview } from './api';
import { formatMoney } from './money';

/**
 * Правило отмены тарифа словами (`RatePlan.cancellationPenalty`, Q-103). Показывается на «Ценах» у выбранного
 * тарифа: правило — свойство тарифного плана, из «Настроек объекта» оно ушло (ADR-107).
 */
export const cancellationRuleText: Record<string, string> = {
  NONE: 'без штрафа',
  FIRST_NIGHT: 'стоимость первой ночи',
  FULL_STAY: 'стоимость всего проживания',
};

/**
 * Слово о штрафе для окна подтверждения (DESIGN.md §8, Д5): сумму считает сервер тем же кодом, что и
 * начисление; здесь — только формулировка. `undefined` — предпросмотр ещё идёт, `null` — не загрузился.
 */
export function penaltyText(
  preview: CancelPreview | null | undefined,
  reason: 'cancel' | 'no_show',
  currency = 'KZT',
): string {
  if (preview === undefined) return 'Считаю штраф…';
  if (preview === null)
    return `Сумма штрафа не загрузилась — проверьте счёт после ${reason === 'no_show' ? 'незаезда' : 'отмены'}.`;
  const total = BigInt(preview.totalPenaltyMinor);
  if (total > 0n) return `Штраф ${formatMoney(total, currency)} останется на счёте`;
  if (preview.items.length && preview.items.every((i) => i.policy === 'NONE'))
    return 'Штраф не начисляется: тариф без штрафа';
  if (reason === 'cancel' && preview.items.some((i) => !i.dueNow))
    return 'Штраф не начисляется: отмена до дня заезда';
  return 'Штраф не начисляется';
}
