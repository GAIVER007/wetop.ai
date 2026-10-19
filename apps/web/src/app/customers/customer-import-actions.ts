'use server';

import type {
  CustomerImportChunkInput,
  CustomerImportStartInput,
  CustomerImportView,
} from '@pms/domain';
import { ApiError, authApi, beautyApi } from '../../lib/api';

export interface CustomerImportActionResult {
  error?: string;
  item?: CustomerImportView;
  items?: CustomerImportView[];
}

const changedBusiness = (): CustomerImportActionResult => ({
  error: 'Бизнес изменён. Закройте импорт и откройте его в текущем салоне.',
});

const failed = (error: unknown, fallback: string): CustomerImportActionResult => ({
  error: error instanceof ApiError && error.status >= 400 && error.status < 500
    ? error.message
    : fallback,
});

async function currentBusiness(expectedBusinessId: string): Promise<CustomerImportActionResult | null> {
  try {
    const { context } = await authApi.me();
    return expectedBusinessId && context?.businessId === expectedBusinessId ? null : changedBusiness();
  } catch {
    return { error: 'Не удалось проверить текущий бизнес. Закройте импорт и попробуйте снова.' };
  }
}

export async function listCustomerImports(expectedBusinessId: string): Promise<CustomerImportActionResult> {
  const scopeError = await currentBusiness(expectedBusinessId);
  if (scopeError) return scopeError;
  try {
    return await beautyApi.listCustomerImports();
  } catch (error) {
    return failed(error, 'Не удалось загрузить историю импортов.');
  }
}

export async function getCustomerImport(
  expectedBusinessId: string,
  id: string,
): Promise<CustomerImportActionResult> {
  const scopeError = await currentBusiness(expectedBusinessId);
  if (scopeError) return scopeError;
  try {
    return { item: await beautyApi.getCustomerImport(id) };
  } catch (error) {
    return failed(error, 'Не удалось обновить состояние импорта.');
  }
}

export async function startCustomerImport(
  expectedBusinessId: string,
  input: CustomerImportStartInput,
): Promise<CustomerImportActionResult> {
  const scopeError = await currentBusiness(expectedBusinessId);
  if (scopeError) return scopeError;
  try {
    return { item: await beautyApi.startCustomerImport(input) };
  } catch (error) {
    return failed(error, 'Не удалось начать импорт. Обновите состояние перед повтором.');
  }
}

export async function uploadCustomerImportRows(
  expectedBusinessId: string,
  id: string,
  chunk: CustomerImportChunkInput,
): Promise<CustomerImportActionResult> {
  const scopeError = await currentBusiness(expectedBusinessId);
  if (scopeError) return scopeError;
  try {
    return { item: await beautyApi.uploadCustomerImportRows(id, chunk) };
  } catch (error) {
    return failed(error, 'Не удалось подтвердить загрузку части файла. Обновите состояние перед повтором.');
  }
}

export async function submitCustomerImport(
  expectedBusinessId: string,
  id: string,
): Promise<CustomerImportActionResult> {
  const scopeError = await currentBusiness(expectedBusinessId);
  if (scopeError) return scopeError;
  try {
    return { item: await beautyApi.submitCustomerImport(id) };
  } catch (error) {
    return failed(error, 'Не удалось подтвердить импорт. Обновите состояние перед повтором.');
  }
}

export async function undoCustomerImport(
  expectedBusinessId: string,
  id: string,
): Promise<CustomerImportActionResult> {
  const scopeError = await currentBusiness(expectedBusinessId);
  if (scopeError) return scopeError;
  try {
    return { item: await beautyApi.undoCustomerImport(id) };
  } catch (error) {
    return failed(error, 'Не удалось подтвердить отмену. Обновите состояние перед повтором.');
  }
}
