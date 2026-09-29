import type { CancellationPenaltyPolicy } from '@pms/domain';
import type { CancelPreview } from './api';
import { formatMoney } from './money';

/**
 * Правило отмены тарифа словами (`RatePlan.cancellationPenalty`, Q-103). Живёт на вкладке «Тарифные планы» (SET4):
 * правило — свойство тарифного плана, из «Настроек объекта» оно ушло (ADR-115). Штраф берётся только при отмене
 * в день заезда и позже и при незаезде (`penaltyDue`) — подсказки говорят именно это.
 */
export const cancellationRuleOptions: ReadonlyArray<{
  value: CancellationPenaltyPolicy;
  label: string;
  hint: string;
}> = [
  { value: 'NONE', label: 'Без штрафа', hint: 'Отмена и незаезд бесплатны' },
  {
    value: 'FIRST_NIGHT',
    label: 'Стоимость первой ночи',
    hint: 'При отмене в день заезда и при незаезде на счёте остаётся цена первой ночи',
  },
  {
    value: 'FULL_STAY',
    label: 'Стоимость всего проживания',
    hint: 'При отмене в день заезда и при незаезде на счёте остаётся вся сумма проживания',
  },
];
export const cancellationRuleLabel = (policy: string): string =>
  cancellationRuleOptions.find((o) => o.value === policy)?.label ?? policy;

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
