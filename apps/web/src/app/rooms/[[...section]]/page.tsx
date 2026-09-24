import { notFound, redirect } from 'next/navigation';
import { api, inventoryEditorApi, reservationsApi } from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday, nextDay, validDate } from '../../../lib/hotel-api';
import { nightsBetween } from '../../../lib/plural';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { Page } from '../../../components/page';
import { FundTabs } from '../../inventory/fund-tabs';
import { CategoryCatalog } from '../../inventory/category-catalog';
import { AvailabilityFinder } from '../availability-finder';
import '../../inventory/inventory.css';
import '../../inventory/fund.css';
export default async function RoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { section = [] } = await params;
  if (!section.length) redirect('/inventory');
  if (section.length !== 1 || !['categories', 'availability'].includes(section[0]!)) notFound();
  const categories = section[0] === 'categories';
  if (categories) {
    const [types, units] = await Promise.all([
      inventoryEditorApi.categories(),
      api.inventoryUnits(),
    ]);
    return (
      <Page
        title="Категории номеров"
        subtitle="Категория объединяет номера или койки с одинаковым типом размещения и вместимостью."
      >
        <FundTabs active="categories" />
        <CategoryCatalog categories={types} units={units} />
      </Page>
    );
  }
  const q = normalizeSearchParams(await searchParams),
    arrival = q.arrival ?? hotelToday(),
    departure = q.departure ?? (validDate(arrival) ? nextDay(arrival) : hotelToday());
  const valid =
    validDate(arrival) &&
    validDate(departure) &&
    arrival < departure &&
    nightsBetween(arrival, departure) <= MAX_CHESSBOARD_DAYS;
  const [summary, units, result] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(),
    valid
      ? reservationsApi
          .availability(arrival, departure)
          .then((data) => ({ data, error: null }))
          .catch(() => ({
            data: null,
            error: 'Не удалось проверить доступность. Повторите поиск.',
          }))
      : Promise.resolve({
          data: null,
          error: `Выезд должен быть позже заезда. Период — не больше ${MAX_CHESSBOARD_DAYS} ночей.`,
        }),
  ]);
  return (
    <Page
      title="Доступность номеров"
      subtitle="Найдите номер или койку, свободные на весь срок проживания."
    >
      <FundTabs active="availability" />
      <AvailabilityFinder
        today={hotelToday()}
        arrival={arrival}
        departure={departure}
        result={result.data}
        error={result.error}
        summary={summary}
        units={units}
      />
    </Page>
  );
}
