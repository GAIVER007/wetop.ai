'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, ratesApi, type RateChangeInput } from '../../lib/api';

export interface RatesActionResult {
  error: string | null;
  applied?: number;
  /** Сколько изменений действительно встало в очередь каналов: не всё, что сохранено, туда идёт */
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
