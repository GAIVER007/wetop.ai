import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { requireVertical } from '../../../../lib/vertical-guard';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { loadErrorProps } from '../../../../lib/load-error';
import { EmptyState } from '../../../../components/ui';
import { suggestMarketingSlug } from '@pms/domain';
import { marketingSiteApi, siteAssetsApi, siteEditorApi, type SiteAssetView } from '../../../../lib/api';
import { deskShell } from '../../../../lib/desk-shell';
import { MarketingCrumb } from '../../../website/parts';
import { SiteEditor } from './editor';
import { CreateSite } from './create-site';
import '../../marketing.css';

/**
 * «Маркетинг → Редактор сайта» (MKT9, `docs/marketing/site-editor-v0.md`). Голова черновика правится формами в
 * браузере и сохраняется новой неизменяемой версией; публикация не меняется (её делает страница публикации MKT7).
 * Право `settings` и строгий scope филиала проверяет API. Категории берутся из брифа точного объекта, картинки из
 * библиотеки MKT8; если они не загрузились, редактор всё равно открывается, только без выбора.
 */
export default async function SiteEditorPage() {
  await requireVertical(['HOSPITALITY']);
  const shell = await deskShell();
  const title = 'Редактор сайта';
  const brief = () =>
    siteEditorApi.brief().catch((e: unknown) => {
      unstable_rethrow(e);
      return null;
    });
  const loaded = await marketingSiteApi
    .current()
    .then(async (current) => {
      if (!current.site) return { ok: true as const, current, draft: null, versions: [], brief: await brief(), assets: [] as SiteAssetView[] };
      const [draft, versions, briefView, assets] = await Promise.all([
        siteEditorApi.draft(),
        siteEditorApi.versions().then((r) => r.versions),
        brief(),
        siteAssetsApi
          .list()
          .then((l) => l.assets)
          .catch((e: unknown) => {
            unstable_rethrow(e);
            return [] as SiteAssetView[];
          }),
      ]);
      return { ok: true as const, current, draft, versions, brief: briefView, assets };
    })
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  if (!loaded.ok)
    return (
      <Page crumbs={<MarketingCrumb />} title={title}>
        <LoadError testId="site-editor-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const links = (
    <>
      <Link className="btn btn--secondary" href="/marketing/site" data-testid="editor-publication-link">
        Публикация
      </Link>
      <Link className="btn btn--secondary" href="/marketing/site/assets" data-testid="editor-assets-link">
        Изображения
      </Link>
    </>
  );
  const site = loaded.current.site;
  const name = loaded.brief?.input.identity.displayNameCandidate ?? '';
  if (!site || !loaded.draft?.version || !site.latest)
    return (
      <Page crumbs={<MarketingCrumb />} title={title} actions={site ? links : undefined}>
        <CreateSite
          hasSite={!!site}
          name={name || 'Сайт гостиницы'}
          suggestedSlug={suggestMarketingSlug(name)}
          briefHash={loaded.brief?.briefHash ?? null}
          readOnly={shell.readOnly}
        />
      </Page>
    );
  return (
    <Page crumbs={<MarketingCrumb />} title={title} subtitle="Страницы и секции сайта; сохранение создаёт новую версию черновика." actions={links}>
      <SiteEditor
        base={{ id: site.latest.id, revision: site.latest.revision, spec: loaded.draft.version.spec }}
        published={site.published}
        versions={loaded.versions}
        categories={loaded.brief?.input.accommodations.map((a) => ({ code: a.categoryCode, name: a.name })) ?? []}
        assets={loaded.assets}
        readOnly={shell.readOnly}
      />
    </Page>
  );
}
