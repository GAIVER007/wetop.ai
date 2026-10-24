import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { Badge, Button, EmptyState, Input, StatusBadge, Table } from '../../components/ui';
import { Tabs } from '../../components/tabs';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { foodApi } from '../../lib/food-api';
import { completeFoodList, validFoodReservation } from '../../lib/food-data';
import type { FoodCustomer, RestaurantReservation } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { tableTitle } from '../../lib/table-title';
import { countLabel, intlLocale, msg, type DeskLocale, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';
import { currentLocale, serverT } from '../../i18n/server';
import { restaurantShell } from './restaurant-load';
import { CustomerMarks } from './customer-marks';
import { matchesCustomerQuery } from '../../lib/customer-hits';
import './food.css';
import './restaurant.css';
import '../customers/customers.css';

/** Форма новой брони стола: у API ресторана гость создаётся только вместе с бронью */
const NEW_BOOKING = '/table-reservations?new=1';
import { formatPhone } from '../../lib/phone';

const name = (c: { firstName: string; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ');

/** Дата рождения `ГГГГ-ММ-ДД` как «12 октября» на языке человека */
const dayMonth = (iso: string, locale: DeskLocale) =>
  dateFormat(intlLocale(locale), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
const birthdayText = (c: FoodCustomer, t: Translate, locale: DeskLocale) =>
  !c.birthDate
    ? '—'
    : c.birthdayInDays === 0
      ? t('{date}, сегодня', { date: dayMonth(c.birthDate, locale) })
      : (c.birthdayInDays ?? 99) <= 7
        ? t('{date}, через {days}', {
            date: dayMonth(c.birthDate, locale),
            days: countLabel(locale, t, c.birthdayInDays!, [msg('день'), 'дня', msg('дней')]), // kk-allow: форма склонения
          })
        : dayMonth(c.birthDate, locale);

/** «Клиенты и бронирования» по макету (ADR-159): постоянный гость от двух визитов, VIP и дни рождения (§36) */
export async function FoodCustomers({ query = '' }: { query?: string } = {}) {
  const t = await serverT();
  const locale = await currentLocale();
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
      `${r.table ? tableTitle(r.table.name) : t('Без стола')}, ${countLabel(locale, t, r.partySize, [msg('гость'), 'гостя', msg('гостей')])}, ${clock(r.startsAt)}`; // kk-allow: форма склонения
    const customersTable = (
      list: FoodCustomer[],
      empty = t('Клиенты появятся после первого бронирования'),
    ) =>
      list.length === 0 ? (
        <EmptyState
          title={empty}
          actions={
            write && customers.length === 0 ? (
              <Link className="btn" href={NEW_BOOKING}>
                {t('Создать первую бронь')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              {[msg('Клиент'), msg('Телефон'), msg('Визиты'), msg('Метка'), msg('День рождения'), msg('Бронь на сегодня')].map((h) => (
                <th key={h}>{t(h)}</th>
              ))}
              {write && (
                <th>
                  <span className="sr-only">{t('Действия')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const upcoming = upcomingByCustomer.get(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`} prefetch={false}>
                      {name(c)}
                    </Link>
                  </td>
                  <td>{c.phone ? formatPhone(c.phone) : t('Не указан')}</td>
                  <td>{c.visits ?? 0}</td>
                  <td>
                    <span className="food-inline-actions">
                      {c.isVip && <Badge tone="warn">VIP</Badge>}
                      {(c.visits ?? 0) >= 2 && <Badge tone="info">{t('Постоянный гость')}</Badge>}
                      {!c.isVip && (c.visits ?? 0) < 2 && '—'}
                    </span>
                  </td>
                  <td data-testid="customer-birthday">{birthdayText(c, t, locale)}</td>
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
          title={t('Броней на сегодня нет')}
          actions={
            <Link className="btn" href="/table-reservations">
              {t('Открыть бронирования')}
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              {[msg('Время'), msg('Клиент'), msg('Гостей'), msg('Стол'), msg('Статус')].map((h) => (
                <th key={h}>{t(h)}</th>
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
                  <td>{r.table ? `${r.table.areaName}, ${r.table.name}` : t('Без стола')}</td>
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
        title={t('Клиенты')}
        subtitle={t('Клиенты и бронирования. Новый клиент добавляется вместе с бронью стола')}
      >
        {/* панель как у салона (аудит 22.10.2026 P1-5): поиск слева, действия справа. Отдельного создания и импорта
            гостей у API ресторана нет: гость появляется вместе с бронью, поэтому «Добавить клиента» открывает её форму */}
        <div className="beauty-customers-bar" data-testid="food-customers-bar">
          <form className="beauty-customers-bar__filters" method="get" action="/customers" role="search">
            <Input
              type="search"
              name="q"
              defaultValue={search}
              maxLength={100}
              aria-label={t('Поиск по имени или телефону')}
              placeholder={t('Имя или телефон')}
            />
            <Button type="submit" tone="secondary">
              {t('Найти')}
            </Button>
          </form>
          {write && (
            <div className="beauty-customers-bar__actions">
              <Link className="btn" href={NEW_BOOKING}>
                {t('Добавить клиента')}
              </Link>
            </div>
          )}
        </div>
        <div className="food-workspace" data-testid="food-customers">
          <Tabs
            label={t('Клиенты и бронирования')}
            panels={[
              {
                id: 'all',
                label: t('Все'),
                count: found.length,
                content: (
                  <>
                    {search && (
                      <p className="muted" data-testid="food-customers-query">
                        {t('Найдено по запросу «{query}»: {n}.', { query: search, n: found.length })}{' '}
                        <Link href="/customers">{t('Показать всех')}</Link>
                      </p>
                    )}
                    {customersTable(found, search ? t('Клиентов с таким именем или телефоном нет') : undefined)}
                  </>
                ),
              },
              {
                id: 'bookings',
                label: t('Бронирования'),
                count: reservations.length,
                content: bookings,
              },
              {
                id: 'regular',
                label: t('Постоянные гости'),
                count: regulars.length,
                content: customersTable(regulars),
              },
              { id: 'vip', label: 'VIP', count: vips.length, content: customersTable(vips, t('VIP-гостей пока нет: метка ставится кнопкой «Изменить»')) },
              {
                id: 'birthdays',
                label: t('Дни рождения'),
                count: birthdays.length,
                content: customersTable(birthdays, t('В ближайшую неделю дней рождения нет')),
              },
            ]}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Клиенты')}>
        <LoadError testId="food-customers-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
