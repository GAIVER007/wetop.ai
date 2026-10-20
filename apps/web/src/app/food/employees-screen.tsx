import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { FoodEmployee } from '../../lib/food-types';
import { EmployeesBoard } from './employees-board';
import { restaurantShell } from './restaurant-load';
import { StaffTabs } from './staff-tabs';
import './food.css';
import './restaurant.css';

/** «Сотрудники» ресторана: добавление и правка — право «сотрудники» (staff), смотрят все роли стойки */
export async function FoodEmployeesScreen() {
  try {
    const shell = await restaurantShell();
    // право назначать считает сервер и кладёт в каждую страницу ответа; берём из первой
    let canAssignPersonnelKind = false;
    const employees = await completeFoodList<FoodEmployee>(async (cursor) => {
      const page = await restaurantApi.employees(cursor);
      if (!cursor) canAssignPersonnelKind = (page as { canAssignPersonnelKind?: boolean }).canAssignPersonnelKind === true;
      return page;
    });
    return (
      <Page title="Сотрудники">
        <StaffTabs current="list" />
        <div key={shell.scopeKey}>
          <EmployeesBoard
            scopeKey={shell.scopeKey}
            write={shell.canStaff && !shell.readOnly}
            employees={employees}
            branchName={shell.branchName}
            canAssignPersonnelKind={canAssignPersonnelKind && !shell.readOnly}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Сотрудники">
        <LoadError testId="employees-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
