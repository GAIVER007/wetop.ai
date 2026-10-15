import { requireVertical } from '../../../lib/vertical-guard';
import { notFound, redirect } from 'next/navigation';
import { api, inventoryEditorApi, reservationsApi } from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday, nextDay, validDate } from '../../../lib/hotel-api';
import { nightsBetween, pluralRu } from '../../../lib/plural';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { Page } from '../../../components/page';
import { FundTabs } from '../../inventory/fund-tabs';
import { CategoryCatalog } from '../../inventory/category-catalog';
import { FundEditor } from '../../inventory/fund-editor';
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
  await requireVertical(['HOSPITALITY']);
  const { section = [] } = await params;
  if (!section.length) redirect('/inventory');
  if (section.length !== 1 || !['categories', 'availability'].includes(section[0]!)) notFound();
  const categories = section[0] === 'categories';
  if (categories) {
    const [types, units] = await Promise.all([
      inventoryEditorApi.categories(),
      api.inventoryUnits(),
    ]);
    const rooms = units.filter((u) => u.kind === 'ROOM').length;
    const beds = units.length - rooms;
    // разделитель — запятая, а не точка-разделитель: сторож ИИ-слопа, DESIGN.md §14
    const summary = [
      pluralRu(types.length, ['категория', 'категории', 'категорий']),
      rooms ? pluralRu(rooms, ['номер', 'номера', 'номеров']) : '',
      beds ? pluralRu(beds, ['койко-место', 'койко-места', 'койко-мест']) : '',
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <Page
        title="Категории номеров"
        subtitle={
          types.length
            ? summary
            : 'Категория объединяет номера или койки с одинаковым типом размещения и вместимостью.'
        }
        actions={<FundEditor categories={types} mode="category" />}
      >
        <FundTabs active="categories" />
        <CategoryCatalog categories={types} units={units} />
      </Page>
    );
  }
  const today = await hotelToday();
  const q = normalizeSearchParams(await searchParams),
    arrival = q.arrival ?? today,
    departure = q.departure ?? (validDate(arrival) ? nextDay(arrival) : today);
  const guestsRaw = Number.parseInt(q.guests ?? '', 10);
  const guests = Number.isFinite(guestsRaw) ? Math.min(Math.max(guestsRaw, 1), 99) : 1;
  const valid =
    validDate(arrival) &&
    validDate(departure) &&
    arrival < departure &&
    nightsBetween(arrival, departure) <= MAX_CHESSBOARD_DAYS;
  const [summary, units, offers, result] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(),
    // Цены — дополнение к местам: не загрузились — места всё равно видны, строка скажет «цены не загрузились»
    valid ? reservationsApi.offers(arrival, departure, guests).catch(() => null) : null,
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
  // Ближайшая доступность (AV4) — только когда есть категория, подходящая по вместимости, но без мест на весь
  // запрос: иначе лишний рейс к API на каждом поиске. Не загрузилась — строка просто скажет «нет мест».
  const beds = new Set(units.filter((u) => u.kind === 'BED').map((u) => u.accommodationTypeCode));
  const soldOut = summary.byCategory.some((c) => {
    const bed = beds.has(c.code);
    const available = result.data?.byCategory[c.code]?.available ?? 0;
    return result.data && (bed || c.capacityAdults >= guests) && available < (bed ? guests : 1);
  });
  const nearest = soldOut
    ? await reservationsApi.nearest(arrival, departure, guests).catch(() => null)
    : null;
  return (
    <Page
      title="Свободные места"
      subtitle="Найдите размещение, свободное на весь период проживания."
    >
      <FundTabs active="availability" />
      <AvailabilityFinder
        today={today}
        arrival={arrival}
        departure={departure}
        guests={guests}
        offers={offers}
        nearest={nearest}
        result={result.data}
        error={result.error}
        summary={summary}
        units={units}
      />
    </Page>
  );
}
