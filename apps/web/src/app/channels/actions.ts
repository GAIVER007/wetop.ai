'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, channelsApi } from '../../lib/api';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';

export interface ChannelActionResult {
  error: string | null;
  message: string | null;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

export async function channelAction(
  kind: 'setup' | 'sync' | 'pull' | 'flush' | 'webhook-register' | 'webhook-test',
  ratePlanCode?: string,
): Promise<ChannelActionResult> {
  const t = await serverT();
  try {
    let message: string;
    if (kind === 'setup') {
      const r = (await channelsApi.setup(ratePlanCode)) as {
        created: { property: boolean; roomTypes: number; ratePlans: number };
      };
      message = t(
        r.created.property
          ? msg('Объект создан, категорий создано {roomTypes}, тарифов {ratePlans}')
          : msg('Объект уже был, категорий создано {roomTypes}, тарифов {ratePlans}'),
        { roomTypes: r.created.roomTypes, ratePlans: r.created.ratePlans },
      );
    } else if (kind === 'sync') {
      const r = await channelsApi.sync();
      message = t('Полная выгрузка {from} → {to}; задачи менеджера каналов: {tasks}', {
        from: r.from,
        to: r.to,
        tasks: r.tasks.join(', '),
      });
    } else if (kind === 'pull') {
      const r = await channelsApi.pull();
      // Отклонённые ревизии и предупреждения (ADR-024: «несколько кандидатов», «без ячейки», «предоплата не
      // записана») администратор должен увидеть здесь же, а не только в журнале событий ниже
      const outcomes = r.outcomes as Array<{
        uniqueId?: string;
        result?: string;
        error?: string;
        warnings?: string[];
      }>;
      const rejected = outcomes.filter((o) => o.result === 'failed');
      const warnings = outcomes.flatMap((o) => o.warnings ?? []);
      message =
        t('Получено ревизий: {received}, подтверждено: {acknowledged}', {
          received: r.received,
          acknowledged: r.acknowledged,
        }) +
        (rejected.length
          ? t('; отклонено: {n}: {list}', {
              n: rejected.length,
              list: rejected.map((o) => o.error ?? o.uniqueId ?? '?').join(' | '),
            })
          : '') +
        (warnings.length
          ? t('; предупреждений: {n}: {list}', { n: warnings.length, list: warnings.join(' | ') })
          : '');
    } else if (kind === 'webhook-register') {
      const r = await channelsApi.registerWebhook();
      message = t(
        r.created
          ? r.active
            ? msg('Webhook зарегистрирован: {url} (события {mask}, активен)')
            : msg('Webhook зарегистрирован: {url} (события {mask}, выключен)')
          : r.active
            ? msg('Webhook обновлён: {url} (события {mask}, активен)')
            : msg('Webhook обновлён: {url} (события {mask}, выключен)'),
        { url: r.callbackUrl, mask: r.eventMask },
      );
    } else if (kind === 'webhook-test') {
      const r = await channelsApi.testWebhook();
      message = t('Пробный вызов {url}: HTTP {code}, {verdict}', {
        url: r.callbackUrl,
        code: r.statusCode,
        verdict: r.verdict,
      });
    } else {
      const r = await channelsApi.flush();
      message =
        t('Отправлено пакетов: {n}', { n: r.sent.length }) +
        (r.errors.length ? t(', ошибок: {n}', { n: r.errors.length }) : '');
    }
    refreshChannelViews();
    return { error: null, message };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Результат разбора ревизии (RevisionOutcome.result в API) — подпись для администратора */
const RESULT_RU: Record<string, string> = {
  created: msg('бронь создана'),
  linked: msg('сопоставлена с перенесённой'),
  modified: msg('бронь изменена'),
  cancelled: msg('бронь отменена'),
  skipped_duplicate: msg('повтор, пропущено'),
  failed: msg('ошибка'),
};

/** Разобрать входящее событие заново: после шести неудач PMS сама больше не пробует. */
export async function retryEventAction(revisionId: string): Promise<ChannelActionResult> {
  const t = await serverT();
  try {
    const r = await channelsApi.retryEvent(revisionId);
    refreshChannelViews();
    return {
      error: r.error ?? null,
      message: r.error
        ? null
        : t('Событие {id}: {result}', {
            id: revisionId,
            result: RESULT_RU[r.result] ? t(RESULT_RU[r.result]!) : r.result,
          }) + (r.confirmationNumber ? t(', бронь {number}', { number: r.confirmationNumber }) : ''),
    };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

function refreshChannelViews() {
  for (const path of [
    '/chessboard',
    '/management/analytics',
    '/management/analytics/occupancy',
    '/rooms/availability',
    '/finance',
    '/guests',
    '/connections',
  ])
    revalidatePath(path);
  // все вкладки модуля «Каналы продаж» разом (ADR-112): обзор, подключения, синхронизация, события
  revalidatePath('/channels', 'layout');
  revalidatePath('/reservations/[number]', 'page');
  revalidatePath('/guests/[id]', 'page');
}
