import { MonthPicker } from './month-picker';
import { ArchivedBranches } from './archived-branches';
import './branches.css';
import { randomUUID } from 'node:crypto';
import { todayAt, isIsoDate } from '@pms/domain';
import { branchesApi, organizationSummaryApi, branchLifecycleApi } from '../../lib/api';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { unstable_rethrow } from 'next/navigation';
import { BranchCreateDialog } from './branch-create-dialog';
import { ReferenceBoard } from './reference-board';
import { OrganizationLocaleField } from '../../components/organization-locale';
import { Page } from '../../components/page';
import { msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
export async function BranchWorkspace({
  query,
  createLabel = msg('Добавить'),
}: {
  query: Record<string, string | string[] | undefined>;
  createLabel?: string;
}) {
  const t = await serverT();
  const locale = await currentLocale();
  try {
    const loaded = await branchesApi.list();
    const { organization, items, canCreate } = loaded;
    const businesses = loaded.businesses ?? [];
    const date = todayAt(items[0]?.timezone ?? 'UTC');
    const month =
      typeof query.month === 'string' &&
      /^\d{4}-\d{2}$/.test(query.month) &&
      isIsoDate(`${query.month}-01`)
        ? query.month
        : date.slice(0, 7);
    const monthFrom = `${month}-01`;
    const monthTo = `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
    const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : monthFrom;
    const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : monthTo;
    const [financial, archived] = await Promise.all([
      organizationSummaryApi.load(from, to).catch((error) => {
        unstable_rethrow(error);
        return null;
      }),
      canCreate
        ? branchLifecycleApi.archived().catch((error) => {
            unstable_rethrow(error);
            return null;
          })
        : Promise.resolve(null),
    ]);
    return (
      <ReferenceBoard
        organization={organization.name}
        period={<MonthPicker key="month" month={month} locale={locale} />}
        financial={financial}
        archive={canCreate ? <ArchivedBranches key="archive" items={archived} /> : null}
        language={
          canCreate ? (
            <OrganizationLocaleField key="language" value={organization.locale ?? 'ru'} canEdit />
          ) : null
        }
        periodLabel={from === date && to === date ? t('за сегодня') : t('за {from} - {to}', { from, to })}
        items={items}
        businesses={businesses}
        preview={process.env.NODE_ENV === 'development' && process.env.APP_ALLOW_TEST_DATA === '1'}
        metrics={{}}
        money={[]}
        create={
          canCreate ? (
            <BranchCreateDialog
              key="create"
              id={randomUUID()}
              newBusinessId={randomUUID()}
              businesses={businesses}
              label={createLabel}
            />
          ) : null
        }
      />
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Организация')} width="wide" className="org-page">
        <LoadError testId="branches-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
