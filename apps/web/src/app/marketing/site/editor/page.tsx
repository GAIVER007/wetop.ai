import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { requireVertical } from '../../../../lib/vertical-guard';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { Alert } from '../../../../components/ui';
import { loadErrorProps } from '../../../../lib/load-error';
import { marketingSiteApi, siteAssetsApi, siteEditorApi, type SiteAssetView, type SiteConversationItem } from '../../../../lib/api';
import { deskShell } from '../../../../lib/desk-shell';
import { BackToModules } from '../../parts';
import { SiteEditor } from './editor';
import { CreateSite } from './create-site';
import '../../marketing.css';

/**
 * «Маркетинг → Редактор сайта» (MKT9, MKT9.1; MKT9.2 лицензированный конструктор, `docs/marketing/licensed-site-builder-v0.md`).
 * Проект это филиал: один сайт навсегда, без названий и адресов на входе. Без действующей лицензии филиала всё видно,
 * но менять, просить ИИ и публиковать нельзя; проверяет это API, экран только не предлагает недоступное. Голова
 * черновика правится в браузере и сохраняется новой неизменяемой версией; публикация на своей странице (MKT7).
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
  const licensed = current.builder.access === 'active';
  const readOnly = shell.readOnly || !licensed;
  const site = current.site;
  const locationName = current.locationName ?? loaded.brief?.input.identity.displayNameCandidate ?? 'филиала';

  if (current.archived && !site)
    return (
      <Page crumbs={<BackToModules />} title={title}>
        <Alert boxed data-testid="site-archived">
          Сайт этого филиала в архиве. У филиала один сайт навсегда, нового не будет. История публикаций на странице{' '}
          <Link href="/marketing/site">«Публикация»</Link>.
        </Alert>
      </Page>
    );

  if (!site || !loaded.draft?.version || !site.latest) {
    const input = loaded.brief?.input;
    const facts = input
      ? [
          input.accommodations.length ? `Номера: ${input.accommodations.map((a) => a.name).join(', ')}` : null,
          input.identity.address ? `Адрес: ${input.identity.address}` : null,
          input.identity.phone ? `Телефон: ${input.identity.phone}` : null,
          input.identity.email ? `Почта: ${input.identity.email}` : null,
          input.stay?.checkInTime ? `Заезд с ${input.stay.checkInTime}` : null,
        ].filter((f): f is string => !!f)
      : [];
    return (
      <Page crumbs={<BackToModules />} title={title}>
        {!licensed && (
          <Alert boxed data-testid="ed-license-off">
            <b>Конструктор сайта не активен для этого филиала.</b> Создать сайт и просить ИИ нельзя. Подключить конструктор может главный
            администратор WETOP.
          </Alert>
        )}
        <CreateSite locationName={locationName} briefHash={loaded.brief?.briefHash ?? null} facts={facts} readOnly={readOnly} />
      </Page>
    );
  }
  return (
    <Page
      crumbs={<BackToModules />}
      title={title}
      subtitle="Попросите ИИ или поправьте сайт сами. Сохранение создаёт новую версию черновика, на сайт она попадает после публикации."
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
      />
    </Page>
  );
}
