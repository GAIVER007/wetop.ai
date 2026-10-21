import { requireFeature } from '../../lib/vertical-guard';
import { revenuePeriodParam } from '../../lib/staff-revenue';
import Screen from '../beauty/masters/page';
import { FoodEmployeesScreen } from '../food/employees-screen';
export default async function GuardedPage(props: {
  searchParams: Promise<{ employee?: string | string[]; period?: string | string[] }>;
}) {
  const me = await requireFeature('/employees');
  if (me.context?.vertical === 'FOOD_SERVICE')
    return <FoodEmployeesScreen period={revenuePeriodParam((await props.searchParams).period)} />;
  return Screen(props);
}
