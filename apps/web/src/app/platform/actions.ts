'use server';
import { accessTrialUntil } from '../../lib/platform-trial';
import { revalidatePath } from 'next/cache';
import { ApiError, platformApi, type ExtensionChangeBody } from '../../lib/api';
import { statusText } from './words';
import { serverT } from '../../i18n/server';

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
    const t = await serverT();
    return {
      error: null,
      // организация уже названа в заголовке карточки — здесь только что стало
      message: t('Сохранено: ИИ-продавец {state}.', {
        state:
          saved.aiSeller.access === 'active'
            ? t('действует')
            : saved.aiSeller.access === 'expired'
              ? t('срок вышел')
              : t('не подключён'),
      }),
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
    const t = await serverT();
    return {
      error: null,
      message:
        status === 'ACTIVE'
          ? t('Оплата подтверждена: организация снова может вносить изменения.')
          : t('Организация переведена в «только чтение».'),
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

/**
 * MKT9.2: лицензия конструктора сайта одного гостиничного филиала: «Пробный» (нужен срок), «Активировать» (пустой срок:
 * бессрочно), «Продлить» (тот же статус, новый срок), «Выключить». Только главный администратор; проверяет API
 */
export interface SiteBuilderFormResult {
  error: string | null;
  message: string | null;
  attempt: number;
}

export async function changeSiteBuilderAction(
  organizationId: string,
  locationId: string,
  current: 'TRIAL' | 'ACTIVE' | 'OFF' | null,
  prev: SiteBuilderFormResult | null,
  form: FormData,
): Promise<SiteBuilderFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const action = String(form.get('action') ?? '');
  const status = action === 'trial' ? 'TRIAL' : action === 'off' ? 'OFF' : action === 'extend' && current === 'TRIAL' ? 'TRIAL' : 'ACTIVE';
  try {
    const saved = await platformApi.changeSiteBuilder(organizationId, locationId, {
      status,
      activeUntil: status === 'OFF' ? '' : String(form.get('activeUntil') ?? '').trim(),
      note: String(form.get('note') ?? '').trim(),
    });
    revalidatePath('/platform');
    const t = await serverT();
    const word = saved.license.access === 'active' ? t('действует') : saved.license.access === 'expired' ? t('срок вышел') : t('выключен');
    return { error: null, message: t('Сохранено: конструктор сайта филиала «{name}» {state}', { name: saved.name, state: word }), attempt };
  } catch (e) {
    const t = await serverT();
    return { error: e instanceof ApiError || e instanceof Error ? e.message : t('Не удалось сохранить'), message: null, attempt };
  }
}

/**
 * Выдача доступа из «Подписки клиентов» (владелец 29.10.2026): пробный на 14 дней одной кнопкой (срок считает сервер
 * стойки, последний день включительно), «Оплачен» бессрочно, «Выключить». Тот же API лицензии, что форма выше.
 */
export async function grantAccessAction(
  organizationId: string,
  locationId: string,
  prev: SiteBuilderFormResult | null,
  form: FormData,
): Promise<SiteBuilderFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const action = String(form.get('action') ?? '');
  const status = action === 'trial' ? 'TRIAL' : action === 'off' ? 'OFF' : 'ACTIVE';
  // срок по Алматы (пояс платформы): вечером UTC там уже завтра
  const activeUntil = status === 'TRIAL' ? accessTrialUntil() : '';
  try {
    const saved = await platformApi.changeSiteBuilder(organizationId, locationId, { status, activeUntil, note: String(form.get('note') ?? '').trim() });
    revalidatePath('/platform/cabinet', 'layout');
    revalidatePath('/platform');
    const t = await serverT();
    const word = saved.license.access === 'active' ? t('действует') : saved.license.access === 'expired' ? t('срок вышел') : t('выключен');
    return { error: null, message: t('Сохранено: конструктор сайта филиала «{name}» {state}', { name: saved.name, state: word }), attempt };
  } catch (e) {
    const t = await serverT();
    return { error: e instanceof ApiError || e instanceof Error ? e.message : t('Не удалось сохранить'), message: null, attempt };
  }
}

/**
 * Название, архив и возврат организации (ORG1, ADR-ORG1, Q-282): «удалить» заменено архивом, данные не удаляются.
 * Проверяет API, отказ его словами.
 */
export interface OrganizationActionResult {
  error: string | null;
  message: string | null;
  attempt: number;
}

const failed = (e: unknown, attempt: number): OrganizationActionResult => ({
  error: e instanceof ApiError || e instanceof Error ? e.message : String(e),
  message: null,
  attempt,
});

export async function renameOrganizationAction(
  organizationId: string,
  prev: OrganizationActionResult | null,
  form: FormData,
): Promise<OrganizationActionResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    await platformApi.rename(organizationId, String(form.get('name') ?? ''));
    revalidatePath('/platform');
    const t = await serverT();
    return { error: null, message: t('Название сохранено.'), attempt };
  } catch (e) {
    return failed(e, attempt);
  }
}

export async function archiveOrganizationAction(
  organizationId: string,
  prev: OrganizationActionResult | null,
): Promise<OrganizationActionResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    await platformApi.archive(organizationId);
    revalidatePath('/platform');
    const t = await serverT();
    return {
      error: null,
      message: t('Организация в архиве: люди не входят, данные сохранены. Вернуть можно в любой момент.'),
      attempt,
    };
  } catch (e) {
    return failed(e, attempt);
  }
}

export async function restoreOrganizationAction(
  organizationId: string,
  prev: OrganizationActionResult | null,
): Promise<OrganizationActionResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    const saved = await platformApi.restore(organizationId);
    revalidatePath('/platform');
    const t = await serverT();
    return {
      error: null,
      message: t('Организация возвращена, состояние: {state}.', { state: statusText(saved, t) }),
      attempt,
    };
  } catch (e) {
    return failed(e, attempt);
  }
}

/**
 * Создание организации и ссылка владельцу ещё раз (ORG2, ADR-ORG2, Q-283). Владелец сам задаёт пароль по ссылке из
 * письма; токен наружу не идёт. Письмо не ушло: организация создана, на карточке можно отправить ссылку ещё раз.
 */
export interface CreateOrganizationResult extends OrganizationActionResult {
  /** id созданной организации: форма ведёт на её карточку */
  organizationId?: string;
}

export async function createOrganizationAction(
  prev: CreateOrganizationResult | null,
  form: FormData,
): Promise<CreateOrganizationResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const vertical = form.get('vertical') === 'BEAUTY' ? 'BEAUTY' : 'HOSPITALITY';
  try {
    const made = await platformApi.create({
      name: String(form.get('name') ?? ''),
      ownerEmail: String(form.get('ownerEmail') ?? ''),
      vertical,
    });
    revalidatePath('/platform');
    const t = await serverT();
    const owner = made.organization.owners[0] ?? t('владельцу');
    const name = made.organization.name;
    return {
      error: null,
      message: made.ownerLinkSent
        ? t('Организация «{name}» создана. Ссылка для пароля отправлена на {owner}.', { name, owner })
        : t('Организация «{name}» создана, но письмо не ушло. Откройте её карточку и отправьте ссылку ещё раз.', { name }),
      attempt,
      organizationId: made.organization.id,
    };
  } catch (e) {
    return failed(e, attempt);
  }
}

export async function sendOwnerLinkAction(
  organizationId: string,
  prev: OrganizationActionResult | null,
): Promise<OrganizationActionResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    const sent = await platformApi.ownerLink(organizationId);
    revalidatePath('/platform');
    const t = await serverT();
    return {
      error: null,
      message: sent.ownerLinkSent
        ? t('Ссылка отправлена на {to}.', { to: sent.organization.owners[0] ?? t('почту владельца') })
        : t('Письмо не ушло: почтовая служба не отвечает. Попробуйте позже.'),
      attempt,
    };
  } catch (e) {
    return failed(e, attempt);
  }
}

/** Карточка клиента (срез 3 кабинета): продлить пробный на 7, 14 или 30 дней */
export async function extendTrialAction(
  organizationId: string,
  prev: StatusFormResult | null,
  form: FormData,
): Promise<StatusFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const days = Number(form.get('days'));
  try {
    const card = await platformApi.extendTrial(organizationId, days);
    revalidatePath('/platform/cabinet', 'layout');
    const t = await serverT();
    return {
      error: null,
      message: t('Пробный продлён до {day}.', { day: (card.trialEndsAt ?? '').slice(0, 10).split('-').reverse().join('.') }),
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
