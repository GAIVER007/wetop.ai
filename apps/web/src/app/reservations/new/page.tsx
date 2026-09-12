import Link from 'next/link';
import { api, reservationsApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { Button, Field, Input } from '../../../components/ui';
import { NewReservationForm } from './form';

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Slice 3, шаг 3.5: форма ручной брони. Доступность и ячейки — по датам из адресной строки. */
export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ arrival?: string; departure?: string }>;
}) {
  const q = await searchParams;
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const arrival = q.arrival ?? today;
  const departure = q.departure ?? plusDays(arrival, 1);
  const [summary, ratePlans, availability] = await Promise.all([
    api.inventorySummary(),
    reservationsApi.ratePlans(),
    reservationsApi.availability(arrival, departure).catch(() => null),
  ]);
  return (
    <Page width="narrow" crumbs={<Link href="/chessboard">← шахматка</Link>} title="Новая бронь">
      <form method="get" className="row row--end row--lg toolbar">
        <Field label="Заезд">
          <Input type="date" name="arrival" defaultValue={arrival} />
        </Field>
        <Field label="Выезд">
          <Input type="date" name="departure" defaultValue={departure} />
        </Field>
        <Button type="submit" tone="secondary">
          Проверить доступность
        </Button>
      </form>
      {availability ? (
        <div data-testid="availability" className="hint--lg toolbar">
          {availability.nights} ноч. · свободно {availability.total.available} из{' '}
          {availability.total.units} ячеек:{' '}
          {summary.byCategory
            .map((c) => `${c.name} — ${availability.byCategory[c.code]?.available ?? 0}`)
            .join(' · ')}
        </div>
      ) : (
        <div className="danger-text toolbar">Даты некорректны: выезд должен быть позже заезда.</div>
      )}
      <NewReservationForm
        arrival={arrival}
        departure={departure}
        categories={summary.byCategory.map((c) => ({
          code: c.code,
          name: c.name,
          availableUnitCodes: availability?.byCategory[c.code]?.availableUnitCodes ?? [],
        }))}
        ratePlans={ratePlans}
      />
    </Page>
  );
}
