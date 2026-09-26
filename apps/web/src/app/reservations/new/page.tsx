import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import { api, reservationsApi } from '../../../lib/api';
import { hotelToday } from '../../../lib/hotel-api';
import { Page } from '../../../components/page';
import { Alert, Button, Field } from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { pluralRu } from '../../../lib/plural';
import { NewReservationForm } from './form';
import '../../directory.css';

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Slice 3, шаг 3.5: форма ручной брони. Доступность и ячейки — по датам из адресной строки. */
export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const q = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const arrival = q.arrival ?? today;
  const departure = q.departure ?? (isDate(arrival) ? plusDays(arrival, 1) : '');
  const validDates = isDate(arrival) && isDate(departure) && departure > arrival;
  // Без справочника фонда или тарифов бронь не создать — но это предупреждение на месте, не экран ошибки
  const [summary, ratePlans, availability, piiStorage] = await Promise.all([
    api.inventorySummary().catch(() => null),
    reservationsApi.ratePlans().catch(() => null),
    validDates ? reservationsApi.availability(arrival, departure) : Promise.resolve(null),
    api.piiStorage(),
  ]);
  return (
    <Page width="narrow" crumbs={<Link href="/chessboard">← шахматка</Link>} title="Новая бронь">
      {/* Шаг 01 — даты: отдельная GET-форма (доступность считается сервером на эти даты), но в
          общем ряду шагов с размещением (02) и гостем (03) */}
      <section className="panel panel--lg booking-dates" aria-labelledby="booking-dates-title">
        <div className="form-section-title">
          <span>01</span>
          <div>
            <h2 id="booking-dates-title">Даты</h2>
          </div>
        </div>
        <form method="get" className="row row--end row--lg booking-dates__form">
          {q.unit && <input type="hidden" name="unit" value={q.unit} />}
          <Field label="Заезд">
            <DateInput name="arrival" defaultValue={arrival} />
          </Field>
          <Field label="Выезд">
            <DateInput name="departure" rangeFromName="arrival" defaultValue={departure} />
          </Field>
          <Button type="submit" tone="secondary">
            Проверить доступность
          </Button>
        </form>
        {availability ? (
          <p data-testid="availability" className="booking-dates__availability">
            {pluralRu(availability.nights, ['ночь', 'ночи', 'ночей'])}, свободно{' '}
            {availability.total.available} из {availability.total.units} ячеек
            {summary?.byCategory.length
              ? `: ${summary.byCategory
                  .map((c) => `${c.name} — ${availability.byCategory[c.code]?.available ?? 0}`)
                  .join(', ')}`
              : ''}
            .
          </p>
        ) : (
          <p className="danger-text">Даты некорректны: выезд должен быть позже заезда.</p>
        )}
      </section>
      {ratePlans === null && (
        <Alert boxed tone="warning">
          Справочник тарифов не загрузился: без тарифа бронь не создать. Обновите страницу.
        </Alert>
      )}
      {summary === null && (
        <Alert boxed tone="warning">
          Сводка фонда не загрузилась: без категорий бронь не создать. Обновите страницу.
        </Alert>
      )}
      {summary !== null && ratePlans !== null && (
        <NewReservationForm
          key={`${arrival}-${departure}-${q.unit ?? ''}`}
          selectedUnit={q.unit ?? ''}
          canSubmit={availability !== null}
          arrival={arrival}
          departure={departure}
          categories={summary.byCategory.map((c) => ({
            code: c.code,
            name: c.name,
            capacityAdults: c.capacityAdults,
            availableUnitCodes: availability?.byCategory[c.code]?.availableUnitCodes ?? [],
          }))}
          ratePlans={ratePlans}
          piiStorage={piiStorage}
        />
      )}
    </Page>
  );
}
