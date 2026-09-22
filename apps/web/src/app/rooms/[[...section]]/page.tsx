import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import { RoomGrid } from '../room-grid';
import { notFound } from 'next/navigation';
import { ApiError, api, chessboardApi, reservationsApi } from '../../../lib/api';
import { hotelToday, nextDay, plusDays, validDate } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { Alert, Button, Field, Stat, Stats, Table, cx } from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { Icon } from '../../../components/icon';
import { displayDate } from '../../../lib/display-date';
import { nightsBetween, pluralRu } from '../../../lib/plural';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import '../../directory.css';
import '../rooms.css';

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
          {/* Разделы — строкой, а не четырьмя плитками: под ними живёт сам справочник */}
          <nav className="rooms-links" aria-label="Разделы номеров">
            {(item.children ?? []).map((c) => (
              <Link key={c.href} href={c.href} className="rooms-link">
                <Icon name={c.icon} />
                {c.label}
              </Link>
            ))}
          </nav>
          <RoomsDirectory />
        </>
      )}
      {section[0] === 'categories' && <Categories />}
      {section[0] === 'availability' && (
        <Availability arrival={sp.arrival ?? hotelToday()} departure={sp.departure} />
      )}
    </Page>
  );
}
/**
 * Номерной фонд не ответил. Это не пустая база: пустой фонд показывает нули, а не отсутствие цифр.
 * Текст отказа берём как есть — API говорит по-человечески (например, «объект не настроен для вашей
 * организации», ADR-059), и прятать это за общим «что-то пошло не так» незачем.
 */
const FUND_FAILED = 'Номерной фонд не загрузился';

async function RoomTotals() {
  const r = await api.inventorySummary().catch((e: unknown) => {
    if (e instanceof ApiError) return e;
    throw e;
  });
  if (r instanceof ApiError)
    return (
      <Alert boxed>
        {FUND_FAILED}: {r.message}
      </Alert>
    );
  return (
    <Stats>
      <Stat label="Частных номеров" value={r.rooms} />
      <Stat label="Коек в общих комнатах" value={r.beds} />
      <Stat label="Категорий" value={r.byCategory.length} />
      <Stat label="Вместимость, гостей" value={r.maxGuests} />
    </Stats>
  );
}
/** Одна подпись на оба экрана: занятость не загрузилась — это сбой, а не пустая база */
const BOARD_FAILED =
  'Занятость не загрузилась: шахматка не ответила. Номера и категории ниже — из фонда; ' +
  'обновите страницу или откройте шахматку.';

async function Categories() {
  const today = hotelToday();
  const [r, units, board] = await Promise.all([
    api.inventorySummary().catch((e: unknown) => {
      if (e instanceof ApiError) return e;
      throw e;
    }),
    api.inventoryUnits().catch((e: unknown) => {
      if (e instanceof ApiError) return e;
      throw e;
    }),
    chessboardApi.board(today, today).catch(() => null),
  ]);
  if (r instanceof ApiError || units instanceof ApiError)
    return (
      <Alert boxed>
        {FUND_FAILED}: {(r instanceof ApiError ? r : (units as ApiError)).message}
      </Alert>
    );
  const beds = new Map<string, number>();
  for (const u of units)
    if (u.kind === 'BED')
      beds.set(u.accommodationTypeCode, (beds.get(u.accommodationTypeCode) ?? 0) + 1);
  return (
    <>
      {!board && <Alert boxed>{BOARD_FAILED}</Alert>}
      <Table className="dir-table dir-table--categories" nowrap data-testid="categories-table">
        <thead>
          <tr>
            <th>Категория</th>
            <th>Состав</th>
            <th className="num">Гостей</th>
            <th>Сегодня, {displayDate(today)}</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {r.byCategory.map((c) => {
            const t = board?.byCategory[today]?.[c.code];
            const isBeds = (beds.get(c.code) ?? 0) > 0;
            return (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                  <div className="cat-code">{c.code}</div>
                </td>
                <td>
                  {isBeds
                    ? pluralRu(c.units, ['койка', 'койки', 'коек'])
                    : pluralRu(c.units, ['номер', 'номера', 'номеров'])}
                </td>
                <td className="num">{c.maxGuests}</td>
                <td>
                  {t ? (
                    <div className="occupancy-meter cat-today">
                      <meter
                        min="0"
                        max={t.units || 1}
                        value={t.occupied}
                        aria-label={`Занято ${t.occupied} из ${t.units}`}
                      />
                      <span>
                        занято {t.occupied}, свободно{' '}
                        <b className={cx(t.free === 0 && 'is-zero')}>{t.free}</b>
                        {t.blocked > 0 && `, закрыто ${t.blocked}`}
                      </span>
                    </div>
                  ) : (
                    <span className="muted">{board ? 'нет данных' : 'не загрузилось'}</span>
                  )}
                </td>
                <td className="rooms-actions">
                  <Link href={`/inventory?category=${encodeURIComponent(c.code)}`}>Состав</Link>
                  <Link href={`/rates?category=${encodeURIComponent(c.code)}`}>Тарифы</Link>
                  <Link href={`/chessboard?from=${today}&to=${nextDay(today)}`}>Шахматка</Link>
                </td>
              </tr>
            );
          })}
          {!r.byCategory.length && (
            <tr>
              <td colSpan={5} className="muted">
                Категории ещё не добавлены: состав и вместимость приходят из Exely при импорте
                фонда.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <p className="note">
        Категории доступны только для просмотра: состав и вместимость приходят из Exely.
      </p>
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
  const dates = validDate(arrival) && validDate(departure) && arrival < departure;
  // Доступность считается той же шахматкой: у неё потолок 62 дня за запрос. Проверяем здесь,
  // иначе API отвечает 400 и экран падает в общую ошибку «нет связи» (§7.3)
  const tooLong = dates && nightsBetween(arrival, departure) > MAX_CHESSBOARD_DAYS;
  // тот же предел — в самом поле даты: браузер не даст выбрать выезд дальше горизонта
  const lastDeparture = validDate(arrival) ? plusDays(arrival, MAX_CHESSBOARD_DAYS) : undefined;
  const valid = dates && !tooLong;
  const [r, inventory] = valid
    ? await Promise.all([reservationsApi.availability(arrival, departure), api.inventorySummary()])
    : [null, null];
  const today = hotelToday();
  const plus = (from: string, n: number) => {
    let d = from;
    for (let k = 0; k < n; k++) d = nextDay(d);
    return d;
  };
  // ближайшие пятница → воскресенье
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const friday = plus(today, (5 - dow + 7) % 7);
  const presets: Array<[string, string, string]> = [
    ['Сегодня', today, nextDay(today)],
    ['Завтра', nextDay(today), plus(today, 2)],
    ['Выходные', friday, plus(friday, 2)],
    ['Неделя', today, plus(today, 7)],
  ];
  const href = (a: string, d: string) => `/rooms/availability?arrival=${a}&departure=${d}`;
  return (
    <>
      <form className="row toolbar" method="get">
        <Field label="Заезд">
          <DateInput name="arrival" defaultValue={arrival} required />
        </Field>
        <Field label="Выезд">
          <DateInput
            name="departure"
            rangeFromName="arrival"
            defaultValue={departure}
            required
            {...(lastDeparture ? { max: lastDeparture } : {})}
          />
        </Field>
        <Button type="submit">Проверить доступность</Button>
      </form>
      <nav className="avail-presets" aria-label="Быстрые даты">
        <span>Быстро:</span>
        {presets.map(([label, a, d]) => (
          <Link
            key={label}
            href={href(a, d)}
            className={cx(a === arrival && d === departure && 'is-on')}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!dates && <Alert boxed>Выезд должен быть позже заезда. Укажите корректные даты.</Alert>}
      {tooLong && (
        <Alert boxed>
          Период — не больше {MAX_CHESSBOARD_DAYS} ночей за один запрос. Укоротите период или
          посмотрите остаток по месяцам на шахматке.
        </Alert>
      )}
      {r && (
        <>
          <Stats>
            <Stat
              label="Доступно на весь срок"
              value={r.total.available}
              hint="номеров и отдельных коек"
            />
            <Stat
              label="Период"
              value={pluralRu(r.nights, ['ночь', 'ночи', 'ночей'])}
              hint={`${displayDate(arrival)} → ${displayDate(departure)}`}
            />
            <Stat label="Всего в фонде" value={r.total.units} />
          </Stats>
          <Table
            className="dir-table dir-table--availability"
            nowrap
            data-testid="availability-table"
          >
            <thead>
              <tr>
                <th>Категория</th>
                <th>Занятость</th>
                <th className="num">Доступно</th>
                <th>Какие места свободны</th>
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
                    <div className="cat-code">{code}</div>
                  </td>
                  <td>
                    <div className="occupancy-meter">
                      <meter
                        min="0"
                        max={c.units || 1}
                        value={c.units - c.available}
                        aria-label={`Занято ${c.units - c.available} из ${c.units}`}
                      />
                      <span>
                        {c.units - c.available} из {c.units}
                      </span>
                    </div>
                  </td>
                  <td className="num">
                    <span className={cx('avail-free', c.available === 0 && 'is-zero')}>
                      {c.available}
                    </span>
                  </td>
                  <td>
                    {c.availableUnitCodes.length ? (
                      <span className="avail-codes" title={c.availableUnitCodes.join(', ')}>
                        {c.availableUnitCodes.slice(0, 6).join(', ')}
                        {c.availableUnitCodes.length > 6 && ` +${c.availableUnitCodes.length - 6}`}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {c.available > 0 ? (
                      <Link
                        className="btn btn--secondary btn--sm"
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
            День выезда не входит. Место свободно, только если свободно на все ночи периода; при
            сохранении брони доступность проверяется повторно.
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
  let weekEnd = today;
  for (let k = 0; k < 6; k++) weekEnd = nextDay(weekEnd);
  // Сам справочник единиц важнее занятости: если шахматка не ответила, показываем номера и
  // прямо говорим, что занятость не загрузилась, — иначе это читается как «в системе пусто» (§7.3)
  const [units, board] = await Promise.all([
    api.inventoryUnits(),
    chessboardApi.board(today, weekEnd).catch(() => null),
  ]);
  return (
    <>
      {!board && <Alert boxed>{BOARD_FAILED}</Alert>}
      <RoomGrid units={units} board={board} />
    </>
  );
}
