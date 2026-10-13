import { BusinessRecent } from './business-recent';
import { Suspense } from 'react';
import { BusinessTrend } from './business-trend';
import './branches.css';
import { randomUUID } from 'node:crypto';
import { todayAt, isIsoDate } from '@pms/domain';
import { branchesApi } from '../../lib/api';
import { summarizeBranches } from '../../lib/branch-summary';
import { formatMoney } from '../../lib/money';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { unstable_rethrow } from 'next/navigation';
import { BranchForm } from './form';
import { groupBusinessBranches } from './business-groups';
import { ReferenceBoard } from './reference-board';
export async function BranchWorkspace({
  query,
  createLabel = 'Добавить объект или направление',
}: {
  query: Record<string, string | string[] | undefined>;
  createLabel?: string;
}) {
  try {
    const loaded = await branchesApi.list();
    const { organization, items, canCreate } = loaded;
    const businesses = loaded.businesses ?? [];
    const date = todayAt(items[0]?.timezone ?? 'UTC');
    const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : date;
    const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : from;
    const overview = await branchesApi.overview(from, to).catch((error) => {
      unstable_rethrow(error);
      return null;
    });
    const summary = overview
      ? summarizeBranches(overview.rows.filter((r) => r.branch.vertical === 'HOSPITALITY'))
      : null;
    return (
      <ReferenceBoard
        organization={organization.name}
        periodLabel={from === date && to === date ? 'за сегодня' : `за ${from} - ${to}`}
        items={items}
        businesses={businesses}
        preview={process.env.NODE_ENV === 'development' && process.env.APP_ALLOW_TEST_DATA === '1'}
        metrics={Object.fromEntries(
          groupBusinessBranches(items)
            .filter((g) => g.vertical === 'HOSPITALITY')
            .map((g) => {
              const rows = overview?.rows.filter(
                (r) => r.branch.vertical === 'HOSPITALITY' && r.branch.location.businessId === g.id,
              );
              const aggregate = rows ? summarizeBranches(rows) : null;
              return [
                g.id,
                {
                  money: aggregate
                    ? [...aggregate.currencies].map(([currency, total]) =>
                        formatMoney(total.revenue, currency),
                      )
                    : [],
                  occupancy: aggregate ? `${aggregate.percent}%` : 'Нет данных',
                },
              ];
            }),
        )}
        recent={
          canCreate ? (
            <Suspense
              fallback={
                <p className="org-chart-empty" role="status">
                  Загружаем журнал…
                </p>
              }
            >
              <BusinessRecent businesses={businesses} />
            </Suspense>
          ) : (
            <p className="org-chart-empty">Журнал доступен владельцу организации.</p>
          )
        }
        trend={
          <Suspense
            fallback={
              <p className="org-chart-empty" role="status">
                Загружаем динамику…
              </p>
            }
          >
            {items.some((item) => item.vertical === 'HOSPITALITY') ? (
              <BusinessTrend date={to} />
            ) : (
              <p className="org-chart-empty">Добавьте гостиничный объект, чтобы видеть динамику.</p>
            )}
          </Suspense>
        }
        money={
          summary
            ? [...summary.currencies].map(([currency, total]) =>
                formatMoney(total.revenue, currency),
              )
            : []
        }
        create={
          canCreate ? (
            <details className="org-create" id="create-branch">
              <summary>+ {createLabel}</summary>
              <div>
                <BranchForm id={randomUUID()} />
              </div>
            </details>
          ) : null
        }
      />
    );
  } catch (error) {
    unstable_rethrow(error);
    return <LoadError testId="branches-load-error" {...loadErrorProps(error)} />;
  }
}
