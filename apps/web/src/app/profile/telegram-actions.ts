'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, staffTelegramApi, type StaffTelegramStatus } from '../../lib/api';
import { serverT } from '../../i18n/server';

/**
 * «Профиль → Уведомления» (STAFF-TG-20261020): действия своего подключения к боту WETOP. Код привязки возвращается
 * только этому экрану (ссылку человек открывает сам) и нигде не хранится; токен бота стойка не видит.
 */
export interface TelegramActionResult {
  error: string | null;
  message: string | null;
  status?: StaffTelegramStatus;
  link?: { url: string; code: string; expiresAt: string };
}

const describe = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));

export async function telegramCodeAction(): Promise<TelegramActionResult> {
  try {
    const r = await staffTelegramApi.code();
    return { error: null, message: null, link: { url: r.link, code: r.code, expiresAt: r.expiresAt } };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function telegramRefreshAction(): Promise<TelegramActionResult> {
  try {
    return { error: null, message: null, status: await staffTelegramApi.status() };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function telegramSiteBookingsAction(on: boolean): Promise<TelegramActionResult> {
  try {
    const status = await staffTelegramApi.setSiteBookings(on);
    revalidatePath('/profile');
    const t = await serverT();
    return { error: null, message: on ? t('Брони с сайта будут приходить в Telegram') : t('Брони с сайта больше не приходят'), status };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function telegramDisconnectAction(): Promise<TelegramActionResult> {
  try {
    const status = await staffTelegramApi.disconnect();
    revalidatePath('/profile');
    const t = await serverT();
    return { error: null, message: t('Telegram отключён'), status };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function telegramTestAction(): Promise<TelegramActionResult> {
  try {
    await staffTelegramApi.test();
    const t = await serverT();
    return { error: null, message: t('Проверочное сообщение отправлено в Telegram') };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}
