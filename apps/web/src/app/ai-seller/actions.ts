'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DEFAULT_SELLER_PROFILE } from '@pms/domain';
import {
  SELLER_SETUP_STEPS,
  sellerStepFromForm,
  type SellerProfileStep,
} from '../../lib/ai-seller';
import {
  ApiError,
  sellerApi,
  type SellerExtractResult,
  type SellerProfileBody,
  type SellerWhatsAppView,
} from '../../lib/api';

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

/**
 * Шаг настройки (`plans/ai-seller-setup-wizard-2026-09-25.md`): сохранить поля шага поверх сохранённого профиля и
 * перейти. «Назад» и «Сохранить и дальше» сохраняют оба — возврат назад введённого не теряет. Отказ домена
 * остаётся на шаге вместе с введённым.
 */
export async function saveSellerStepAction(
  key: SellerProfileStep,
  prev: SellerFormResult | null,
  form: FormData,
): Promise<SellerFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const index = SELLER_SETUP_STEPS.findIndex((s) => s.key === key);
  let body: SellerProfileBody | undefined;
  try {
    const current = await sellerApi.profile();
    body = sellerStepFromForm(key, form, current.profile);
    await sellerApi.saveProfile(body);
  } catch (e) {
    // профиль не загрузился — на экран вернутся хотя бы поля этого шага: форма после ответа сбрасывается сама
    const values = body ?? sellerStepFromForm(key, form, DEFAULT_SELLER_PROFILE);
    return { error: describe(e), warning: null, message: null, attempt, values };
  }
  refresh();
  const back = form.get('go') === 'back';
  const next = back ? Math.max(index - 1, 0) : Math.min(index + 1, SELLER_SETUP_STEPS.length - 1);
  redirect(`/ai-seller?step=${SELLER_SETUP_STEPS[next]!.step}`);
}

export interface StoryResult {
  error: string | null;
  result: SellerExtractResult | null;
  attempt: number;
  /** Введённый рассказ — вернуть в поле при отказе, чтобы не перепечатывать */
  story: string;
}

/** Рассказ своими словами → черновик профиля (С1): извлекает бот, поля увидит мастер ниже */
export async function extractStoryAction(
  prev: StoryResult | null,
  form: FormData,
): Promise<StoryResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const story = String(form.get('story') ?? '').trim();
  try {
    const result = await sellerApi.extract(story);
    refresh();
    return { error: null, result, attempt, story: '' };
  } catch (e) {
    return { error: describe(e), result: null, attempt, story };
  }
}

export interface LlmKeyResult {
  error: string | null;
  message: string | null;
  set: boolean | null;
  last4: string | null;
  attempt: number;
}

/** «Сохранить» и «Снять ключ» окна «Модель» (С2): ключ уходит боту, платформа его не хранит */
export async function llmKeySaveAction(
  prev: LlmKeyResult | null,
  form: FormData,
): Promise<LlmKeyResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const key = form.get('clear') === '1' ? '' : String(form.get('key') ?? '').trim();
  try {
    const saved = await sellerApi.saveLlmKey(key);
    refresh();
    return {
      error: null,
      message: saved.set ? `Ключ сохранён, оканчивается на ${saved.last4}` : 'Ключ снят: ходы идут ключом платформы',
      set: saved.set,
      last4: saved.last4,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, set: null, last4: null, attempt };
  }
}

/** «Проверить» — живой вызов роутера с этим ключом делает бот; наружу — вердикт словами */
export async function llmKeyCheckAction(
  prev: LlmKeyResult | null,
  form: FormData,
): Promise<LlmKeyResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const key = String(form.get('key') ?? '').trim();
  try {
    const verdict = await sellerApi.checkLlmKey(key);
    return {
      error: verdict.valid ? null : (verdict.reason ?? 'Роутер не принял ключ'),
      message: verdict.valid ? 'Ключ действителен' : null,
      set: null,
      last4: null,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, set: null, last4: null, attempt };
  }
}

export interface WhatsAppResult {
  error: string | null;
  message: string | null;
  view: SellerWhatsAppView | null;
  attempt: number;
}

/** «Подключить» и «Отключить» WhatsApp (С3): поля уходят боту, платформа токен не хранит */
export async function whatsappSaveAction(
  prev: WhatsAppResult | null,
  form: FormData,
): Promise<WhatsAppResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const off = form.get('disconnect') === '1';
  try {
    const view = await sellerApi.saveWhatsApp(
      off
        ? { phoneNumberId: '' }
        : {
            phoneNumberId: String(form.get('phoneNumberId') ?? '').trim(),
            token: String(form.get('token') ?? '').trim(),
            appSecret: String(form.get('appSecret') ?? '').trim(),
          },
    );
    refresh();
    return {
      error: null,
      message: view.set ? 'WhatsApp подключён: впишите адрес и слово в консоль Meta' : 'WhatsApp отключён',
      view,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, view: null, attempt };
  }
}

/** «Проверить» — Graph отдаёт номер по токену; вызов делает бот */
export async function whatsappCheckAction(
  prev: WhatsAppResult | null,
  form: FormData,
): Promise<WhatsAppResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    const verdict = await sellerApi.checkWhatsApp({
      phoneNumberId: String(form.get('phoneNumberId') ?? '').trim(),
      token: String(form.get('token') ?? '').trim(),
    });
    return {
      error: verdict.valid ? null : (verdict.reason ?? 'Meta не приняла номер или токен'),
      message: verdict.valid ? `Номер подтверждён${verdict.phone ? `: ${verdict.phone}` : ''}` : null,
      view: null,
      attempt,
    };
  } catch (e) {
    return { error: describe(e), message: null, view: null, attempt };
  }
}

/** «Применить» на шаге «Запуск»: сразу отправить продавцу сохранённые настройки и данные объекта */
export async function applySellerAction(prev: SellerFormResult | null): Promise<SellerFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
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
    if (status === 409)
      return {
        error: null,
        warning: 'Сначала заполните и сохраните первый шаг — «Знакомство».',
        message: null,
        attempt,
      };
    if (status === 422)
      return {
        error: `Продавец отклонил настройки: ${describe(e)}`,
        warning: null,
        message: null,
        attempt,
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
    // список документов — и во вкладке «Знания», и на шаге «Документы» настройки
    refresh();
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
