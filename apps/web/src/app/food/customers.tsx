import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { Badge, EmptyState, StatusBadge, Table } from '../../components/ui';
import { Tabs } from '../../components/tabs';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { foodApi } from '../../lib/food-api';
import { completeFoodList, validFoodReservation } from '../../lib/food-data';
import type { FoodCustomer, RestaurantReservation } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { pluralRu } from '../../lib/plural';
import { restaurantShell } from './restaurant-load';
import './food.css';
import './restaurant.css';

const name = (c: { firstName: string; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ');

/** «Клиенты и бронирования» по макету (ADR-159): постоянный гость — от двух визитов (как Q-GB-2, Q-BS-3) */
export async function FoodCustomers() {
  try {
    const shell = await restaurantShell();
    const [customers, reservations] = await Promise.all([
      completeFoodList<FoodCustomer>(foodApi.customers),
      completeFoodList<RestaurantReservation>(
        (cursor) => foodApi.reservations(shell.date, cursor),
        validFoodReservation,
      ),
    ]);
    const upcomingByCustomer = new Map<string, RestaurantReservation>();
    for (const r of reservations) {
      if (!['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status)) continue;
      const existing = upcomingByCustomer.get(r.customerId);
      if (!existing || r.startsAt < existing.startsAt) upcomingByCustomer.set(r.customerId, r);
    }
    const clock = (iso: string) => localInput(iso, shell.timezone).slice(11, 16);
    const bookingText = (r: RestaurantReservation) =>
      `${r.table ? `Стол ${r.table.name}` : 'Без стола'}, ${pluralRu(r.partySize, ['гость', 'гостя', 'гостей'])}, ${clock(r.startsAt)}`;
    const customersTable = (list: FoodCustomer[]) =>
      list.length === 0 ? (
        <EmptyState title="Клиенты появятся после первого бронирования" />
      ) : (
        <Table>
          <thead>
            <tr>
              {['Клиент', 'Телефон', 'Визиты', 'Метка', 'Бронь на сегодня'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const upcoming = upcomingByCustomer.get(c.id);
              return (
                <tr key={c.id}>
                  <td>{name(c)}</td>
                  <td>{c.phone ?? 'Не указан'}</td>
                  <td>{c.visits ?? 0}</td>
                  <td>{(c.visits ?? 0) >= 2 ? <Badge tone="info">Постоянный гость</Badge> : '—'}</td>
                  <td>{upcoming ? bookingText(upcoming) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      );
    const bookings =
      reservations.length === 0 ? (
        <EmptyState
          title="Броней на сегодня нет"
          actions={
            <Link className="btn" href="/table-reservations">
              Открыть бронирования
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              {['Время', 'Клиент', 'Гостей', 'Стол', 'Статус'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...reservations]
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    {clock(r.startsAt)}–{clock(r.endsAt)}
                  </td>
                  <td>{name(r.customer)}</td>
                  <td>{r.partySize}</td>
                  <td>{r.table ? `${r.table.areaName}, ${r.table.name}` : 'Без стола'}</td>
                  <td>
                    <StatusBadge kind="food" value={r.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </Table>
      );
    const regulars = customers.filter((c) => (c.visits ?? 0) >= 2);
    return (
      <Page
        title="Клиенты"
        subtitle="Клиенты и бронирования. Новый клиент добавляется при создании брони"
      >
        <div className="food-workspace" data-testid="food-customers">
          <Tabs
            label="Клиенты и бронирования"
            panels={[
              { id: 'all', label: 'Все', count: customers.length, content: customersTable(customers) },
              {
                id: 'bookings',
                label: 'Бронирования',
                count: reservations.length,
                content: bookings,
              },
              {
                id: 'regular',
                label: 'Постоянные гости',
                count: regulars.length,
                content: customersTable(regulars),
              },
            ]}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Клиенты">
        <LoadError testId="food-customers-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
