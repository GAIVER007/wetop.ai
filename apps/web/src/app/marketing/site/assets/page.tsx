import { unstable_rethrow } from 'next/navigation';
import { requireFeature } from '../../../../lib/vertical-guard';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { loadErrorProps } from '../../../../lib/load-error';
import { siteAssetsApi } from '../../../../lib/api';
import { deskShell } from '../../../../lib/desk-shell';
import { MarketingCrumb } from '../../../website/parts';
import { AssetLibrary } from './board';
import { serverT } from '../../../../i18n/server';
import '../../marketing.css';

/**
 * «Маркетинг → Изображения сайта» (MKT8, `docs/marketing/site-assets-v0.md`). Библиотека картинок филиала: загрузка,
 * подпись, удаление и импорт фото из менеджера каналов. Редактора страниц нет: выбрать картинку для секции можно будет
 * в MKT9. Право `marketing` и строгий scope филиала проверяет API.
 */
export default async function SiteAssetsPage() {
  // редактор открыт трём направлениям, значит, и его изображения (Д10); импорт из Channex только у гостиницы
  const me = await requireFeature('/marketing/site/assets');
  const hotel = (me.context?.vertical ?? 'HOSPITALITY') === 'HOSPITALITY';
  const shell = await deskShell();
  const loaded = await siteAssetsApi
    .list()
    .then((library) => ({ ok: true as const, library }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  const t = await serverT();
  const title = t('Изображения сайта');
  if (!loaded.ok)
    return (
      <Page crumbs={<MarketingCrumb />} title={title}>
        <LoadError testId="site-assets-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  return (
    <Page crumbs={<MarketingCrumb />} title={title} subtitle={t('Фото, логотип и значок сайта филиала.')}>
      <AssetLibrary library={loaded.library} readOnly={shell.readOnly} channex={hotel} />
    </Page>
  );
}
