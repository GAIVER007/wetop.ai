'use server';
import { revalidatePath } from 'next/cache';
import { parseCancellationPenalty } from '@pms/domain';
import {
  ApiError,
  ratesApi,
  type PromoCodeRow,
  type RateChangeInput,
  type RatePlanRow,
} from '../../lib/api';

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

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

/** Целое из поля формы: пусто — `null`, не число — `undefined` (ошибка словами у формы) */
function wholeOrNull(form: FormData, key: string): number | null | undefined {
  const raw = String(form.get(key) ?? '').trim();
  if (raw === '') return null;
  return /^\d+$/.test(raw) ? Number(raw) : undefined;
}

export interface DerivedActionResult {
  error: string | null;
  saved?: RatePlanRow;
}

function derivedFields(form: FormData) {
  const discountPercent = wholeOrNull(form, 'discountPercent');
  const minDays = wholeOrNull(form, 'minDaysBeforeArrival');
  const maxDays = wholeOrNull(form, 'maxDaysBeforeArrival');
  const minNights = wholeOrNull(form, 'minNights');
  if (discountPercent === undefined || discountPercent === null)
    return { error: 'Скидка — целое число от 1 до 90 процентов' } as const;
  if (minDays === undefined || maxDays === undefined || minNights === undefined)
    return { error: 'Дни и ночи — целые числа' } as const;
  return {
    error: null,
    input: {
      discountPercent,
      minDaysBeforeArrival: minDays,
      maxDaysBeforeArrival: maxDays,
      minNights,
    },
  } as const;
}

/** Новый производный тариф («Тарифные планы»): проверки и журнал — в API; ошибка — словами в панели */
export async function createDerivedPlan(
  _prev: DerivedActionResult | null,
  form: FormData,
): Promise<DerivedActionResult> {
  const fields = derivedFields(form);
  if (fields.error) return { error: fields.error };
  try {
    const saved = await ratesApi.createDerived({
      ...fields.input,
      name: String(form.get('name') ?? '').trim(),
      parentCode: String(form.get('parentCode') ?? ''),
    });
    revalidatePath('/rates/plans');
    return { error: null, saved };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** Правка условий производного тарифа: процент, окно продаж, минимум ночей */
export async function saveDerivedPlan(
  _prev: DerivedActionResult | null,
  form: FormData,
): Promise<DerivedActionResult> {
  const fields = derivedFields(form);
  if (fields.error) return { error: fields.error };
  try {
    const saved = await ratesApi.updateDerived(String(form.get('code') ?? ''), fields.input);
    revalidatePath('/rates/plans');
    return { error: null, saved };
  } catch (e) {
    return { error: errorText(e) };
  }
}

export interface PromoActionResult {
  error: string | null;
  saved?: PromoCodeRow;
}

/** Новый промокод: код, процент, период проживания и предел использований */
export async function createPromoCode(
  _prev: PromoActionResult | null,
  form: FormData,
): Promise<PromoActionResult> {
  const percent = wholeOrNull(form, 'discountPercent');
  const maxUses = wholeOrNull(form, 'maxUses');
  if (percent === undefined || percent === null)
    return { error: 'Скидка — целое число от 1 до 90 процентов' };
  if (maxUses === undefined) return { error: 'Предел использований — целое число или пусто' };
  const date = (key: string) => {
    const v = String(form.get(key) ?? '').trim();
    return v === '' ? null : v;
  };
  try {
    const saved = await ratesApi.createPromo({
      code: String(form.get('code') ?? ''),
      discountPercent: percent,
      stayFrom: date('stayFrom'),
      stayTo: date('stayTo'),
      maxUses,
    });
    revalidatePath('/rates/promo');
    return { error: null, saved };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** Включить или выключить промокод; код не удаляется, чтобы броням оставался след */
export async function setPromoActive(form: FormData): Promise<void> {
  const code = String(form.get('code') ?? '');
  const active = String(form.get('active') ?? '') === 'true';
  await ratesApi.updatePromo(code, { active });
  revalidatePath('/rates/promo');
}
