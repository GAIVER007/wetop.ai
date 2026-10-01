import { Suspense } from 'react';
import { can, parseMembershipRole, resolvePeriod } from '@pms/domain';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { Badge, Panel, Table } from '../../components/ui';
import { loadErrorProps } from '../../lib/load-error';
import { organizationApi, type OrganizationStructure } from '../../lib/api';
import { hotelToday } from '../../lib/hotel-api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { pluralRu } from '../../lib/plural';
import { AddBranchButton, BranchEditor, OpenBranchButton } from './branches';
import { BranchesSummary, SummarySkeleton } from './summary';
import './organization.css';

/**
 * «Компания» (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md`): организация вошедшего, её филиалы
 * с объектами, показатели по каждому филиалу за период и итог. Термин клиента, «Компания» (`ARCHITECTURE.md` §1);
 * «Партнёр» и «Организация», слова раздела «Платформа». Новый филиал добавляет владелец (Q-236); управляющий видит
 * всё, но кнопки нет, причину называет API. Открыть филиал, тот же выбор, что переключатель слева.
 */
const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeSearchParams(await searchParams);
  const [loaded, me, { readOnly }, today] = await Promise.all([
    settle(organizationApi.structure()),
    settle(currentMe()),
    deskShell(),
    hotelToday().catch(() => new Date().toISOString().slice(0, 10)),
  ]);
  const role = me.ok && me.value.user?.role ? parseMembershipRole(me.value.user.role) : null;
  const mayReports = role === null || can(role, 'reports');
  const period = resolvePeriod(
    { preset: sp.period ?? 'month', from: sp.from, to: sp.to, date: sp.date },
    today,
  );
  const structure = loaded.ok ? loaded.value : null;
  const mayAdd = Boolean(structure && structure.canAddBranch.ok && !readOnly);
  // умолчания формы, от API (часы и валюта первого филиала): стойка пояса не знает (С-13)
  const defaults = structure?.branchDefaults ?? { timezone: '', currency: '' };
  return (
    <BranchEditor defaults={defaults}>
      <Page
        title="Компания"
        className="company-page object-settings"
        subtitle={structure ? structure.name : undefined}
        actions={mayAdd ? <AddBranchButton /> : undefined}
      >
        {!loaded.ok ? (
          <LoadError testId="company-error" {...loadErrorProps(loaded.error)} />
        ) : (
          <>
            <CompanyFacts structure={loaded.value} readOnly={readOnly} />
            <Branches structure={loaded.value} />
            {mayReports && (
              <Suspense key={`${period.from}|${period.to}`} fallback={<SummarySkeleton />}>
                <BranchesSummary period={period} />
              </Suspense>
            )}
          </>
        )}
      </Page>
    </BranchEditor>
  );
}

function CompanyFacts({ structure, readOnly }: { structure: OrganizationStructure; readOnly: boolean }) {
  const branches = structure.businesses.flatMap((b) => b.locations);
  const rows: Array<[string, string]> = [
    ['Название', structure.name],
    ['Отчётная валюта', structure.reportingCurrency],
    ['Бизнесы', pluralRu(structure.businesses.length, ['направление', 'направления', 'направлений'])],
    ['Филиалы', pluralRu(branches.length, ['филиал', 'филиала', 'филиалов'])],
  ];
  return (
    <Panel className="settings-block" data-testid="company-facts">
      <h2>Компания</h2>
      <dl className="settings-facts company-facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="company-note">
        {structure.canAddBranch.ok
          ? readOnly
            ? 'Организация в режиме «только чтение»: новый филиал добавить нельзя, пока запись закрыта.'
            : 'Филиал: отдельный объект со своими номерами, ценами и бронями внутри одной компании. Статистика ниже считается по каждому и итогом.'
          : `${structure.canAddBranch.reason}.`}
      </p>
    </Panel>
  );
}

function Branches({ structure }: { structure: OrganizationStructure }) {
  const current = structure.current.location?.id ?? null;
  const rows = structure.businesses.flatMap((b) => b.locations.map((l) => ({ business: b, branch: l })));
  return (
    <Panel className="settings-block company-branches" data-testid="company-branches">
      <h2>Филиалы</h2>
      <Table aria-label="Филиалы компании" nowrap>
        <thead>
          <tr>
            <th>Филиал</th>
            <th>Адрес</th>
            <th>Часовой пояс</th>
            <th>Валюта</th>
            <th>Объект</th>
            <th>Выбор</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ business, branch }) => {
            const isCurrent = branch.id === current;
            return (
              <tr key={branch.id} aria-current={isCurrent ? 'true' : undefined} data-testid="company-branch">
                <td>
                  <strong>{branch.name}</strong>
                  {structure.businesses.length > 1 && <div className="muted">{business.name}</div>}
                </td>
                <td>{branch.address ?? '—'}</td>
                <td>{branch.timezone}</td>
                <td>{branch.currency}</td>
                <td>{branch.propertyName ?? '—'}</td>
                <td className="company-branch__open">
                  {isCurrent ? (
                    <Badge tone="ok">Текущий</Badge>
                  ) : (
                    <OpenBranchButton businessId={business.id} locationId={branch.id} name={branch.name} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Panel>
  );
}

