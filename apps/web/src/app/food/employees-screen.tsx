import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { FoodEmployee } from '../../lib/food-types';
import { EmployeesBoard, NewEmployeeButton } from './employees-board';
import { restaurantShell } from './restaurant-load';
import { loadStaffRevenue, StaffRevenuePeriodNav } from '../../lib/staff-revenue-load';
import type { StaffRevenuePeriod } from '../../lib/staff-revenue';
import { serverT } from '../../i18n/server';
import { loadTeamBoard } from '../team/people-load';
import { InviteButton, TeamProvider } from '../team/team-board';
import { TeamNavigation } from '../../components/team-navigation';
import './food.css';
import './restaurant.css';

/** «Сотрудники» ресторана: добавление и правка — право «сотрудники» (staff), смотрят все роли стойки */
export async function FoodEmployeesScreen({ period = 'day' }: { period?: StaffRevenuePeriod } = {}) {
  const t = await serverT();
  try {
    const shell = await restaurantShell();
    // право назначать считает сервер и кладёт в каждую страницу ответа; берём из первой
    let canAssignPersonnelKind = false;
    const employees = await completeFoodList<FoodEmployee>(async (cursor) => {
      const page = await restaurantApi.employees(cursor);
      if (!cursor) canAssignPersonnelKind = (page as { canAssignPersonnelKind?: boolean }).canAssignPersonnelKind === true;
      return page;
    });
    const [revenue, team] = await Promise.all([loadStaffRevenue('branch', period), loadTeamBoard()]);
    const write = shell.canStaff && !shell.readOnly;
    const page = (
      <Page
        title={t('Сотрудники')}
        actions={
          write || team ? (
            <>
              {write && <NewEmployeeButton />}
              {team && <InviteButton />}
            </>
          ) : undefined
        }
      >
        {team && <TeamNavigation current="team" owner={team.actorRole === 'OWNER'} teamHref="/employees" />}
        <div key={shell.scopeKey}>
          <EmployeesBoard
            scopeKey={shell.scopeKey}
            write={shell.canStaff && !shell.readOnly}
            employees={employees}
            branchName={shell.branchName}
            canAssignPersonnelKind={canAssignPersonnelKind && !shell.readOnly}
            revenue={revenue}
            revenueNav={<StaffRevenuePeriodNav path="/employees" period={period} />}
            access={{
              levels: shell.readOnly ? [] : shell.accessLevels,
              canAllBranches: shell.canAllBranches,
              branchName: shell.branchName,
              vertical: 'FOOD_SERVICE',
            }}
            team={team}
          />
        </div>
      </Page>
    );
    return team ? (
      <TeamProvider role={team.actorRole} structure={team.structure} expectedOrganizationId={team.organizationId} vertical="FOOD_SERVICE">
        {page}
      </TeamProvider>
    ) : (
      page
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Сотрудники')}>
        <LoadError testId="employees-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
