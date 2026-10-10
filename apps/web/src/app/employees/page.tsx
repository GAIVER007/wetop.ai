import { requireVertical } from '../../lib/vertical-guard';
import Screen from '../beauty/masters/page';
import { FoodEmployeesScreen } from '../food/employees-screen';
export default async function GuardedPage() {
  const me = await requireVertical(['BEAUTY', 'FOOD_SERVICE']);
  if (me.context?.vertical === 'FOOD_SERVICE') return <FoodEmployeesScreen />;
  return Screen();
}
