import Link from 'next/link';
import { BuilderOffCard } from './builder-off-card';
import { unstable_rethrow } from 'next/navigation';
import { requireFeature } from '../../../../lib/vertical-guard';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { Alert, EmptyState } from '../../../../components/ui';
import { loadErrorProps } from '../../../../lib/load-error';
import {
  ApiError,
  branchesApi,
  marketingSiteApi,
  siteAssetsApi,
  siteEditorApi,
  type MarketingSiteCurrent,
  type SiteAssetView,
  type SiteConversationItem,
} from '../../../../lib/api';
import { deskShell } from '../../../../lib/desk-shell';
import { loadSiteFacts, loadSiteLocations, type SiteStatus } from '../../../../lib/site-facts';
import { siteFactsSource } from '../../../../lib/site-facts-source';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { BackToModules } from '../../parts';
import { SiteEditor } from './editor';
import { CreateSite } from './create-site';
import { SimpleSiteEditor } from './simple-editor';
import { SimpleSiteSetup } from './simple-setup';
import { publishTarget } from './vertical-status';
import { serverT } from '../../../../i18n/server';
import '../../marketing.css';

/**
 * «Маркетинг → Редактор сайта» (MKT9, MKT9.1; MKT9.2 лицензированный конструктор, `docs/marketing/licensed-site-builder-v0.md`).
 * Проект это филиал: один сайт навсегда, без названий и адресов на входе. Без действующей лицензии филиала всё видно,
 * но менять, просить ИИ и публиковать нельзя; проверяет это API, экран только не предлагает недоступное. Голова
 * черновика правится в браузере и сохраняется новой неизменяемой версией; публикация на своей странице (MKT7).
 *
 * SITE-1: первый экран открыт всем трём направлениям (филиал, факты, чат, дизайны). Пока API конструктора принимает
 * только гостиницу, у салона и ресторана `GET /marketing/site` отвечает отказом по направлению: экран показывает
 * первый экран без сайта, а создание сайта говорит словами сервера. После подключения API правок здесь не нужно.
 */
const NO_SITE = (): MarketingSiteCurrent => ({
  site: null,
  archived: false,
  locationName: null,
  builder: { access: 'off', status: null, activeUntil: null },
  instructions: null,
});

/** Отказ API по направлению (403 без кода): у салона и ресторана это «ещё не подключено», а не сбой страницы */
const verticalDenied = (vertical: WebVertical, e: unknown) => vertical !== 'HOSPITALITY' && e instanceof ApiError && e.status === 403;

function siteStatusOf(current: MarketingSiteCurrent): SiteStatus {
  if (!current.site) return current.archived ? 'ARCHIVED' : 'NONE';
  if (current.site.state === 'ARCHIVED') return 'ARCHIVED';
  return current.site.published ? 'PUBLISHED' : 'DRAFT';
}

export default async function SiteEditorPage({ searchParams }: { searchParams?: Promise<{ full?: string; chat?: string }> }) {
  // SITE-1: по умолчанию простой экран из пяти шагов; чат с ИИ (`?chat=1`) и полный редактор (`?full=1`) для своих
  const params = await searchParams;
  const full = params?.full === '1';
  const chat = params?.chat === '1';
  const me = await requireFeature('/marketing/site/editor');
  const vertical: WebVertical = me.context?.vertical ?? 'HOSPITALITY';
  const locationId = me.context?.locationId ?? null;
  const shell = await deskShell();
  const t = await serverT();
  const title = t('Редактор сайта');
  const brief = () =>
    siteEditorApi.brief().catch((e: unknown) => {
      unstable_rethrow(e);
      return null;
    });
  const loaded = await marketingSiteApi
    .current()
    .catch((e: unknown) => {
      unstable_rethrow(e);
      if (verticalDenied(vertical, e)) return { ...NO_SITE(), pending: true as const };
      // выбрана организация, а не филиал (409 «Выберите филиал»): сайт у каждого филиала свой
      if (e instanceof ApiError && e.status === 409) return { ...NO_SITE(), chooseLocation: true as const };
      throw e;
    })
    .then(async (current) => {
      if ('chooseLocation' in current)
        return { ok: true as const, current, draft: null, versions: [], bookmarks: [], conversation: [] as SiteConversationItem[], brief: null, assets: [] as SiteAssetView[] };
      if ('pending' in current)
        return { ok: true as const, current, draft: null, versions: [], bookmarks: [], conversation: [] as SiteConversationItem[], brief: null, assets: [] as SiteAssetView[] };
      if (!current.site)
        return { ok: true as const, current, draft: null, versions: [], bookmarks: [], conversation: [] as SiteConversationItem[], brief: await brief(), assets: [] as SiteAssetView[] };
      const [draft, versions, briefView, assets, conversation] = await Promise.all([
        siteEditorApi.draft(),
        siteEditorApi.versions(),
        brief(),
        siteAssetsApi
          .list()
          .then((l) => l.assets)
          .catch((e: unknown) => {
            unstable_rethrow(e);
            return [] as SiteAssetView[];
          }),
        siteEditorApi.conversation().then((r) => (r.ok ? r.data.items : [])),
      ]);
      return { ok: true as const, current, draft, versions: versions.versions, bookmarks: versions.bookmarks ?? [], conversation, brief: briefView, assets };
    })
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  if (!loaded.ok)
    return (
      <Page crumbs={<BackToModules />} title={title}>
        <LoadError testId="site-editor-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const { current } = loaded;
  if ('chooseLocation' in current)
    return (
      <Page crumbs={<BackToModules />} title={t('Сайт и SEO')}>
        <EmptyState data-testid="site-choose-location" title={t('Выберите филиал')}>
          {t('Сайт у каждого филиала свой. Выберите филиал в переключателе наверху, и здесь откроется его сайт.')}
        </EmptyState>
      </Page>
    );
  // у направления, которое API ещё не подключил, лицензию сервер не сообщает: решит отказ на «Создать сайт»
  const pending = 'pending' in current;
  const licensed = current.builder.access === 'active';
  const readOnly = shell.readOnly || (!pending && !licensed);
  const site = current.site;
  const locationName = current.locationName ?? loaded.brief?.input.identity.displayNameCandidate ?? t('филиала');

  if (current.archived && !site)
    return (
      <Page crumbs={<BackToModules />} title={title}>
        <Alert boxed data-testid="site-archived">
          {t('Сайт этого филиала в архиве. У филиала один сайт навсегда, нового не будет. История публикаций на странице')}{' '}
          <Link href="/marketing/site">{t('«Публикация»')}</Link>.
        </Alert>
      </Page>
    );

  if (!site || !loaded.draft?.version || !site.latest) {
    const source = siteFactsSource(locationId);
    // без выбранного филиала спрашивает сервер: настоящий API ответит «Выберите филиал», и это будет видно в карточке
    const [facts, locations] = await Promise.all([
      loadSiteFacts(locationId ?? '', vertical, source),
      loadSiteLocations(
        source,
        async () => (await branchesApi.list()).items.map((b) => ({ locationId: b.locationId, name: b.name, vertical: b.vertical })),
        { locationId, siteStatus: pending ? null : siteStatusOf(current) },
      ),
    ]);
    const name = facts.ok ? facts.data.location.name : locationName;
    return (
      <Page crumbs={<BackToModules />} title={t('Сайт и SEO')} width="full">
        {!pending && !licensed ? (
          // аудит 21.10.2026 п. 4: при неактивном конструкторе одна карточка с действием вместо формы с неактивными кнопками
          <BuilderOffCard
            locationName={name}
            expired={current.builder.access === 'expired'}
            canConnect={me.user?.platformAdmin === true}
            organizationId={me.user?.organizationId ?? null}
            locationId={locationId ?? (facts.ok ? facts.data.location.id : null)}
          />
        ) : (
          <CreateSite
            vertical={vertical}
            locationName={name}
            locationId={locationId ?? (facts.ok ? facts.data.location.id : null)}
            briefHash={loaded.brief?.briefHash ?? null}
            facts={facts}
            locations={locations}
            readOnly={readOnly}
          />
        )}
      </Page>
    );
  }
  if (!full && !chat) {
    const facts = await loadSiteFacts(locationId ?? '', vertical, siteFactsSource(locationId));
    return (
      <Page crumbs={<BackToModules />} title={t('Сайт и SEO')} width="full">
        {!licensed && (
          <Alert boxed data-testid="ed-license-off">
            <b>{t('Конструктор сайта не активен для этого филиала.')}</b>{' '}
            {t('Сайт виден, но менять и публиковать его нельзя. Подключить конструктор может главный администратор WETOP.')}
          </Alert>
        )}
        <SimpleSiteSetup
          vertical={vertical}
          base={{ id: site.latest.id, revision: site.latest.revision, spec: loaded.draft.version.spec }}
          published={site.published}
          siteUrl={site.url ?? null}
          locationName={facts.ok ? facts.data.location.name : locationName}
          facts={facts.ok ? facts.data : null}
          assets={loaded.assets}
          readOnly={readOnly}
          publish={publishTarget(vertical)}
        />
      </Page>
    );
  }
  if (!full)
    return (
      <Page crumbs={<BackToModules />} title={t('Сайт и SEO')} width="full">
        {!licensed && (
          <Alert boxed data-testid="ed-license-off">
            <b>{t('Конструктор сайта не активен для этого филиала.')}</b>{' '}
            {t('Сайт виден, но менять его и просить ИИ нельзя. Подключить конструктор может главный администратор WETOP.')}
          </Alert>
        )}
        <SimpleSiteEditor
          vertical={vertical}
          base={{ id: site.latest.id, revision: site.latest.revision, spec: loaded.draft.version.spec }}
          published={site.published}
          locationName={locationName}
          assets={loaded.assets}
          conversation={loaded.conversation}
          readOnly={readOnly}
        />
      </Page>
    );
  return (
    <Page
      crumbs={<BackToModules />}
      title={title}
      subtitle={t(
        'Расширенный режим: страницы, блоки, SEO и история версий. Сохранение создаёт новую версию черновика, на сайт она попадает после публикации.',
      )}
      actions={
        <Link className="btn btn--secondary" href="/marketing/site/editor" data-testid="ed-simple">
          {t('Простой режим')}
        </Link>
      }
    >
      <SiteEditor
        siteId={site.id}
        base={{ id: site.latest.id, revision: site.latest.revision, spec: loaded.draft.version.spec }}
        published={site.published}
        versions={loaded.versions}
        bookmarks={loaded.bookmarks}
        conversation={loaded.conversation}
        project={{ locationName, builder: current.builder, instructions: current.instructions }}
        categories={loaded.brief?.input.accommodations.map((a) => ({ code: a.categoryCode, name: a.name })) ?? []}
        assets={loaded.assets}
        readOnly={readOnly}
        publish={publishTarget(vertical)}
        vertical={vertical}
      />
    </Page>
  );
}
