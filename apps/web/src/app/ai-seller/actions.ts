'use server';
import { revalidatePath } from 'next/cache';
import { sellerProfileFromForm } from '../../lib/ai-seller';
import { ApiError, sellerApi, type SellerProfileBody } from '../../lib/api';

/**
 * Действия раздела «ИИ-продавец» (ТЗ ред. 1 П6, П8). Всё идёт через API платформы: ни адреса, ни ключа продавца
 * стойка не знает (ТЗ §2 п. 3). Ответ — словами для человека; «сохранено, но не применено» — предупреждение, а не
 * ошибка: профиль записан, и служба сверки отправит его сама.
 */

const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

const refresh = () => revalidatePath('/ai-seller', 'layout');

export interface SellerFormResult {
  error: string | null;
  warning: string | null;
  message: string | null;
  attempt: number;
  /** Что человек ввёл — чтобы форма после отказа не сбрасывалась */
  values?: SellerProfileBody;
}

/** «Применить»: сохранить профиль и сразу отправить продавцу профиль и факты объекта */
export async function applySellerAction(
  prev: SellerFormResult | null,
  form: FormData,
): Promise<SellerFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const body = sellerProfileFromForm(form);
  try {
    await sellerApi.saveProfile(body);
  } catch (e) {
    return { error: describe(e), warning: null, message: null, attempt, values: body };
  }
  try {
    await sellerApi.apply();
    refresh();
    return {
      error: null,
      warning: null,
      message: 'Применено: продавец получил настройки и данные объекта.',
      attempt,
    };
  } catch (e) {
    refresh();
    const status = e instanceof ApiError ? e.status : undefined;
    if (status === 422)
      return {
        error: `Настройки сохранены, но продавец их отклонил: ${describe(e)}`,
        warning: null,
        message: null,
        attempt,
        values: body,
      };
    if (status === 403)
      return { error: null, warning: `Настройки сохранены. ${describe(e)}.`, message: null, attempt };
    if (status === 503 && /не подключён/.test(describe(e)))
      return {
        error: null,
        warning: 'Настройки сохранены. Продавец ещё не подключён — он получит их при подключении.',
        message: null,
        attempt,
      };
    return {
      error: null,
      warning: `Настройки сохранены. ${describe(e)}. Отправим продавцу автоматически, как только он ответит.`,
      message: null,
      attempt,
    };
  }
}

export interface SimpleResult {
  error: string | null;
  message: string | null;
  attempt: number;
}

/** Документ в базу знаний продавца */
export async function uploadKnowledgeAction(
  prev: SimpleResult | null,
  form: FormData,
): Promise<SimpleResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { error: 'Выберите файл: md, txt, pdf, docx или xlsx', message: null, attempt };
  try {
    const r = await sellerApi.uploadKnowledge(file);
    revalidatePath('/ai-seller/knowledge');
    return {
      error: null,
      message: `${r.created ? 'Загружено' : 'Обновлено'}: «${r.source}», частей ${r.chunks}.`,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt };
  }
}

/** «Перехватить» и «Вернуть боту» */
export async function dialogModeAction(
  id: string,
  action: 'takeover' | 'release',
): Promise<SimpleResult> {
  try {
    await sellerApi.switchMode(id, action);
    revalidatePath('/ai-seller/dialogs');
    return {
      error: null,
      message:
        action === 'takeover'
          ? 'Диалог ваш: продавец молчит, пока вы не вернёте его боту.'
          : 'Диалог вернули боту.',
      attempt: 0,
    };
  } catch (e) {
    return { error: describe(e), message: null, attempt: 0 };
  }
}

/** «Ответить» гостю от человека */
export async function replyAction(
  id: string,
  prev: SimpleResult | null,
  form: FormData,
): Promise<SimpleResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const text = String(form.get('text') ?? '');
  try {
    await sellerApi.reply(id, text);
    revalidatePath('/ai-seller/dialogs');
    return { error: null, message: 'Ответ отправлен.', attempt };
  } catch (e) {
    return { error: describe(e), message: null, attempt };
  }
}

export interface SandboxExchange {
  question: string;
  reply: string | null;
  needsHuman: boolean;
  reasons: string[];
}

export interface SandboxResult {
  error: string | null;
  attempt: number;
  /** Последние обмены этой проверки — не больше десяти: состояние ездит между стойкой и браузером */
  history: SandboxExchange[];
}

const SANDBOX_HISTORY = 10;

/** «Проверка»: спросить продавца как гость — ответ из песочницы, в диалоги сайта он не попадает */
export async function sandboxAction(
  prev: SandboxResult | null,
  form: FormData,
): Promise<SandboxResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const history = prev?.history ?? [];
  const question = String(form.get('text') ?? '').trim();
  try {
    const r = await sellerApi.sandbox(question);
    const exchange = { question, reply: r.reply, needsHuman: r.needsHuman, reasons: r.reasons };
    return { error: null, attempt, history: [...history, exchange].slice(-SANDBOX_HISTORY) };
  } catch (e) {
    return { error: describe(e), attempt, history };
  }
}
