import type { CancellationPenaltyPolicy } from '@pms/domain';
import type { CancelPreview } from './api';
import { msg, translator, type Translate } from '../i18n';
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
  { value: 'NONE', label: msg('Без штрафа'), hint: msg('Отмена и незаезд бесплатны') },
  {
    value: 'FIRST_NIGHT',
    label: msg('Стоимость первой ночи'),
    hint: msg('При отмене в день заезда и при незаезде на счёте остаётся цена первой ночи'),
  },
  {
    value: 'FULL_STAY',
    label: msg('Стоимость всего проживания'),
    hint: msg('При отмене в день заезда и при незаезде на счёте остаётся вся сумма проживания'),
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
  t: Translate = translator('ru'),
): string {
  if (preview === undefined) return t('Считаю штраф…');
  if (preview === null)
    return reason === 'no_show'
      ? t('Сумма штрафа не загрузилась — проверьте счёт после незаезда.')
      : t('Сумма штрафа не загрузилась — проверьте счёт после отмены.');
  const total = BigInt(preview.totalPenaltyMinor);
  if (total > 0n) return t('Штраф {sum} останется на счёте', { sum: formatMoney(total, currency) });
  if (preview.items.length && preview.items.every((i) => i.policy === 'NONE'))
    return t('Штраф не начисляется: тариф без штрафа');
  if (reason === 'cancel' && preview.items.some((i) => !i.dueNow))
    return t('Штраф не начисляется: отмена до дня заезда');
  return t('Штраф не начисляется');
}
