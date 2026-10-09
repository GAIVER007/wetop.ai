import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import {
  PLATFORM_TIMEZONE,
  lastMonths,
  todayAt,
  type OverviewBranch,
  type OverviewOrganization,
  type OverviewVertical,
  type PlatformOverview,
} from '@pms/domain';
import { Chip, ChipGroup } from '../../components/chip';
import { Icon, type IconName } from '../../components/icon';
import { LoadError } from '../../components/load-error';
import { Badge, EmptyState, LoadingState, Stack, Stat, Table } from '../../components/ui';
import { ShareBar } from '../../components/share-bar';
import { deltaPercent as deltaWords } from '../../lib/dashboard-format';
import { loadErrorProps } from '../../lib/load-error';
import { ApiError, platformApi, type BranchItem } from '../../lib/api';
import {
  SORT_LABEL,
  VERTICAL_NAME,
  VERTICAL_ORDER,
  VERTICAL_PLURAL,
  branchFigure,
  distribution,
  monthName,
  organizationFigures,
  organizationPlace,
  overviewTotals,
  plural,
  primaryVertical,
  relativeAgo,
  revenueLine,
  selectOrganizations,
  verticalCounts,
  type OrganizationSort,
  type OrganizationView,
  type VerticalFilter,
} from '../../lib/platform-overview';
import { organizationStatusLine } from '../../lib/platform';
import { selectBranch } from '../branches/actions';
import { Dynamics } from './dynamics';
import { OrganizationMenu } from './organization-menu';
import { unstable_rethrow } from 'next/navigation';
import './organizations.css';

export interface OrganizationsQuery {
  vertical: VerticalFilter;
  sort: OrganizationSort;
  view: OrganizationView;
  q: string;
  month: string | undefined;
  /** показывать организации в архиве (`SUSPENDED`) */
  archived: boolean;
}

const VERTICAL_ICON: Record<OverviewVertical, IconName> = {
  HOSPITALITY: 'inventory',
  BEAUTY: 'salon',
  FOOD_SERVICE: 'restaurant',
};
/** Цвета долей: те же, что у обложек карточек */
const VERTICAL_COLOR: Record<OverviewVertical, string> = {
  HOSPITALITY: 'var(--primary)',
  BEAUTY: 'var(--purple)',
  FOOD_SERVICE: 'var(--warning)',
};

/** Адрес страницы с одним изменённым условием; умолчания в адрес не пишем */
export function organizationsHref(current: OrganizationsQuery, patch: Partial<OrganizationsQuery>): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.vertical !== 'all') params.set('vertical', next.vertical);
  if (next.sort !== 'date') params.set('sort', next.sort);
  if (next.view !== 'cards') params.set('view', next.view);
  if (next.q) params.set('q', next.q);
  if (next.month) params.set('month', next.month);
  if (next.archived) params.set('archived', '1');
  const text = params.toString();
  return text ? `/platform?${text}` : '/platform';
}

export async function OrganizationsOverview({
  query,
  footer,
}: {
  query: OrganizationsQuery;
  /** Блоки под обзором: показываются только если обзор загрузился (то есть вошёл главный администратор) */
  footer?: ReactNode;
}) {
  const loaded = await platformApi.overview(query.month).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok) {
    if (loaded.error instanceof ApiError && loaded.error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title="Раздел главного администратора платформы"
          data-testid="platform-forbidden"
        >
          Организации и их расширения видит только главный администратор. Отметку ставит команда на сервере.
        </EmptyState>
      );
    return <LoadError testId="platform-error" {...loadErrorProps(loaded.error)} />;
  }
  const all = loaded.value;
  // архив вместо удаления: организации в архиве скрыты из итогов и карточек, пока их не попросили показать
  const archivedCount = all.organizations.filter((o) => o.status === 'SUSPENDED').length;
  const data: PlatformOverview = query.archived
    ? all
    : { ...all, organizations: all.organizations.filter((o) => o.status !== 'SUSPENDED') };
  const { branchesByLocation, currentOrganizationId } = await currentOrganization();
  const shown = selectOrganizations(data.organizations, query.vertical, query.sort, query.q);
  const counts = verticalCounts(data.organizations);
  return (
    <Stack>
      <Tiles data={data} />
      <div className="org-toolbar">
        <ChipGroup as="nav" label="Направления" className="org-toolbar__tabs">
          <Chip href={organizationsHref(query, { vertical: 'all' })} selected={query.vertical === 'all'} count={counts.all}>
            Все
          </Chip>
          {VERTICAL_ORDER.map((v) => (
            <Chip
              key={v}
              href={organizationsHref(query, { vertical: v })}
              selected={query.vertical === v}
              count={counts[v]}
            >
              {VERTICAL_PLURAL[v]}
            </Chip>
          ))}
        </ChipGroup>
        <div className="org-toolbar__tools">
          <span className="org-toolbar__label" aria-hidden="true">Период:</span>
          <ChipGroup as="nav" label="Период" className="org-toolbar__tabs">
            <Chip
              href={organizationsHref(query, { month: undefined })}
              selected={!query.month || query.month === data.period.month}
              size="sm"
            >
              {query.month && query.month !== todayAt(PLATFORM_TIMEZONE).slice(0, 7) ? monthName(data.period.month) : 'Этот месяц'}
            </Chip>
            <Chip
              href={organizationsHref(query, { month: lastMonths(todayAt(PLATFORM_TIMEZONE).slice(0, 7), 2)[0]! })}
              selected={query.month === lastMonths(todayAt(PLATFORM_TIMEZONE).slice(0, 7), 2)[0]}
              size="sm"
            >
              Прошлый месяц
            </Chip>
          </ChipGroup>
          <span className="org-toolbar__label" aria-hidden="true">Порядок:</span>
          <ChipGroup as="nav" label="Порядок" className="org-toolbar__tabs">
            {(Object.keys(SORT_LABEL) as OrganizationSort[]).map((s) => (
              <Chip key={s} href={organizationsHref(query, { sort: s })} selected={query.sort === s} size="sm">
                {SORT_LABEL[s]}
              </Chip>
            ))}
          </ChipGroup>
          {archivedCount > 0 && (
            <Chip href={organizationsHref(query, { archived: !query.archived })} selected={query.archived} size="sm">
              Архив
            </Chip>
          )}
          <span className="org-toolbar__label" aria-hidden="true">Вид:</span>
          <ChipGroup as="nav" label="Вид" className="org-toolbar__tabs">
            <Chip href={organizationsHref(query, { view: 'cards' })} selected={query.view === 'cards'} size="sm">
              Карточки
            </Chip>
            <Chip href={organizationsHref(query, { view: 'list' })} selected={query.view === 'list'} size="sm">
              Список
            </Chip>
          </ChipGroup>
          <form className="org-search" action="/platform" role="search">
            {query.vertical !== 'all' && <input type="hidden" name="vertical" value={query.vertical} />}
            {query.sort !== 'date' && <input type="hidden" name="sort" value={query.sort} />}
            {query.view !== 'cards' && <input type="hidden" name="view" value={query.view} />}
            {query.month && <input type="hidden" name="month" value={query.month} />}
            <input
              className="inp"
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Организации, филиалы, адреса"
              aria-label="Поиск по организациям, филиалам и адресам"
            />
            <button className="btn btn--secondary" type="submit">
              Найти
            </button>
          </form>
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Icon name="inventory" width={32} height={32} />} title="Ничего не найдено">
          {data.organizations.length === 0
            ? 'Организаций пока нет: создайте первую кнопкой справа вверху.'
            : 'По этим условиям организаций нет. Сбросьте поиск или выберите другое направление.'}
        </EmptyState>
      ) : query.view === 'list' ? (
        <OrganizationsTable orgs={shown} />
      ) : (
        <div className="org-grid" data-testid="platform-organization-cards">
          {shown.map((o) => (
            <OrganizationCard
              key={o.id}
              org={o}
              current={o.id === currentOrganizationId}
              branchesByLocation={branchesByLocation}
              period={data.period.month}
            />
          ))}
        </div>
      )}
      <div className="org-widgets">
        <Suspense fallback={<LoadingState label="Считаем динамику…" />}>
          <Series month={query.month} />
        </Suspense>
        <Distribution orgs={data.organizations} />
        <Activity items={data.activity} />
      </div>
      {footer}
    </Stack>
  );
}

/** Организация вошедшего и ссылки «Открыть»: выбрать филиал можно только в своей организации */
async function currentOrganization() {
  const { branchesApi } = await import('../../lib/api');
  try {
    const list = await branchesApi.list();
    const byLocation = new Map<string, BranchItem>(list.items.map((b) => [b.locationId, b]));
    return { currentOrganizationId: list.organization.id, branchesByLocation: byLocation };
  } catch {
    return { currentOrganizationId: null, branchesByLocation: new Map<string, BranchItem>() };
  }
}

function Tiles({ data }: { data: PlatformOverview }) {
  const t = overviewTotals(data);
  const revenue = revenueLine(t.revenue);
  const main = Object.entries(t.revenue).sort((a, b) => b[1] - a[1])[0];
  const delta = main ? deltaWords(main[1], t.previousRevenue[main[0]] ?? 0) : undefined;
  return (
    <section className="org-tiles" aria-label="Итоги" data-testid="platform-totals">
      <Stat
        label="Организаций"
        value={t.organizations}
        size="lg"
        tone="info"
        {...(t.newOrganizations > 0 ? { delta: { direction: 'up' as const, text: `+${t.newOrganizations} за 30 дней` } } : {})}
        hint={`Работают: ${t.working}`}
      />
      <Stat
        label="Филиалов"
        value={t.branches}
        size="lg"
        tone="info"
        hint={`В ${t.organizations} ${plural(t.organizations, 'организации', 'организациях', 'организациях')}`}
      />
      <Stat
        label="Бизнесов"
        value={t.businesses}
        size="lg"
        tone="info"
        hint={VERTICAL_ORDER.filter((v) => t.byVertical[v] > 0)
          .map((v) => `${VERTICAL_PLURAL[v]}: ${t.byVertical[v]}`)
          .join(', ') || 'Пока нет'}
      />
      <Stat
        label={`Доход, ${monthName(data.period.month)}`}
        value={revenue ?? 'нет данных'}
        size="lg"
        tone="success"
        {...(delta && delta.direction ? { delta: { ...delta, text: `${delta.text} к прошлому периоду` } } : {})}
        hint={
          t.withoutRevenue
            ? 'По филиалам, у которых в системе есть деньги. У ресторанов дохода в системе нет.'
            : 'По всем филиалам, валюты не складываются'
        }
      />
    </section>
  );
}

function OrganizationCard({
  org,
  current,
  branchesByLocation,
  period,
}: {
  org: OverviewOrganization;
  current: boolean;
  branchesByLocation: Map<string, BranchItem>;
  period: string;
}) {
  const vertical = primaryVertical(org);
  const figures = organizationFigures(org);
  const status = organizationStatusLine({ status: org.status });
  const first = org.branches[0];
  const open = first ? branchesByLocation.get(first.id) : undefined;
  const second =
    vertical === 'HOSPITALITY'
      ? { label: 'Загрузка', value: figures.occupancy === null ? 'нет данных' : `${figures.occupancy}%` }
      : vertical === 'BEAUTY'
        ? { label: 'Клиентов за период', value: figures.guests === null ? 'нет данных' : String(figures.guests) }
        : { label: 'Гостей за период', value: figures.guests === null ? 'нет данных' : String(figures.guests) };
  return (
    <article
      className="org-card"
      data-vertical={vertical ?? undefined}
      aria-label={org.name}
      data-testid="platform-organization-card"
    >
      <div className="org-card__cover">
        <Icon name={vertical ? VERTICAL_ICON[vertical] : 'inventory'} width={28} height={28} />
        <span className="org-card__count">
          {org.branches.length} {plural(org.branches.length, 'филиал', 'филиала', 'филиалов')}
        </span>
      </div>
      <div className="org-card__body">
        <div>
          <h2 className="org-card__title">{org.name}</h2>
          <p className="org-card__sub">
            {vertical ? VERTICAL_NAME[vertical] : 'Бизнес не заведён'}{' '}
            <Badge tone={status.tone}>{status.label}</Badge>
          </p>
          <p className="org-card__place">{organizationPlace(org) ?? 'Адрес пока не указан'}</p>
        </div>
        <dl className="org-figures" aria-label={`Цифры за ${monthName(period)}`}>
          <div>
            <dt>Доход за период</dt>
            <dd>{revenueLine(figures.revenue) ?? 'нет данных'}</dd>
          </div>
          <div>
            <dt>{second.label}</dt>
            <dd>{second.value}</dd>
          </div>
        </dl>
        <div className="org-branches">
          <div className="org-branches__head">
            <span>Филиалы ({org.branches.length})</span>
            {current && (
              <Link href="/platform#add-branch" prefetch={false} className="btn btn--ghost btn--xs">
                <Icon name="plus" width={14} height={14} /> Добавить
              </Link>
            )}
          </div>
          {org.branches.length === 0 ? (
            <p className="muted">Филиалов пока нет.</p>
          ) : (
            <ul>
              {org.branches.map((b) => (
                <BranchRow key={b.id} branch={b} />
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="org-card__actions">
        {current && open ? (
          <form action={selectBranch}>
            <input type="hidden" name="id" value={open.id} />
            <button className="btn btn--secondary" type="submit">
              Открыть <Icon name="arrow" width={16} height={16} />
            </button>
          </form>
        ) : (
          <Link href={`/platform?org=${org.id}#org-admin`} prefetch={false} className="btn btn--secondary">
            Управлять <Icon name="arrow" width={16} height={16} />
          </Link>
        )}
        <OrganizationMenu id={org.id} name={org.name} />
      </div>
    </article>
  );
}

function BranchRow({ branch: b }: { branch: OverviewBranch }) {
  const figure = branchFigure(b);
  return (
    <li>
      <span>
        {b.name}
        <small>{b.address ?? 'Адрес не указан'}</small>
      </span>
      <span className="org-branches__figure">
        {figure.text}
        {figure.percent !== null && <ShareBar label={`Загрузка ${b.name}`} value={figure.percent} tone="info" />}
      </span>
    </li>
  );
}

function OrganizationsTable({ orgs }: { orgs: OverviewOrganization[] }) {
  return (
    <Table aria-label="Организации платформы" data-testid="platform-organizations">
      <thead>
        <tr>
          <th>Организация</th>
          <th>Направление</th>
          <th>Филиалов</th>
          <th>Доход за период</th>
          <th>Загрузка / гости</th>
          <th>Состояние</th>
          <th>
            <span className="sr-only">Действия</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {orgs.map((o) => {
          const f = organizationFigures(o);
          const vertical = primaryVertical(o);
          const status = organizationStatusLine({ status: o.status });
          return (
            <tr key={o.id}>
              <td>
                <Link href={`/platform?org=${o.id}#org-admin`} prefetch={false}>
                  {o.name}
                </Link>
                <span className="sub">{o.owners.length > 0 ? `, ${o.owners.join(', ')}` : ''}</span>
              </td>
              <td>{vertical ? VERTICAL_NAME[vertical] : 'нет'}</td>
              <td>{o.branches.length}</td>
              <td>{revenueLine(f.revenue) ?? 'нет данных'}</td>
              <td>
                {f.occupancy !== null
                  ? `${f.occupancy}%`
                  : f.guests !== null
                    ? `${f.guests} ${vertical === 'BEAUTY' ? 'клиентов' : 'гостей'}`
                    : 'нет данных'}
              </td>
              <td>
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
              <td>
                <OrganizationMenu id={o.id} name={o.name} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

async function Series({ month }: { month: string | undefined }) {
  const loaded = await platformApi.overviewSeries(month).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok) return <LoadError testId="platform-series-error" {...loadErrorProps(loaded.error)} />;
  return <Dynamics series={loaded.value.items} />;
}

function Distribution({ orgs }: { orgs: OverviewOrganization[] }) {
  const d = distribution(orgs);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <section className="org-panel" aria-labelledby="org-distribution-title" data-testid="platform-distribution">
      <header className="org-panel__head">
        <h2 id="org-distribution-title">Распределение по типам бизнеса</h2>
      </header>
      {d.rows.length === 0 ? (
        <p className="muted org-panel__empty">Пока нечего распределять.</p>
      ) : (
        <div className="org-donut">
          <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Доли направлений, ${d.basis}`}>
            <g transform="rotate(-90 60 60)">
              {d.rows.map((r) => {
                const length = (r.percent / 100) * circumference;
                const circle = (
                  <circle
                    key={r.vertical}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={VERTICAL_COLOR[r.vertical]}
                    strokeWidth="16"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return circle;
              })}
            </g>
          </svg>
          <ul className="org-donut__legend">
            {d.rows.map((r) => (
              <li key={r.vertical}>
                <span className="org-donut__dot" data-vertical={r.vertical} aria-hidden="true" />
                {VERTICAL_PLURAL[r.vertical]}, {r.percent}%
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted org-panel__note">Доли {d.basis}.</p>
    </section>
  );
}

function Activity({ items }: { items: PlatformOverview['activity'] }) {
  const now = new Date();
  return (
    <section className="org-panel" aria-labelledby="org-activity-title" data-testid="platform-activity">
      <header className="org-panel__head">
        <h2 id="org-activity-title">Последние действия</h2>
      </header>
      {items.length === 0 ? (
        <p className="muted org-panel__empty">Действий пока нет.</p>
      ) : (
        <ul className="org-activity">
          {items.map((a) => (
            <li key={a.id}>
              <span>
                {a.label}
                {a.detail ? `: ${a.detail}` : ''}
                {a.organizationName && <small>{a.organizationName}</small>}
              </span>
              <time dateTime={a.at}>{relativeAgo(a.at, now)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
