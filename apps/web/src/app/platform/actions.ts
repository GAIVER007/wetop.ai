'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, platformApi, type ExtensionChangeBody } from '../../lib/api';

/**
 * «Платформа → Организации» (ADR-083): главный администратор включает, продлевает и выключает «ИИ-продавца»
 * организации. Проверяет права и поля API; отказ — его словами, введённое остаётся в форме.
 */
export interface ExtensionFormResult {
  error: string | null;
  message: string | null;
  attempt: number;
  values?: ExtensionChangeBody;
}

const STATUSES = ['TRIAL', 'ACTIVE', 'OFF'] as const;

export async function changeAiSellerAction(
  organizationId: string,
  prev: ExtensionFormResult | null,
  form: FormData,
): Promise<ExtensionFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const raw = String(form.get('status') ?? '');
  const values: ExtensionChangeBody = {
    status: (STATUSES as readonly string[]).includes(raw)
      ? (raw as ExtensionChangeBody['status'])
      : 'ACTIVE',
    activeUntil: String(form.get('activeUntil') ?? '').trim(),
    note: String(form.get('note') ?? '').trim(),
  };
  try {
    const saved = await platformApi.changeAiSeller(organizationId, {
      ...values,
      // статус из формы не подменяем: неизвестный уходит как есть, и API называет причину
      status: raw as ExtensionChangeBody['status'],
    });
    revalidatePath('/platform');
    return {
      error: null,
      // организация уже названа в заголовке карточки — здесь только что стало
      message: `Сохранено: ИИ-продавец ${
        saved.aiSeller.access === 'active'
          ? 'действует'
          : saved.aiSeller.access === 'expired'
            ? 'срок вышел'
            : 'не подключён'
      }.`,
      attempt,
    };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e),
      message: null,
      attempt,
      values,
    };
  }
}

export interface StatusFormResult {
  error: string | null;
  message: string | null;
  attempt: number;
}

/**
 * Подписка организации (Q-141 — А, ADR-102): счёт оплачен — «Оплата получена», организация снова пишет; «Только
 * чтение» — обратно. Кнопка передаёт статус, заметка — номер счёта. Проверяет API.
 */
export async function changeStatusAction(
  organizationId: string,
  prev: StatusFormResult | null,
  form: FormData,
): Promise<StatusFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const status = String(form.get('status') ?? '') as 'ACTIVE' | 'READ_ONLY';
  const note = String(form.get('note') ?? '').trim();
  try {
    await platformApi.changeStatus(organizationId, { status, note });
    revalidatePath('/platform');
    return {
      error: null,
      message:
        status === 'ACTIVE'
          ? 'Оплата подтверждена: организация снова может вносить изменения.'
          : 'Организация переведена в «только чтение».',
      attempt,
    };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e),
      message: null,
      attempt,
    };
  }
}
