import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import { RoomGrid } from '../room-grid';
import { notFound } from 'next/navigation';
import { api, chessboardApi, reservationsApi } from '../../../lib/api';
import { hotelToday, nextDay, validDate } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { SectionCards, FeaturePending } from '../../../components/section-cards';
import { Alert, Button, Field, Input, Stat, Stats, Table } from '../../../components/ui';

export default async function RoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { section = [] } = await params;
  const path = `/rooms${section.length ? `/${section.join('/')}` : ''}`;
  const item = navigationItems.find((item) => item.href === path);
  if (!item) notFound();
  const sp = normalizeSearchParams(await searchParams);
  return (
    <Page
      title={item.label}
      crumbs={section.length ? <Link href="/rooms">Управление номерами</Link> : undefined}
    >
      {!section.length && (
        <>
          <RoomTotals />
          <SectionCards items={item.children ?? []} />
          <RoomsDirectory />
        </>
      )}
      {section[0] === 'categories' && <Categories />}
      {section[0] === 'availability' && (
        <Availability arrival={sp.arrival ?? hotelToday()} departure={sp.departure} />
      )}
      {section[0] === 'promotions' && (
        <>
          <FeaturePending
            icon="rates"
            text="Акции и промокоды пока недоступны. Цены можно изменить в тарифах."
          />
          <Link className="btn btn--secondary" href="/rates">
            Открыть тарифы
          </Link>
        </>
      )}
    </Page>
  );
}
async function RoomTotals() {
  const r = await api.inventorySummary();
  return (
    <Stats>
      <Stat label="Частных номеров" value={r.rooms} />
      <Stat label="Коек в общих комнатах" value={r.beds} />
      <Stat label="Категорий" value={r.byCategory.length} />
      <Stat label="Вместимость, гостей" value={r.maxGuests} />
    </Stats>
  );
}
async function Categories() {
  const r = await api.inventorySummary();
  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Категория</th>
            <th className="num">Номеров / коек</th>
            <th className="num">Вместимость, гостей</th>
            <th>Управление</th>
          </tr>
        </thead>
        <tbody>
          {r.byCategory.map((c) => (
            <tr key={c.code}>
              <td>
                <strong>{c.name}</strong>
                <div className="cell-sub">{c.code}</div>
              </td>
              <td className="num">{c.units}</td>
              <td className="num">{c.maxGuests}</td>
              <td>
                <Link href={`/inventory?category=${encodeURIComponent(c.code)}`}>
                  Состав категории
                </Link>
                <span className="cell-sub">
                  <Link href={`/rates?category=${encodeURIComponent(c.code)}`}>Тарифы</Link>
                </span>
              </td>
            </tr>
          ))}
          {!r.byCategory.length && (
            <tr>
              <td colSpan={4}>Категории ещё не добавлены.</td>
            </tr>
          )}
        </tbody>
      </Table>
      <p className="note">Категории доступны только для просмотра.</p>
    </>
  );
}
async function Availability({
  arrival,
  departure: requestedDeparture,
}: {
  arrival: string;
  departure?: string | undefined;
}) {
  const departure = requestedDeparture ?? (validDate(arrival) ? nextDay(arrival) : hotelToday());
  const valid = validDate(arrival) && validDate(departure) && arrival < departure;
  const [r, inventory] = valid
    ? await Promise.all([reservationsApi.availability(arrival, departure), api.inventorySummary()])
    : [null, null];
  return (
    <>
      <form className="row toolbar" method="get">
        <Field label="Заезд">
          <Input type="date" name="arrival" defaultValue={arrival} required />
        </Field>
        <Field label="Выезд">
          <Input type="date" name="departure" defaultValue={departure} required />
        </Field>
        <Button type="submit">Проверить доступность</Button>
      </form>
      {!valid && <Alert boxed>Выезд должен быть позже заезда. Укажите корректные даты.</Alert>}
      {r && (
        <>
          <Stats>
            <Stat
              label="Доступно на весь срок"
              value={r.total.available}
              hint="номеров и отдельных коек"
            />
            <Stat label="Ночей" value={r.nights} />
            <Stat label="Всего в фонде" value={r.total.units} />
          </Stats>
          <Table>
            <thead>
              <tr>
                <th>Категория</th>
                <th className="num">Всего</th>
                <th className="num">Доступно</th>
                <th>Размещение</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.byCategory).map(([code, c]) => (
                <tr key={code}>
                  <td>
                    <strong>
                      {inventory?.byCategory.find((i) => i.code === code)?.name ?? code}
                    </strong>
                  </td>
                  <td className="num">{c.units}</td>
                  <td className="num">{c.available}</td>
                  <td>
                    {c.available > 0 ? (
                      <Link
                        href={`/reservations/new?${new URLSearchParams({ arrival, departure, unit: c.availableUnitCodes[0] ?? '' })}`}
                      >
                        Создать бронь
                      </Link>
                    ) : (
                      <span className="muted">Нет свободных мест</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="note">
            День выезда не входит. При сохранении брони доступность проверяется повторно.
          </p>
          <Link href={`/chessboard?from=${arrival}&to=${departure}`} className="btn btn--secondary">
            Посмотреть на шахматке
          </Link>
        </>
      )}
    </>
  );
}

async function RoomsDirectory() {
  const today = hotelToday();
  const [units, board] = await Promise.all([
    api.inventoryUnits(),
    chessboardApi.board(today, today).catch(() => null),
  ]);
  return <RoomGrid units={units} board={board} />;
}
