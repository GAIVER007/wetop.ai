'use server';
import { formValues } from '../../lib/form-values';
import { revalidatePath } from 'next/cache';
import { ApiError, analyticsApi, type TrackedSiteCard } from '../../lib/api';
import { hostsAfterAdd, hostsAfterRemove, parseDomainInput } from '../../lib/website';

export interface SiteActionResult {
  error: string | null;
  values?: Record<string, string>;
  attempt?: number;
  message: string | null;
  card?: TrackedSiteCard | undefined;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

/** Подключить сайт: название и адрес. */
export async function createSiteAction(
  _prev: SiteActionResult | null,
  form: FormData,
): Promise<SiteActionResult> {
  const name = String(form.get('name') ?? '').trim();
  // WEB2: один адрес, почищенный так же, как в «Добавить домен»; ещё адреса — списком после подключения
  const parsed = parseDomainInput(String(form.get('hosts') ?? ''));
  if ('error' in parsed)
    return {
      error: parsed.error,
      message: null,
      values: formValues(form, ['name', 'hosts']),
      attempt: (_prev?.attempt ?? 0) + 1,
    };
  try {
    const card = await analyticsApi.create({ name, hosts: [parsed.host] });
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

/**
 * «Добавить домен» (WEB2): ввод чистится и проверяется до API, список читается сервером заново — не из вкладки, которая
 * могла устареть. Настоящий домен вытесняет заглушку, в ответе это названо.
 */
export async function addDomainAction(id: string, raw: string): Promise<SiteActionResult> {
  const parsed = parseDomainInput(raw);
  if ('error' in parsed) return { error: parsed.error, message: null };
  try {
    const { site } = await analyticsApi.card(id);
    const next = hostsAfterAdd(site.hosts, parsed.host);
    if ('error' in next) return { error: next.error, message: null };
    const card = await analyticsApi.update(id, { hosts: next.hosts });
    refreshSiteViews();
    const replaced = next.dropped.length ? `, заглушка ${next.dropped.join(', ')} убрана` : '';
    return { error: null, message: `Домен ${parsed.host} добавлен${replaced}`, card };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** «Убрать» домен (WEB2): последний не убирается — API требует хотя бы один адрес */
export async function removeDomainAction(id: string, host: string): Promise<SiteActionResult> {
  try {
    const { site } = await analyticsApi.card(id);
    const next = hostsAfterRemove(site.hosts, host);
    if ('error' in next) return { error: next.error, message: null };
    const card = await analyticsApi.update(id, { hosts: next.hosts });
    refreshSiteViews();
    return {
      error: null,
      message: `Домен ${host} убран: с него WETOP больше не принимает посещения и брони`,
      card,
    };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Все вкладки «Сайта и онлайн-бронирования» (ADR-107): состояние сайта видно на каждой */
function refreshSiteViews() {
  for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings'])
    revalidatePath(path);
}
