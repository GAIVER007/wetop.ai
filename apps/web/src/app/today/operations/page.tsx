import { requireFeature } from '../../../lib/vertical-guard';
import { BeautyToday } from '../beauty-today';
import { FoodToday } from '../food-today';
import { HospitalityToday } from '../hospitality-today';
import { TodayScopeContent } from '../scope-content';
export default async function OperationsPage() {
  const me = await requireFeature('/today/operations'),
    c = me.context;
  if (!c?.locationId || !c.businessId) return <p>Выберите филиал для рабочих инструментов.</p>;
  const content =
    c.vertical === 'BEAUTY' ? (
      <BeautyToday />
    ) : c.vertical === 'FOOD_SERVICE' ? (
      <FoodToday />
    ) : c.vertical === 'HOSPITALITY' ? (
      <HospitalityToday />
    ) : (
      <p>Направление не поддерживается</p>
    );
  return <TodayScopeContent key={`${c.businessId}:${c.locationId}`}>{content}</TodayScopeContent>;
}
