import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { ServicesBoard } from './board';
import '../beauty.css';

/**
 * «Услуги салона» (срез B3, ADR-140): каталог сети и то, что про него говорит филиал.
 * Право на правку это `rates` (в салоне список услуг и есть прайс, решение Q-253).
 */
export default async function BeautyServicesPage() {
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
      <Page title="Услуги салона">
        <LoadError testId="beauty-services-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const canEdit = mayAccess(shell.access, 'rates') && !shell.readOnly;
  return (
    <Page
      className="beauty-page"
      title="Услуги салона"
      subtitle="Каталог принадлежит сети, цену и доступность решает филиал."
    >
      <ServicesBoard
        items={loaded.value.items}
        locationCurrency={loaded.value.locationCurrency}
        canEdit={canEdit}
      />
    </Page>
  );
}
