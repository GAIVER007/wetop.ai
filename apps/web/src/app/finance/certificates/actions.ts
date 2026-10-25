'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, beautyApi, type BeautyGiftCertificate } from '../../../lib/api';
import { serverT } from '../../../i18n/server';

/** Продажа сертификата: одна попытка = один ключ повтора (передаёт форма) */
export async function sellCertificate(input: {
  amountMinor: number;
  method: string;
  months: number;
  idempotencyKey: string;
}): Promise<{ data: BeautyGiftCertificate } | { error: string }> {
  try {
    const data = await beautyApi.sellGiftCertificate(input);
    revalidatePath('/finance/certificates');
    revalidatePath('/cashbox');
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    const t = await serverT();
    return { error: error instanceof ApiError ? error.message : t('Не удалось продать сертификат. Проверьте кассу.') };
  }
}

export async function findCertificate(code: string): Promise<{ data: BeautyGiftCertificate } | { error: string }> {
  try {
    return { data: await beautyApi.giftCertificateLookup(code) };
  } catch (error) {
    unstable_rethrow(error);
    const t = await serverT();
    return { error: error instanceof ApiError ? error.message : t('Не удалось проверить сертификат') };
  }
}
