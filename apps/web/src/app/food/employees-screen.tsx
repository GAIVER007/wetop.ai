import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { FoodEmployee } from '../../lib/food-types';
import { EmployeesBoard } from './employees-board';
import { restaurantShell } from './restaurant-load';
import './food.css';
import './restaurant.css';

/** «Сотрудники» ресторана: добавление и правка — право «сотрудники» (staff), смотрят все роли стойки */
export async function FoodEmployeesScreen() {
  try {
    const shell = await restaurantShell();
    const employees = await completeFoodList<FoodEmployee>(restaurantApi.employees);
    return (
      <Page title="Сотрудники" subtitle="Команда ресторана: смены по графику и продажи за сегодня">
        <div key={shell.scopeKey}>
          <EmployeesBoard
            scopeKey={shell.scopeKey}
            write={shell.canStaff && !shell.readOnly}
            employees={employees}
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
