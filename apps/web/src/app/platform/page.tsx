import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { RefreshButton } from '../../components/refresh-button';
import {
  Badge,
  EmptyState,
  Fact,
  Grid,
  LoadingState,
  Panel,
  SectionTitle,
  Stack,
  Table,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { ApiError, branchesApi, platformApi, type PlatformOrganization } from '../../lib/api';
import { loadErrorProps } from '../../lib/load-error';
import {
  extensionFormDefaults,
  extensionLine,
  organizationSince,
  organizationStatusLine,
} from '../../lib/platform';
import { ArchiveForm, ExtensionForm, RenameForm, StatusForm } from './forms';
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
  return (
    <Page
      className="branches-page"
      width="full"
      title="Организации"
      subtitle="Ваша организация с филиалами и показателями, а ниже все организации платформы."
      actions={<RefreshButton />}
    >
      <Suspense fallback={<LoadingState label="Загружаем организации…" />}>
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
  const [organizations, branches] = await Promise.all([
    settle(platformApi.organizations()),
    settle(branchesApi.list()),
  ]);
  if (!organizations.ok) {
    if (organizations.error instanceof ApiError && organizations.error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title="Раздел главного администратора платформы"
          data-testid="platform-forbidden"
        >
          Организации и их расширения видит только главный администратор. Отметку ставит команда на
          сервере.
        </EmptyState>
      );
    return <LoadError testId="platform-error" {...loadErrorProps(organizations.error)} />;
  }
  const items = organizations.value.items;
  const card = items.find((o) => o.id === selected);
  const ownId = branches.ok ? branches.value.organization.id : '';
  // архив вместо удаления (ORG1, ADR-154): организации в архиве скрыты, пока их не попросили показать
  const archivedCount = items.filter((o) => o.status === 'SUSPENDED').length;
  const visible = items.filter((o) => showArchived || o.status !== 'SUSPENDED' || o.id === selected);
  const archivedParam = showArchived ? '&archived=1' : '';
  const toggleHref = `/platform?${[selected && `org=${selected}`, !showArchived && 'archived=1']
    .filter(Boolean)
    .join('&')}`;
  return (
    <Stack>
      {branches.ok ? (
        <Suspense fallback={<LoadingState label="Считаем показатели филиалов…" />}>
          <OwnOrganization data={branches.value} query={query} selected={selected} />
        </Suspense>
      ) : (
        <LoadError testId="branches-load-error" {...loadErrorProps(branches.error)} />
      )}
      <Panel aria-labelledby="all-organizations-title">
        <SectionTitle first id="all-organizations-title">
          Все организации платформы
        </SectionTitle>
        <details className="org-add">
          <summary className="btn">Добавить организацию</summary>
          <div className="stack" data-testid="platform-add-organization">
            <p>
              Организация регистрируется сама: отправьте её владельцу ссылку. Он заводит аккаунт, выбирает
              направление и подтверждает почту, после этого организация появится в этой таблице с пробным
              периодом.
            </p>
            <p>
              <Link href={publicAuthUrl('register')} prefetch={false}>
                Страница регистрации
              </Link>
            </p>
          </div>
        </details>
        {archivedCount > 0 && (
          <p>
            <Link href={toggleHref} prefetch={false}>
              {showArchived ? 'Скрыть архивные' : `Показать архивные (${archivedCount})`}
            </Link>
          </p>
        )}
        {visible.length === 0 ? (
          <EmptyState
            icon={<Icon name="inventory" width={32} height={32} />}
            title="Организаций нет"
          >
            Здесь появятся гостиницы, зарегистрированные на платформе.
          </EmptyState>
        ) : (
          <Table aria-label="Организации платформы" data-testid="platform-organizations">
            <thead>
              <tr>
                <th>Организация</th>
                <th>Состояние</th>
                <th>Людей</th>
                <th>Владелец</th>
                <th>ИИ-продавец</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const status = organizationStatusLine(o);
                const seller = extensionLine(o.aiSeller);
                return (
                  <tr key={o.id} aria-current={o.id === selected ? 'true' : undefined}>
                    <td>
                      <Link href={`/platform?org=${o.id}${archivedParam}#organization`} prefetch={false}>
                        {o.name}
                      </Link>
                      {o.id === ownId && (
                        <>
                          {' '}
                          <Badge tone="info">Ваша</Badge>
                        </>
                      )}
                      <span className="sub">, с {organizationSince(o.createdAt)}</span>
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td>{o.members}</td>
                    <td>{o.owners.length > 0 ? o.owners.join(', ') : 'Не указан'}</td>
                    <td>
                      <Badge tone={seller.tone}>{seller.label}</Badge>
                      <span className="sub"> {seller.detail}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {card && <OrganizationCard organization={card} own={card.id === ownId} />}
      </Panel>
      <details className="panel">
        <summary>Состояние системы</summary>
        <Suspense fallback={<LoadingState label="Проверяем базу…" />}>
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
  return (
    <section className="stack stack--sm" aria-labelledby="system-state-title">
      <SectionTitle id="system-state-title">Состояние системы</SectionTitle>
      <DataConnectionPanel connection={connection} />
    </section>
  );
}

/** Выбранная организация: кто она и форма расширения «ИИ-продавец» */
function OrganizationCard({
  organization: o,
  own,
}: {
  organization: PlatformOrganization;
  own: boolean;
}) {
  const seller = extensionLine(o.aiSeller);
  const archived = o.status === 'SUSPENDED';
  return (
    <Panel id="organization" data-testid="platform-organization">
      <SectionTitle first>{o.name}</SectionTitle>
      <Grid min={180}>
        <Fact label="Состояние" value={organizationStatusLine(o).label} />
        <Fact label="Зарегистрирована" value={organizationSince(o.createdAt)} />
        <Fact label="Людей" value={String(o.members)} />
        <Fact label="ИИ-продавец" value={`${seller.label}, ${seller.detail}`} />
      </Grid>
      <SectionTitle>Название</SectionTitle>
      <RenameForm key={o.id} organizationId={o.id} organizationName={o.name} />
      {!archived && (
        <>
          <SectionTitle>Подписка</SectionTitle>
          <StatusForm
            key={`status-${o.id}`}
            organizationId={o.id}
            organizationName={o.name}
            status={o.status}
          />
          <SectionTitle>ИИ-продавец</SectionTitle>
          {o.aiSeller.note && <p className="settings-note">Заметка: {o.aiSeller.note}</p>}
          <ExtensionForm
            key={o.id}
            organizationId={o.id}
            organizationName={o.name}
            initial={extensionFormDefaults(o.aiSeller)}
          />
          <SectionTitle>Конструктор сайта</SectionTitle>
          <p className="settings-note">
            Лицензия на каждый гостиничный филиал. Без неё сайт филиала доступен только для чтения: менять его, просить ИИ и
            публиковать нельзя, опубликованный сайт продолжает работать. Пробному доступу нужен срок, у «Активировать»
            пустой срок значит бессрочно.
          </p>
          <Suspense fallback={<LoadingState label="Загружаем филиалы…" />}>
            <SiteBuilderLicenses organizationId={o.id} />
          </Suspense>
        </>
      )}
      <SectionTitle>Архив</SectionTitle>
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
  if (loaded.value.items.length === 0) return <p className="muted">У организации нет гостиничных филиалов.</p>;
  return (
    <Stack data-testid="platform-site-builder">
      {loaded.value.items.map((l) => (
        <SiteBuilderLicense key={l.id} organizationId={organizationId} location={l} />
      ))}
    </Stack>
  );
}
