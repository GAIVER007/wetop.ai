'use server';

import { parseBeautyPermissions, type BeautyPermission } from '@pms/domain';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import {
  ApiError,
  authApi,
  beautyApi,
  type BeautyPositionsWorkspace,
} from '../../../lib/api';
import { msg } from '../../../i18n';

type PositionValues = {
  id?: string;
  name?: string;
  permissions?: BeautyPermission[];
  userId?: string;
  positionId?: string;
  locationId?: string | null;
  assignmentId?: string;
};

export type PositionActionState = {
  error?: string;
  message?: string;
  workspace?: BeautyPositionsWorkspace;
  values?: PositionValues;
} | null;

type CapturedScope = {
  organizationId: string;
  businessId: string;
  locationId: string | null;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

function capturedScope(form: FormData): CapturedScope | null {
  try {
    const value = JSON.parse(text(form, 'scopeKey')) as Partial<CapturedScope>;
    if (
      !value.organizationId ||
      !value.businessId ||
      !Object.prototype.hasOwnProperty.call(value, 'locationId') ||
      (value.locationId !== null && (typeof value.locationId !== 'string' || !value.locationId))
    ) return null;
    return {
      organizationId: value.organizationId,
      businessId: value.businessId,
      locationId: value.locationId,
    };
  } catch {
    return null;
  }
}

async function scopeMatches(form: FormData): Promise<CapturedScope | null> {
  const expected = capturedScope(form);
  if (!expected) return null;
  const me = await authApi.me();
  if (
    me.user?.organizationId !== expected.organizationId ||
    me.context?.businessId !== expected.businessId ||
    (me.context?.locationId ?? null) !== expected.locationId
  ) return null;
  return expected;
}

function revision(form: FormData, allowZero = false): number | null {
  const value = Number(form.get('expectedRevision'));
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) ? value : null;
}

function permissions(form: FormData): BeautyPermission[] | null {
  try {
    const parsed = parseBeautyPermissions(JSON.parse(text(form, 'permissions')));
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

async function refreshed(
  scope: CapturedScope,
  message: string,
  /** та же фраза с «Изменение сохранено.»: целой фразой, чтобы её переводил словарь */
  savedMessage: string,
): Promise<NonNullable<PositionActionState>> {
  revalidatePath('/team/roles');
  try {
    const workspace = await beautyApi.positions();
    if (workspace.businessId !== scope.businessId)
      return {
        message: savedMessage,
        error: msg('Выбранный салон изменился. Обновите страницу.'),
      };
    return { workspace, message };
  } catch (error) {
    unstable_rethrow(error);
    return {
      message: savedMessage,
      error: msg('Не удалось обновить список. Обновите страницу перед следующим действием.'),
    };
  }
}

function failed(
  error: unknown,
  fallback: string,
  values?: PositionValues,
): NonNullable<PositionActionState> {
  unstable_rethrow(error);
  return { error: error instanceof ApiError ? error.message : fallback, ...(values ? { values } : {}) };
}

export async function createBeautyPosition(
  _previous: PositionActionState,
  form: FormData,
): Promise<PositionActionState> {
  const name = text(form, 'positionName');
  const grants = permissions(form);
  const values = { name, ...(grants ? { permissions: grants } : {}) };
  try {
    const scope = await scopeMatches(form);
    if (!scope) return { error: msg('Контекст изменён. Откройте должности нужного салона.'), values };
    if (!name || name.length > 100) return { error: msg('Введите название должности до 100 знаков.'), values };
    if (!grants) return { error: msg('Проверьте права должности.'), values };
    await beautyApi.createPosition({ name, permissions: grants });
    return refreshed(scope, msg('Должность создана'), msg('Должность создана. Изменение сохранено.'));
  } catch (error) {
    return failed(error, msg('Не удалось создать должность. Введённые данные сохранены.'), values);
  }
}

export async function updateBeautyPosition(
  _previous: PositionActionState,
  form: FormData,
): Promise<PositionActionState> {
  const id = text(form, 'positionId');
  const name = text(form, 'positionName');
  const grants = permissions(form);
  const values = { id, name, ...(grants ? { permissions: grants } : {}) };
  try {
    const scope = await scopeMatches(form);
    if (!scope) return { error: msg('Контекст изменён. Откройте должности нужного салона.'), values };
    const expectedRevision = revision(form);
    if (!id || !name || name.length > 100 || !grants || expectedRevision === null)
      return { error: msg('Проверьте должность и обновите страницу перед сохранением.'), values };
    await beautyApi.updatePosition(id, { name, permissions: grants, expectedRevision });
    return refreshed(scope, msg('Должность сохранена'), msg('Должность сохранена. Изменение сохранено.'));
  } catch (error) {
    return failed(error, msg('Не удалось сохранить должность. Введённые данные сохранены.'), values);
  }
}

export async function archiveBeautyPosition(
  _previous: PositionActionState,
  form: FormData,
): Promise<PositionActionState> {
  const id = text(form, 'positionId');
  const values = { id };
  try {
    const scope = await scopeMatches(form);
    if (!scope) return { error: msg('Контекст изменён. Откройте должности нужного салона.'), values };
    const expectedRevision = revision(form);
    if (!id || expectedRevision === null)
      return { error: msg('Должность устарела. Обновите страницу.'), values };
    await beautyApi.archivePosition(id, expectedRevision);
    return refreshed(scope, msg('Должность перенесена в архив'), msg('Должность перенесена в архив. Изменение сохранено.'));
  } catch (error) {
    return failed(error, msg('Не удалось архивировать должность.'), values);
  }
}

export async function assignBeautyPosition(
  _previous: PositionActionState,
  form: FormData,
): Promise<PositionActionState> {
  const userId = text(form, 'assignmentUserId');
  const positionId = text(form, 'assignmentPositionId');
  const locationValue = text(form, 'assignmentLocationId');
  const locationId = locationValue || null;
  const values = { userId, positionId, locationId };
  try {
    const scope = await scopeMatches(form);
    if (!scope) return { error: msg('Контекст изменён. Откройте должности нужного салона.'), values };
    const expectedRevision = revision(form, true);
    if (!userId || !positionId || expectedRevision === null)
      return { error: msg('Выберите сотрудника, должность и область доступа.'), values };
    await beautyApi.assignPosition({ userId, positionId, locationId, expectedRevision });
    return refreshed(scope, msg('Должность назначена'), msg('Должность назначена. Изменение сохранено.'));
  } catch (error) {
    return failed(error, msg('Не удалось назначить должность. Выбор сохранён.'), values);
  }
}

export async function revokeBeautyPosition(
  _previous: PositionActionState,
  form: FormData,
): Promise<PositionActionState> {
  const assignmentId = text(form, 'assignmentId');
  const values = { assignmentId };
  try {
    const scope = await scopeMatches(form);
    if (!scope) return { error: msg('Контекст изменён. Откройте должности нужного салона.'), values };
    const expectedRevision = revision(form);
    if (!assignmentId || expectedRevision === null)
      return { error: msg('Назначение устарело. Обновите страницу.'), values };
    await beautyApi.revokePosition(assignmentId, expectedRevision);
    return refreshed(scope, msg('Назначение отозвано'), msg('Назначение отозвано. Изменение сохранено.'));
  } catch (error) {
    return failed(error, msg('Не удалось отозвать назначение.'), values);
  }
}
