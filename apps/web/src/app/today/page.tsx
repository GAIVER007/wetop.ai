import { unstable_rethrow } from 'next/navigation';
import { currentMe } from '../../lib/desk-shell';
import { verifiedTodayScope } from '../../lib/today-loaders';
import type { SearchParams } from '../../lib/search-params';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { HospitalityToday } from './hospitality';
import { TodayScopeContent } from './scope-content';
import { BeautyToday, FoodToday } from './vertical-today';

export default async function TodayPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    const scope = verifiedTodayScope(await currentMe());
    const scopeKey = `${scope.businessId}:${scope.locationId}`;
    const content =
      scope.vertical === 'BEAUTY' ? (
        <BeautyToday locationId={scope.locationId} />
      ) : scope.vertical === 'FOOD_SERVICE' ? (
        <FoodToday />
      ) : (
        <HospitalityToday {...props} />
      );
    return (
      <TodayScopeContent key={scopeKey} scopeKey={scopeKey}>
        {content}
      </TodayScopeContent>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Главная">
        <LoadError testId="today-scope-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
