import { unstable_rethrow } from 'next/navigation';
import { currentMe } from '../../lib/desk-shell';
import { verifiedTodayScope } from '../../lib/today-loaders';
import type { SearchParams } from '../../lib/search-params';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { HospitalityToday } from './hospitality';
import { BeautyToday, FoodToday } from './vertical-today';

export default async function TodayPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    const scope = verifiedTodayScope(await currentMe());
    if (scope.vertical === 'BEAUTY') return <BeautyToday locationId={scope.locationId} />;
    if (scope.vertical === 'FOOD_SERVICE') return <FoodToday />;
    return <HospitalityToday {...props} />;
  } catch (error) {
    unstable_rethrow(error);
    return <Page title="Главная"><LoadError testId="today-scope-error" {...loadErrorProps(error)} /></Page>;
  }
}
