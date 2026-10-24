'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, supportApi } from '../../../lib/api';
import type { SandboxResult, SimpleResult } from '../../ai-seller/actions';
import { serverT } from '../../../i18n/server';

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
    const t = await serverT();
    return {
      error: null,
      message:
        action === 'takeover'
          ? t('Диалог ваш: помощник молчит, пока вы не вернёте его ИИ.')
          : t('Диалог вернули помощнику.'),
      attempt: 0,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt: 0 };
  }
}

/** «Закрыть обращение»: диалог уходит в «Закрытые»; следующее сообщение того же человека откроет новый */
export async function supportCloseAction(id: string): Promise<SimpleResult> {
  try {
    await supportApi.close(id);
    revalidatePath('/platform/support');
    const t = await serverT();
    return { error: null, message: t('Обращение закрыто.'), attempt: 0 };
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
    const t = await serverT();
    return { error: null, message: t('Ответ отправлен.'), attempt };
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
  const t = await serverT();
  if (!(file instanceof File) || file.size === 0)
    return { error: t('Выберите файл: md, txt, pdf, docx или xlsx'), message: null, attempt };
  try {
    const r = await supportApi.uploadKnowledge(file);
    revalidatePath('/platform/support/knowledge');
    const vars = { source: r.source, n: r.chunks };
    return {
      error: null,
      message: r.created ? t('Загружено: «{source}», частей {n}.', vars) : t('Обновлено: «{source}», частей {n}.', vars),
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
    const t = await serverT();
    return {
      error: null,
      message: t(
        'Сохранено: {n} знаков. Следующий ответ помощник даст по новым правилам — проверьте во вкладке «Проверка».',
        { n: r.length },
      ),
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
    const t = await serverT();
    const model = r.model ?? '—';
    return {
      error: null,
      message:
        r.previous && r.previous !== r.model
          ? t('Модель: {model} (была {previous}).', { model, previous: r.previous })
          : t('Модель: {model}.', { model }),
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
