'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, supportApi, type SupportKbEntry } from '../../../lib/api';
import { kbHref } from '../../../lib/support-kb';

/**
 * Действия «Платформа → Техподдержка → База знаний» (S3): всё через API платформы. Автора и утверждающего ставит
 * сервер из сессии главного администратора; из формы они не приходят. Отказ — словами API, введённое остаётся.
 */

export interface KbValues {
  title: string;
  category: string;
  visibility: string;
  content: string;
}

export interface KbSaveResult {
  error: string | null;
  message: string | null;
  /** Созданная запись — редактор переводит на её страницу */
  createdId: string | null;
}

const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

/** Создать (`id` пусто) или сохранить; правка активной записи уводит её в черновик (решает бот) */
export async function kbSaveAction(id: string | null, values: KbValues): Promise<KbSaveResult> {
  try {
    const saved: SupportKbEntry = id
      ? await supportApi.kbUpdate(id, { ...values })
      : await supportApi.kbCreate({ ...values });
    revalidatePath('/platform/support/base');
    return { error: null, message: 'Сохранено.', createdId: id ? null : saved.id };
  } catch (e) {
    return { error: describe(e), message: null, createdId: null };
  }
}

export interface KbSimpleResult {
  error: string | null;
  message: string | null;
}

export async function kbPublishAction(id: string): Promise<KbSimpleResult> {
  try {
    await supportApi.kbPublish(id);
    revalidatePath('/platform/support/base');
    return { error: null, message: 'Опубликовано: помощник начнёт отвечать по этой записи.' };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function kbStatusAction(id: string, status: string): Promise<KbSimpleResult> {
  try {
    await supportApi.kbStatus(id, status);
    revalidatePath('/platform/support/base');
    return {
      error: null,
      message:
        status === 'OUTDATED'
          ? 'Помечено устаревшим: помощник по записи не отвечает.'
          : status === 'ARCHIVED'
            ? 'Запись в архиве.'
            : 'Запись возвращена в черновик.',
    };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export interface KbDraftResult extends KbSimpleResult {
  href: string | null;
}

/** Из закрытого обращения — только пустой черновик по шаблону; переписка в него не копируется */
export async function kbDraftAction(conversationId: string): Promise<KbDraftResult> {
  try {
    const draft = await supportApi.knowledgeDraft(conversationId);
    revalidatePath('/platform/support/base');
    return {
      error: null,
      message: 'Черновик создан. Дополните его и опубликуйте, если согласны.',
      href: draft.id ? kbHref({ id: draft.id }) : null,
    };
  } catch (e) {
    return { error: describe(e), message: null, href: null };
  }
}
