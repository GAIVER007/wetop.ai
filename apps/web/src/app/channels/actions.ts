'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, channelsApi } from '../../lib/api';

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
  try {
    let message: string;
    if (kind === 'setup') {
      const r = (await channelsApi.setup(ratePlanCode)) as {
        created: { property: boolean; roomTypes: number; ratePlans: number };
      };
      message = `Объект ${r.created.property ? 'создан' : 'уже был'}, категорий создано ${r.created.roomTypes}, тарифов ${r.created.ratePlans}`;
    } else if (kind === 'sync') {
      const r = await channelsApi.sync();
      message = `Полная выгрузка ${r.from} → ${r.to}; задачи менеджера каналов: ${r.tasks.join(', ')}`;
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
        `Получено ревизий: ${r.received}, подтверждено: ${r.acknowledged}` +
        (rejected.length
          ? `; отклонено: ${rejected.length} — ${rejected.map((o) => o.error ?? o.uniqueId ?? '?').join(' | ')}`
          : '') +
        (warnings.length ? `; предупреждений: ${warnings.length} — ${warnings.join(' | ')}` : '');
    } else if (kind === 'webhook-register') {
      const r = await channelsApi.registerWebhook();
      message = `Webhook ${r.created ? 'зарегистрирован' : 'обновлён'}: ${r.callbackUrl} (события ${r.eventMask}, ${r.active ? 'активен' : 'выключен'})`;
    } else if (kind === 'webhook-test') {
      const r = await channelsApi.testWebhook();
      message = `Пробный вызов ${r.callbackUrl}: HTTP ${r.statusCode} — ${r.verdict}`;
    } else {
      const r = await channelsApi.flush();
      message = `Отправлено пакетов: ${r.sent.length}${r.errors.length ? `, ошибок: ${r.errors.length}` : ''}`;
    }
    refreshChannelViews();
    return { error: null, message };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Результат разбора ревизии (RevisionOutcome.result в API) — подпись для администратора */
const RESULT_RU: Record<string, string> = {
  created: 'бронь создана',
  linked: 'сопоставлена с перенесённой',
  modified: 'бронь изменена',
  cancelled: 'бронь отменена',
  skipped_duplicate: 'повтор, пропущено',
  failed: 'ошибка',
};

/** Разобрать входящее событие заново: после шести неудач PMS сама больше не пробует. */
export async function retryEventAction(revisionId: string): Promise<ChannelActionResult> {
  try {
    const r = await channelsApi.retryEvent(revisionId);
    refreshChannelViews();
    return {
      error: r.error ?? null,
      message: r.error
        ? null
        : `Событие ${revisionId}: ${RESULT_RU[r.result] ?? r.result}${r.confirmationNumber ? ` — бронь ${r.confirmationNumber}` : ''}`,
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
