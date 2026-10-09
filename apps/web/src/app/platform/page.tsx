import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { isMonth } from '@pms/domain';
import { Page } from '../../components/page';
import { RefreshButton } from '../../components/refresh-button';
import { LoadError } from '../../components/load-error';
import { Icon } from '../../components/icon';
import { Badge, Fact, Grid, LoadingState, Panel, SectionTitle, Stack, Table } from '../../components/ui';
import { branchesApi, platformApi, type PlatformOrganization } from '../../lib/api';
import { loadErrorProps } from '../../lib/load-error';
import {
  extensionFormDefaults,
  extensionLine,
  organizationSince,
  organizationStatusLine,
} from '../../lib/platform';
import { parseSort, parseVerticalFilter, parseView } from '../../lib/platform-overview';
import { hotelApi } from '../../lib/hotel-api';
import { BranchForm } from '../branches/form';
import { CreateOrganization } from './create-organization';
import { DataConnectionPanel } from './data-connection';
import { ExtensionForm, StatusForm } from './forms';
import { OrganizationsOverview, type OrganizationsQuery } from './organizations-view';
import { SiteBuilderLicense } from './site-builder';
import '../branches/branches.css';
import './organizations.css';

/**
 * «Платформа → Организации и филиалы» (DATA_MODEL §16, §18, ADR-083): организации платформы с бизнесами и филиалами,
 * цифры за месяц, создание организации, подписки и расширения. Только главному администратору: остальным API отвечает
 * 403, и страница так и говорит. Брони, гости, счета и переписка чужих организаций здесь не видны: в ответе API их нет
 * по построению.
 */
export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  const month = one(raw.month);
  const query: OrganizationsQuery = {
    vertical: parseVerticalFilter(one(raw.vertical)),
    sort: parseSort(one(raw.sort)),
    view: parseView(one(raw.view)),
    q: (one(raw.q) ?? '').slice(0, 100),
    month: month && isMonth(month) ? month : undefined,
  };
  const selected = one(raw.org) ?? '';
  return (
    <Page
      className="platform-page"
      width="full"
      title="Организации и филиалы"
      subtitle="Управляйте бизнесами, филиалами и объектами в одном месте."
      actions={
        <>
          <Link
            href={`/platform/export${query.month ? `?month=${query.month}` : ''}`}
            prefetch={false}
            className="btn btn--secondary"
            data-testid="platform-export"
          >
            <Icon name="download" width={16} height={16} /> Экспорт
          </Link>
          <RefreshButton />
          <CreateOrganization />
        </>
      }
    >
      <Suspense fallback={<LoadingState label="Загружаем организации…" />}>
        <OrganizationsOverview
          query={query}
          footer={
            <>
              <Suspense fallback={null}>
                <AddBranch />
              </Suspense>
              <Suspense fallback={<LoadingState label="Загружаем подписки…" />}>
                <Administration selected={selected} />
              </Suspense>
              <details className="panel">
                <summary>Состояние системы</summary>
                <Suspense fallback={<LoadingState label="Проверяем базу…" />}>
                  <SystemState />
                </Suspense>
              </details>
            </>
          }
        />
      </Suspense>
    </Page>
  );
}

/** Добавить филиал в организацию, в которую вошёл человек (API добавляет только в неё) */
async function AddBranch() {
  const loaded = await branchesApi.list().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!loaded?.canCreate) return null;
  return (
    <details className="panel platform-add-branch" id="add-branch">
      <summary>Добавить филиал в «{loaded.organization.name}»</summary>
      <BranchForm id={randomUUID()} />
    </details>
  );
}

/** Подписки и расширения: выбранная организация, форма оплаты, «ИИ-продавец», лицензии конструктора сайта */
async function Administration({ selected }: { selected: string }) {
  const loaded = await platformApi.organizations().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  // 403 и сбой загрузки уже показал обзор выше: здесь второго сообщения не нужно
  if (!loaded.ok) return null;
  const card = loaded.value.items.find((o) => o.id === selected);
  return (
    <details open={Boolean(card)} className="panel" id="org-admin">
      <summary>Подписки и администрирование</summary>
      <div className="org-admin">
        <p className="muted">
          Доступ организаций платформы и расширения. Выбор организации здесь не переключает рабочий филиал. Открыть
          организацию: «⋯» на её карточке, «Подписка и расширения».
        </p>
        {card && <OrganizationCard organization={card} />}
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
            {loaded.value.items.map((o) => {
              const status = organizationStatusLine(o);
              const seller = extensionLine(o.aiSeller);
              return (
                <tr key={o.id} aria-current={o.id === selected ? 'true' : undefined}>
                  <td>
                    <Link href={`/platform?org=${o.id}#org-admin`} prefetch={false}>
                      {o.name}
                    </Link>
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
      </div>
    </details>
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
function OrganizationCard({ organization: o }: { organization: PlatformOrganization }) {
  const seller = extensionLine(o.aiSeller);
  return (
    <Panel data-testid="platform-organization">
      <SectionTitle first>{o.name}</SectionTitle>
      <Grid min={180}>
        <Fact label="Состояние" value={organizationStatusLine(o).label} />
        <Fact label="Зарегистрирована" value={organizationSince(o.createdAt)} />
        <Fact label="Людей" value={String(o.members)} />
        <Fact label="ИИ-продавец" value={`${seller.label}, ${seller.detail}`} />
      </Grid>
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
