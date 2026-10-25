import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { sharedOnboardingApi } from '../../../lib/api';
import { serverT } from '../../../i18n/server';

/**
 * «Вернуться к настройке салона» (аудит живого сайта 21.10.2026, п. 17): ссылка висела всегда, даже когда
 * настройка давно пройдена. Теперь она видна только по пути из чек-листа (`?onboarding=1`) или пока настройка
 * салона не завершена. Сводку настройки не удалось прочитать: ссылки нет, страница работает как обычно.
 */
export async function salonSetupPending(requested: boolean): Promise<boolean> {
  if (requested) return true;
  return Promise.resolve()
    .then(() => sharedOnboardingApi.status())
    .then(
      (state) => state.vertical === 'BEAUTY' && !state.completedAt,
      (error: unknown) => {
        unstable_rethrow(error);
        return false;
      },
    );
}

export async function SalonSetupLink() {
  const t = await serverT();
  return (
    <p>
      <Link href="/register/setup">{t('Вернуться к настройке салона')}</Link>
    </p>
  );
}
