'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, supportApi } from '../../../lib/api';
import type { SimpleResult } from '../../ai-seller/actions';

/**
 * Действия «Платформа → Техподдержка» (ADR-083, Э3): всё через API платформы — адреса и ключа помощника стойка не
 * знает. Права проверяет API: не главному администратору он отвечает 403, и эти слова показываются как есть.
 */

const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

export async function supportModeAction(
  id: string,
  action: 'takeover' | 'release',
): Promise<SimpleResult> {
  try {
    await supportApi.switchMode(id, action);
    revalidatePath('/platform/support');
    return {
      error: null,
      message:
        action === 'takeover'
          ? 'Диалог ваш: помощник молчит, пока вы не вернёте его боту.'
          : 'Диалог вернули помощнику.',
      attempt: 0,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt: 0 };
  }
}

export async function supportReplyAction(
  id: string,
  prev: SimpleResult | null,
  form: FormData,
): Promise<SimpleResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const text = String(form.get('text') ?? '');
  try {
    await supportApi.reply(id, text);
    revalidatePath('/platform/support');
    return { error: null, message: 'Ответ отправлен.', attempt };
  } catch (e) {
    return { error: describe(e), message: null, attempt };
  }
}

export async function supportUploadAction(
  prev: SimpleResult | null,
  form: FormData,
): Promise<SimpleResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { error: 'Выберите файл: md, txt, pdf, docx или xlsx', message: null, attempt };
  try {
    const r = await supportApi.uploadKnowledge(file);
    revalidatePath('/platform/support/knowledge');
    return {
      error: null,
      message: `${r.created ? 'Загружено' : 'Обновлено'}: «${r.source}», частей ${r.chunks}.`,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt };
  }
}
