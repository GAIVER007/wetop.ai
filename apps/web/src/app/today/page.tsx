import { requireVertical } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { BeautyToday } from './beauty-today';
import { TODAY_VERTICALS, todayScreen } from './dispatch';
import { FoodToday } from './food-today';
import { HospitalityToday } from './hospitality-today';

/**
 * Рабочий экран дня (MV8): один адрес на все направления. Экран выбирает направление выбранного филиала,
 * устаревший выбор сбрасывает `requireVertical` (SCOPE-HARDENING), второго выбора филиала здесь нет.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireVertical(TODAY_VERTICALS);
  const { screen, key } = todayScreen(me);
  if (screen === 'BEAUTY') return <BeautyToday key={key} />;
  if (screen === 'FOOD_SERVICE') return <FoodToday key={key} />;
  return <HospitalityToday key={key} sp={normalizeSearchParams(await searchParams)} />;
}
