import { requireFeature } from '../../lib/vertical-guard';
import Screen from '../beauty/masters/page';
import { FoodEmployeesScreen } from '../food/employees-screen';
export default async function GuardedPage(props: {
  searchParams: Promise<{ employee?: string | string[] }>;
}) {
  const me = await requireFeature('/employees');
  if (me.context?.vertical === 'FOOD_SERVICE') return <FoodEmployeesScreen />;
  return Screen(props);
}
