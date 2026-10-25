import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { RefreshButton } from '../../components/refresh-button';
import {
  EmptyState,
  Fact,
  Grid,
  LoadingState,
  Panel,
  SectionTitle,
  Stack,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { ApiError, branchesApi, platformApi, type PlatformOrganization } from '../../lib/api';
import { loadErrorProps } from '../../lib/load-error';
import { extensionFormDefaults, organizationSince } from '../../lib/platform';
import { sellerText, statusText } from './words';
import { serverT } from '../../i18n/server';
import { ArchiveForm, CreateOrganizationForm, ExtensionForm, OwnerLinkForm, RenameForm, StatusForm } from './forms';
import { ClientsTable } from './clients-table';
import { PlatformOverviewSection } from './overview';
import { OwnOrganization } from './own-organization';
import { SiteBuilderLicense } from './site-builder';
import { DataConnectionPanel } from './data-connection';
import { hotelApi } from '../../lib/hotel-api';
import { publicAuthUrl } from '../../lib/auth-entry';
import { unstable_rethrow } from 'next/navigation';

/**
 * «Настройки → Организации» (DATA_MODEL §16, ADR-083): своя организация с филиалами и их показателями, ниже все
 * организации платформы с подпиской и расширением «ИИ-продавец». Только главному администратору: остальным API
 * отвечает 403, и страница так и говорит. Брони, гости, счета и переписка чужих гостиниц здесь не видны: в ответе API
 * их нет по построению.
 */
export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const selected = typeof query.org === 'string' ? query.org : '';
  const showArchived = query.archived === '1';
  const t = await serverT();
  return (
    <Page
      className="branches-page"
      width="full"
      title={t('Организации')}
      subtitle={t('Ваша организация с филиалами и показателями, а ниже все организации платформы.')}
      actions={<RefreshButton />}
    >
      <Suspense fallback={<LoadingState label={t('Загружаем организации…')} />}>
        <Organizations selected={selected} showArchived={showArchived} query={query} />
      </Suspense>
    </Page>
  );
}

async function settle<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
}

async function Organizations({
  selected,
  showArchived,
  query,
}: {
  selected: string;
  showArchived: boolean;
  query: Record<string, string | string[] | undefined>;
}) {
  const [organizations, branches, overview] = await Promise.all([
    settle(platformApi.organizations()),
    settle(branchesApi.list()),
    settle(platformApi.overview()),
  ]);
  const t = await serverT();
  if (!organizations.ok) {
    if (organizations.error instanceof ApiError && organizations.error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title={t('Раздел главного администратора платформы')}
          data-testid="platform-forbidden"
        >
          {t('Организации и их расширения видит только главный администратор. Отметку ставит команда на сервере.')}
        </EmptyState>
      );
    return <LoadError testId="platform-error" {...loadErrorProps(organizations.error)} />;
  }
  const items = organizations.value.items;
  const card = items.find((o) => o.id === selected);
  const ownId = branches.ok ? branches.value.organization.id : '';
  // архив вместо удаления (ORG1, ADR-ORG1): организации в архиве скрыты, пока их не попросили показать
  const archivedCount = items.filter((o) => o.status === 'SUSPENDED').length;
  const visible = items.filter((o) => showArchived || o.status !== 'SUSPENDED' || o.id === selected);
  const archivedParam = showArchived ? '&archived=1' : '';
  const toggleHref = `/platform?${[selected && `org=${selected}`, !showArchived && 'archived=1']
    .filter(Boolean)
    .join('&')}`;
  return (
    <Stack>
      {overview.ok ? (
        <PlatformOverviewSection view={overview.value} today={new Date().toISOString().slice(0, 10)} />
      ) : (
        <LoadError testId="platform-overview-error" {...loadErrorProps(overview.error)} />
      )}
      {branches.ok ? (
        <Suspense fallback={<LoadingState label={t('Считаем показатели филиалов…')} />}>
          <OwnOrganization data={branches.value} query={query} selected={selected} />
        </Suspense>
      ) : (
        <LoadError testId="branches-load-error" {...loadErrorProps(branches.error)} />
      )}
      <Panel aria-labelledby="all-organizations-title">
        <SectionTitle first id="all-organizations-title">
          {t('Все организации платформы')}
        </SectionTitle>
        <details className="org-add">
          <summary className="btn">{t('Добавить организацию')}</summary>
          <div className="stack" data-testid="platform-add-organization">
            <CreateOrganizationForm />
            <p className="settings-note">
              {t('Организация может зарегистрироваться и сама:')}{' '}
              <Link href={publicAuthUrl('register')} prefetch={false}>
                {t('страница регистрации')}
              </Link>
              {t('. После регистрации она появится в этой таблице с пробным периодом.')}
            </p>
          </div>
        </details>
        {archivedCount > 0 && (
          <p>
            <Link href={toggleHref} prefetch={false}>
              {showArchived ? t('Скрыть архивные') : t('Показать архивные ({n})', { n: archivedCount })}
            </Link>
          </p>
        )}
        {visible.length === 0 ? (
          <EmptyState
            icon={<Icon name="inventory" width={32} height={32} />}
            title={t('Организаций нет')}
          >
            {t('Здесь появятся организации, зарегистрированные на платформе.')}
          </EmptyState>
        ) : (
          <ClientsTable items={visible} ownId={ownId} selected={selected} archivedParam={archivedParam} />
        )}
        {card && <OrganizationCard organization={card} own={card.id === ownId} />}
      </Panel>
      <details className="panel">
        <summary>{t('Состояние системы')}</summary>
        <Suspense fallback={<LoadingState label={t('Проверяем базу…')} />}>
          <SystemState />
        </Suspense>
      </details>
    </Stack>
  );
}

/**
 * Состояние системы (INT1, ADR-116): источник данных и база — внутренняя диагностика, не интеграция гостиницы.
 * Раньше жила на «Интеграциях» у каждого сотрудника; теперь её видит только главный администратор.
 */
async function SystemState() {
  const connection = await hotelApi.connection().catch(() => null);
  const t = await serverT();
  return (
    <section className="stack stack--sm" aria-labelledby="system-state-title">
      <SectionTitle id="system-state-title">{t('Состояние системы')}</SectionTitle>
      <DataConnectionPanel connection={connection} />
    </section>
  );
}

/** Выбранная организация: кто она и форма расширения «ИИ-продавец» */
async function OrganizationCard({
  organization: o,
  own,
}: {
  organization: PlatformOrganization;
  own: boolean;
}) {
  const t = await serverT();
  const seller = sellerText(o.aiSeller, t);
  const archived = o.status === 'SUSPENDED';
  return (
    <Panel id="organization" data-testid="platform-organization">
      <SectionTitle first>{o.name}</SectionTitle>
      <Grid min={180}>
        <Fact label={t('Состояние')} value={statusText(o, t)} />
        <Fact label={t('Зарегистрирована')} value={organizationSince(o.createdAt)} />
        <Fact label={t('Людей')} value={String(o.members)} />
        <Fact label={t('ИИ-продавец')} value={`${seller.label}, ${seller.detail}`} />
      </Grid>
      {o.ownerPending && !archived && (
        <>
          <SectionTitle>{t('Доступ владельца')}</SectionTitle>
          <OwnerLinkForm key={`owner-${o.id}`} organizationId={o.id} owner={o.owners[0] ?? t('организации')} />
        </>
      )}
      <SectionTitle>{t('Название')}</SectionTitle>
      <RenameForm key={o.id} organizationId={o.id} organizationName={o.name} />
      {!archived && (
        <>
          <SectionTitle>{t('Подписка')}</SectionTitle>
          <StatusForm
            key={`status-${o.id}`}
            organizationId={o.id}
            organizationName={o.name}
            status={o.status}
          />
          <SectionTitle>{t('ИИ-продавец')}</SectionTitle>
          {o.aiSeller.note && <p className="settings-note">{t('Заметка: {note}', { note: o.aiSeller.note })}</p>}
          <ExtensionForm
            key={o.id}
            organizationId={o.id}
            organizationName={o.name}
            initial={extensionFormDefaults(o.aiSeller)}
          />
          <SectionTitle>{t('Конструктор сайта')}</SectionTitle>
          <p className="settings-note">
            {t(
              'Лицензия на каждый гостиничный филиал. Без неё сайт филиала доступен только для чтения: менять его, просить ИИ и публиковать нельзя, опубликованный сайт продолжает работать. Пробному доступу нужен срок, у «Активировать» пустой срок значит бессрочно.',
            )}
          </p>
          <Suspense fallback={<LoadingState label={t('Загружаем филиалы…')} />}>
            <SiteBuilderLicenses organizationId={o.id} />
          </Suspense>
        </>
      )}
      <SectionTitle>{t('Архив')}</SectionTitle>
      <ArchiveForm
        key={`archive-${o.id}`}
        organizationId={o.id}
        organizationName={o.name}
        archived={archived}
        own={own}
      />
    </Panel>
  );
}

/** MKT9.2: гостиничные филиалы организации с лицензией конструктора сайта */
async function SiteBuilderLicenses({ organizationId }: { organizationId: string }) {
  const loaded = await platformApi.siteBuilder(organizationId).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok) return <LoadError testId="platform-site-builder-load-error" {...loadErrorProps(loaded.error)} />;
  const t = await serverT();
  if (loaded.value.items.length === 0) return <EmptyState title={t('У организации нет гостиничных филиалов')} />;
  return (
    <Stack data-testid="platform-site-builder">
      {loaded.value.items.map((l) => (
        <SiteBuilderLicense key={l.id} organizationId={organizationId} location={l} />
      ))}
    </Stack>
  );
}
