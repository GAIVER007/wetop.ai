import { BranchWorkspace } from '../branches/workspace';
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
import { ApiError, platformApi, type PlatformOrganization } from '../../lib/api';
import { loadErrorProps } from '../../lib/load-error';
import {
  extensionFormDefaults,
  extensionLine,
  organizationSince,
  organizationStatusLine,
} from '../../lib/platform';
import { ExtensionForm, StatusForm } from './forms';
import { DataConnectionPanel } from './data-connection';
import { hotelApi } from '../../lib/hotel-api';

/**
 * «Платформа → Организации» (DATA_MODEL §16, ADR-083): гостиницы платформы и расширение «ИИ-продавец». Только главному
 * администратору — остальным API отвечает 403, и страница так и говорит. Брони, гости, счета и переписка чужих
 * гостиниц здесь не видны: в ответе API их нет по построению.
 */
export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const selected = typeof query.org === 'string' ? query.org : '';
  return (
    <Page
      className="branches-page"
      width="full"
      title="Организации"
      subtitle="Ваши объекты и филиалы: добавление, управление и общая статистика."
      actions={<RefreshButton />}
    >
      <Suspense fallback={<LoadingState label="Загружаем организации…" />}>
        <Organizations selected={selected} query={query} />
      </Suspense>
    </Page>
  );
}

async function Organizations({
  selected,
  query,
}: {
  selected: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const loaded = await platformApi.organizations().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!loaded.ok) {
    if (loaded.error instanceof ApiError && loaded.error.status === 403)
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
    return <LoadError testId="platform-error" {...loadErrorProps(loaded.error)} />;
  }
  const items = loaded.value.items;
  const card = items.find((o) => o.id === selected);
  return (
    <Stack>
      <Suspense fallback={<LoadingState label="Загружаем филиалы…" />}>
        <BranchWorkspace query={query} createLabel="Добавить объект / филиал" />
      </Suspense>
      <details open={Boolean(card)} className="panel">
        <summary>Подписки и администрирование</summary>
        <p className="muted">
          Доступ организаций платформы и расширения. Выбор организации здесь не переключает рабочий
          филиал.
        </p>
        {card && <OrganizationCard organization={card} />}
        {items.length === 0 ? (
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
              {items.map((o) => {
                const status = organizationStatusLine(o);
                const seller = extensionLine(o.aiSeller);
                return (
                  <tr key={o.id} aria-current={o.id === selected ? 'true' : undefined}>
                    <td>
                      <Link href={`/platform?org=${o.id}`} prefetch={false}>
                        {o.name}
                      </Link>
                      <span className="sub"> · с {organizationSince(o.createdAt)}</span>
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
      </details>
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
    </Panel>
  );
}
