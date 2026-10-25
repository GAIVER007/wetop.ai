import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi, sharedOnboardingApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { mayBeautyAccess } from '../../../lib/navigation';
import { ServicesBoard } from './board';
import { serverT } from '../../../i18n/server';
import '../beauty.css';

/**
 * «Услуги» (срез B3, ADR-141): каталог сети и то, что про него говорит филиал.
 * Право на правку это `rates` (в салоне список услуг и есть прайс, решение Q-253).
 */
/** Настройка салона ещё идёт: ссылка «Вернуться к настройке» нужна только тогда (аудит 21.10.2026 п.21) */
async function setupInProgress(): Promise<boolean> {
  try {
    const state = await sharedOnboardingApi.status();
    return state.vertical === 'BEAUTY' && !state.completedAt;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

export default async function BeautyServicesPage() {
  await requireFeature('/beauty/services');
  const t = await serverT();
  const [shell, setup] = await Promise.all([deskShell(), setupInProgress()]);
  const loaded = await beautyApi.services().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title={t('Услуги')}>
        <LoadError testId="beauty-services-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const may = (action: 'create' | 'update' | 'delete') =>
    !shell.readOnly &&
    mayBeautyAccess(shell.access, 'services', action, { legacy: 'rates' });
  return (
    <Page
      className="beauty-page"
      title={t('Услуги')}
      subtitle={t('Каталог услуг и условия в выбранном филиале.')}
    >
      {setup && (
        <p>
          <Link href="/register/setup">{t('Вернуться к настройке салона')}</Link>
        </p>
      )}
      <ServicesBoard
        key={loaded.value.locationId ?? 'catalog'}
        scopeKey={loaded.value.locationId ?? ''}
        items={loaded.value.items}
        locationCurrency={loaded.value.locationCurrency}
        canCreate={may('create')}
        canUpdate={may('update')}
        canDelete={may('delete')}
      />
    </Page>
  );
}
