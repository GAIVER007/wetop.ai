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
import { CustomerMarks } from './customer-marks';
import { matchesCustomerQuery } from '../../lib/customer-hits';
import './food.css';
import './restaurant.css';

const name = (c: { firstName: string; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ');

/** Дата рождения `ГГГГ-ММ-ДД` как «12 октября» */
const dayMonth = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const birthdayText = (c: FoodCustomer) =>
  !c.birthDate
    ? '—'
    : c.birthdayInDays === 0
      ? `${dayMonth(c.birthDate)}, сегодня`
      : (c.birthdayInDays ?? 99) <= 7
        ? `${dayMonth(c.birthDate)}, через ${pluralRu(c.birthdayInDays!, ['день', 'дня', 'дней'])}`
        : dayMonth(c.birthDate);

/** «Клиенты и бронирования» по макету (ADR-159): постоянный гость от двух визитов, VIP и дни рождения (§36) */
export async function FoodCustomers({ query = '' }: { query?: string } = {}) {
  try {
    const shell = await restaurantShell();
    const write = shell.canDesk && !shell.readOnly;
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
    const customersTable = (
      list: FoodCustomer[],
      empty = 'Клиенты появятся после первого бронирования',
    ) =>
      list.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <Table>
          <thead>
            <tr>
              {['Клиент', 'Телефон', 'Визиты', 'Метка', 'День рождения', 'Бронь на сегодня'].map((h) => (
                <th key={h}>{h}</th>
              ))}
              {write && (
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              )}
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
                  <td>
                    <span className="food-inline-actions">
                      {c.isVip && <Badge tone="warn">VIP</Badge>}
                      {(c.visits ?? 0) >= 2 && <Badge tone="info">Постоянный гость</Badge>}
                      {!c.isVip && (c.visits ?? 0) < 2 && '—'}
                    </span>
                  </td>
                  <td data-testid="customer-birthday">{birthdayText(c)}</td>
                  <td>{upcoming ? bookingText(upcoming) : '—'}</td>
                  {write && (
                    <td>
                      <CustomerMarks
                        scopeKey={shell.scopeKey}
                        customer={{
                          id: c.id,
                          name: name(c),
                          isVip: c.isVip ?? false,
                          birthDate: c.birthDate ?? null,
                        }}
                      />
                    </td>
                  )}
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
    // `?q=` из поиска в шапке (аудит 22.10.2026 P1-4): вкладка «Все» сразу показывает найденного гостя
    const search = query.trim();
    const found = search ? customers.filter((c) => matchesCustomerQuery(c, search)) : customers;
    const regulars = customers.filter((c) => (c.visits ?? 0) >= 2);
    const vips = customers.filter((c) => c.isVip);
    const birthdays = customers
      .filter((c) => c.birthdayInDays != null && c.birthdayInDays <= 7)
      .sort((a, b) => a.birthdayInDays! - b.birthdayInDays!);
    return (
      <Page
        title="Клиенты"
        subtitle="Клиенты и бронирования. Новый клиент добавляется при создании брони"
      >
        <div className="food-workspace" data-testid="food-customers">
          <Tabs
            label="Клиенты и бронирования"
            panels={[
              {
                id: 'all',
                label: 'Все',
                count: found.length,
                content: (
                  <>
                    {search && (
                      <p className="muted" data-testid="food-customers-query">
                        Найдено по запросу «{search}»: {found.length}.{' '}
                        <Link href="/customers">Показать всех</Link>
                      </p>
                    )}
                    {customersTable(found, search ? 'Клиентов с таким именем или телефоном нет' : undefined)}
                  </>
                ),
              },
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
              { id: 'vip', label: 'VIP', count: vips.length, content: customersTable(vips, 'VIP-гостей пока нет: метка ставится кнопкой «Изменить»') },
              {
                id: 'birthdays',
                label: 'Дни рождения',
                count: birthdays.length,
                content: customersTable(birthdays, 'В ближайшую неделю дней рождения нет'),
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
