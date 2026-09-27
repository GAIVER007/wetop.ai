'use server';
import { formValues } from '../../lib/form-values';
import { revalidatePath } from 'next/cache';
import { ApiError, analyticsApi, type TrackedSiteCard } from '../../lib/api';

export interface SiteActionResult {
  error: string | null;
  values?: Record<string, string>;
  attempt?: number;
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
    refreshSiteViews();
    return {
      error: null,
      message: `Сайт «${card.site.name}» добавлен, ключ ${card.site.publicKey}`,
      card,
    };
  } catch (e) {
    return {
      error: describe(e),
      message: null,
      values: formValues(form, ['name', 'hosts']),
      attempt: (_prev?.attempt ?? 0) + 1,
    };
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
      // Пауза сайта останавливает и приёмник счётчика, и виджет (collect.service, web-booking.service)
      message =
        kind === 'pause'
          ? 'Сайт приостановлен: посещения не записываются, брони с сайта не принимаются'
          : 'Сайт снова принимает посещения и брони';
    }
    refreshSiteViews();
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
    refreshSiteViews();
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
    refreshSiteViews();
    return { error: null, message: `Домены сохранены: ${card.site.hosts.join(', ')}`, card };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Все вкладки «Сайта и онлайн-бронирования» (ADR-107): состояние сайта видно на каждой */
function refreshSiteViews() {
  for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings'])
    revalidatePath(path);
}
