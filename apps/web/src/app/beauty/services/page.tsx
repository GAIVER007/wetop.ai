import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { mayBeautyAccess } from '../../../lib/navigation';
import { ServicesBoard } from './board';
import '../beauty.css';

/**
 * «Услуги» (срез B3, ADR-141): каталог сети и то, что про него говорит филиал.
 * Право на правку это `rates` (в салоне список услуг и есть прайс, решение Q-253).
 */
export default async function BeautyServicesPage() {
  await requireFeature('/beauty/services');
  const shell = await deskShell();
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
      <Page title="Услуги">
        <LoadError testId="beauty-services-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const may = (action: 'create' | 'update' | 'delete') =>
    !shell.readOnly &&
    mayBeautyAccess(shell.access, 'services', action, { legacy: 'rates' });
  return (
    <Page
      className="beauty-page"
      title="Услуги"
      subtitle="Каталог услуг и условия в выбранном филиале."
    >
      <p>
        <Link href="/register/setup">Вернуться к настройке салона</Link>
      </p>
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
