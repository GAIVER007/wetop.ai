import { unstable_rethrow } from 'next/navigation';
import { requireVertical } from '../../../../lib/vertical-guard';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { loadErrorProps } from '../../../../lib/load-error';
import { siteAssetsApi } from '../../../../lib/api';
import { deskShell } from '../../../../lib/desk-shell';
import { MarketingCrumb } from '../../../website/parts';
import { AssetLibrary } from './board';
import '../../marketing.css';

/**
 * «Маркетинг → Изображения сайта» (MKT8, `docs/marketing/site-assets-v0.md`). Библиотека картинок филиала: загрузка,
 * подпись, удаление и импорт фото из менеджера каналов. Редактора страниц нет: выбрать картинку для секции можно будет
 * в MKT9. Право `settings` и строгий scope филиала проверяет API.
 */
export default async function SiteAssetsPage() {
  await requireVertical(['HOSPITALITY']);
  const shell = await deskShell();
  const loaded = await siteAssetsApi
    .list()
    .then((library) => ({ ok: true as const, library }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  const title = 'Изображения сайта';
  if (!loaded.ok)
    return (
      <Page crumbs={<MarketingCrumb />} title={title}>
        <LoadError testId="site-assets-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  return (
    <Page crumbs={<MarketingCrumb />} title={title} subtitle="Фото, логотип и значок сайта филиала.">
      <AssetLibrary library={loaded.library} readOnly={shell.readOnly} />
    </Page>
  );
}
