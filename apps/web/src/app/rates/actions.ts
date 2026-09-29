'use server';
import { revalidatePath } from 'next/cache';
import { parseCancellationPenalty } from '@pms/domain';
import { ApiError, ratesApi, type RateChangeInput, type RatePlanRow } from '../../lib/api';

export interface RatesActionResult {
  error: string | null;
  applied?: number;
  /** Сколько значений встало в очередь каналов; 0 — категория или тариф не сопоставлены */
  queued?: number;
}

/** Массовое изменение цен/ограничений: одна транзакция в API, одно сообщение в канал. */
export async function bulkRatesAction(changes: RateChangeInput[]): Promise<RatesActionResult> {
  try {
    const r = await ratesApi.bulk(changes);
    revalidatePath('/rates');
    return { error: null, applied: r.applied, queued: r.queued };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e),
    };
  }
}

export interface RatePlanActionResult {
  error: string | null;
  saved?: RatePlanRow;
}

/**
 * Правило отмены тарифа (SET4, «Тарифные планы»): правка идёт в API, он пишет журнал; правило действует для всех
 * броней тарифа — так решил владелец 29.09. Ошибка API — словами в панели, выбор остаётся.
 */
export async function saveRatePlanPenalty(
  _prev: RatePlanActionResult | null,
  form: FormData,
): Promise<RatePlanActionResult> {
  const code = String(form.get('code') ?? '');
  const penalty = parseCancellationPenalty(form.get('cancellationPenalty'));
  if (!penalty) return { error: 'Выберите правило отмены' };
  try {
    const saved = await ratesApi.updatePlan(code, { cancellationPenalty: penalty });
    revalidatePath('/rates/plans');
    return { error: null, saved };
  } catch (e) {
    return { error: e instanceof ApiError || e instanceof Error ? e.message : String(e) };
  }
}
