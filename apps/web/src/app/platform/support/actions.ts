'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, supportApi } from '../../../lib/api';
import type { SandboxResult, SimpleResult } from '../../ai-seller/actions';

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

// ── настройка помощника (ADR-084): правила, модель, песочница ─────────────────────────────────

/** Ответ формы правил: введённое остаётся в поле, если помощник не принял */
export interface PromptFormResult extends SimpleResult {
  text?: string;
}

export async function supportPromptAction(
  prev: PromptFormResult | null,
  form: FormData,
): Promise<PromptFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const text = String(form.get('text') ?? '');
  try {
    const r = await supportApi.savePrompt(text);
    revalidatePath('/platform/support/settings');
    return {
      error: null,
      message: `Сохранено: ${r.length} знаков. Следующий ответ помощник даст по новым правилам — проверьте во вкладке «Проверка».`,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt, text };
  }
}

export async function supportModelAction(
  prev: SimpleResult | null,
  form: FormData,
): Promise<SimpleResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    const r = await supportApi.saveModel(String(form.get('model') ?? ''));
    revalidatePath('/platform/support/settings');
    return {
      error: null,
      message: `Модель: ${r.model ?? '—'}${r.previous && r.previous !== r.model ? ` (была ${r.previous})` : ''}.`,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt };
  }
}

/** Последние обмены «Проверки» — не больше десяти, как у продавца */
const SANDBOX_HISTORY = 10;

export async function supportSandboxAction(
  prev: SandboxResult | null,
  form: FormData,
): Promise<SandboxResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const history = prev?.history ?? [];
  const question = String(form.get('text') ?? '').trim();
  try {
    const r = await supportApi.sandbox(question);
    const exchange = { question, reply: r.reply, needsHuman: r.needsHuman, reasons: r.reasons };
    return { error: null, attempt, history: [...history, exchange].slice(-SANDBOX_HISTORY) };
  } catch (e) {
    return { error: describe(e), attempt, history };
  }
}
