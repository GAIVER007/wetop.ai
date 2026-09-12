'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, analyticsApi, type TrackedSiteCard } from '../../lib/api';

export interface SiteActionResult {
  error: string | null;
  message: string | null;
  card?: TrackedSiteCard | undefined;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

/** Добавить сайт: название и домены (по одному в строке или через запятую). */
export async function createSiteAction(
  _prev: SiteActionResult | null,
  form: FormData,
): Promise<SiteActionResult> {
  const name = String(form.get('name') ?? '').trim();
  const hosts = String(form.get('hosts') ?? '')
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean);
  try {
    const card = await analyticsApi.create({ name, hosts });
    revalidatePath('/analytics/setup');
    revalidatePath('/analytics');
    return {
      error: null,
      message: `Сайт «${card.site.name}» добавлен, ключ ${card.site.publicKey}`,
      card,
    };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function siteAction(
  id: string,
  kind: 'pause' | 'resume' | 'delete' | 'check',
): Promise<SiteActionResult> {
  try {
    let message: string;
    let card: TrackedSiteCard | undefined;
    if (kind === 'delete') {
      await analyticsApi.remove(id);
      message = 'Сайт удалён вместе с накопленной статистикой';
    } else if (kind === 'check') {
      card = await analyticsApi.card(id);
      message = card.status.lastEventAt
        ? `Счётчик жив: последнее событие ${new Date(card.status.lastEventAt).toLocaleString('ru-RU', { timeZone: card.site.timezone })}, сегодня сессий ${card.status.sessionsToday}`
        : 'Событий ещё не было: откройте сайт с установленным кодом и нажмите «Проверить» снова';
    } else {
      card = await analyticsApi.update(id, { status: kind === 'pause' ? 'PAUSED' : 'ACTIVE' });
      message = kind === 'pause' ? 'Счётчик на паузе: события не сохраняются' : 'Счётчик включён';
    }
    revalidatePath('/analytics/setup');
    revalidatePath('/analytics');
    return { error: null, message, card };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Виджет бронирования (срез 9): включить/выключить и тариф сайта. */
export async function bookingSettingsAction(
  id: string,
  input: { enabled: boolean; ratePlanCode: string },
): Promise<SiteActionResult> {
  try {
    const card = await analyticsApi.update(id, {
      bookingEnabled: input.enabled,
      ...(input.ratePlanCode ? { bookingRatePlanCode: input.ratePlanCode } : {}),
    });
    revalidatePath('/analytics/setup');
    return {
      error: null,
      message: card.site.bookingEnabled
        ? `Бронирование с сайта включено, тариф «${card.site.bookingRatePlan?.name ?? '—'}». Вставьте второй код на сайт`
        : 'Бронирование с сайта выключено: виджет на сайте покажет, что бронирование недоступно',
      card,
    };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Домены сайта (по одному в строке или через запятую): приёмник и виджет принимают запросы только с них. */
export async function hostsAction(id: string, raw: string): Promise<SiteActionResult> {
  const hosts = raw
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean);
  try {
    const card = await analyticsApi.update(id, { hosts });
    revalidatePath('/analytics/setup');
    return { error: null, message: `Домены сохранены: ${card.site.hosts.join(', ')}`, card };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}
