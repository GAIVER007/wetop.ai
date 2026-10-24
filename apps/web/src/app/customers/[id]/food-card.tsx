import Link from 'next/link';
import { BackCrumb, Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Badge, EmptyState, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { CustomerMarks } from '../../food/customer-marks';
import { foodApi } from '../../../lib/food-api';
import type { FoodCustomerDetail } from '../../../lib/food-types';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { pluralRu } from '../../../lib/plural';
import { tableTitle } from '../../../lib/table-title';
import { formatPhone } from '../../../lib/phone';

type Visit = FoodCustomerDetail['visits'][number];

const visitDateTime = (visit: Visit) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: visit.location.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(visit.startsAt));

/** Визит ресторана: гость посажен или бронь завершена (то же правило, что «Постоянный гость» в списке, ADR-159) */
const isVisit = (visit: Visit) => visit.status === 'SEATED' || visit.status === 'COMPLETED';

function VisitHistory({ visits, truncated, branches }: { visits: Visit[]; truncated: boolean; branches: boolean }) {
  if (visits.length === 0)
    return (
      <EmptyState icon={<Icon name="booking" />} title="Броней пока нет">
        Первая появится после брони стола для этого гостя.
      </EmptyState>
    );
  return (
    <>
      {truncated && <p className="muted">Показаны последние 100 броней.</p>}
      <Table className="beauty-customer-history" data-testid="food-customer-history">
        <thead>
          <tr>
            <th>Дата и время</th>
            {branches && <th>Филиал</th>}
            <th>Стол</th>
            <th>Гостей</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => (
            <tr key={visit.id}>
              <td data-label="Дата и время">
                <time dateTime={visit.startsAt}>{visitDateTime(visit)}</time>
              </td>
              {branches && <td data-label="Филиал">{visit.location.name}</td>}
              <td data-label="Стол">{visit.table ? `${visit.table.areaName}, ${tableTitle(visit.table.name)}` : 'Без стола'}</td>
              <td data-label="Гостей">{visit.partySize}</td>
              <td data-label="Статус">
                <StatusBadge kind="food" value={visit.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

/**
 * Карточка клиента ресторана (решение владельца 23.10.2026 п. 4): тот же вид, что у салона, история из броней
 * столов. Суммы нет: заказ с гостем в модели не связан (Q-FOOD-CUSTOMER-1), чисел не подбираем.
 */
export async function FoodCustomerCard({ detail }: { detail: FoodCustomerDetail }) {
  const shell = await deskShell();
  const customer = detail.customer;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
  const canEdit = !shell.readOnly && mayAccess(shell.access, 'desk');
  const canBook = !shell.readOnly && mayAccess(shell.access, 'orders');
  const visits = detail.visits.filter(isVisit).length;
  const branches = new Set(detail.visits.map((v) => v.location.id)).size > 1;
  const count = `${visits}${detail.historyTruncated ? '+' : ''}`;
  const overview = (
    <>
      <p className="beauty-customer-contacts">
        {customer.phone ? <a href={`tel:${customer.phone}`}>{formatPhone(customer.phone)}</a> : <span>Телефон не указан</span>}
        {customer.email && <span>{customer.email}</span>}
        {visits >= 2 ? <Badge tone="info">Постоянный гость</Badge> : <Badge tone="neutral">Новый</Badge>}
        {customer.isVip && <Badge tone="warn">VIP</Badge>}
        <span>
          Визитов: {count}
          {detail.visits.length > visits && `, всего ${pluralRu(detail.visits.length, ['бронь', 'брони', 'броней'])}`}
        </span>
      </p>
      {customer.notes && (
        <>
          <SectionTitle>Заметки</SectionTitle>
          <p className="beauty-customer-notes">{customer.notes}</p>
        </>
      )}
      <SectionTitle>Последние брони</SectionTitle>
      <VisitHistory visits={detail.visits.slice(0, 3)} truncated={false} branches={branches} />
    </>
  );
  return (
    <Page
      className="beauty-page"
      width="wide"
      crumbs={<BackCrumb href="/customers">Клиенты</BackCrumb>}
      title={name}
      actions={
        <>
          {canBook && customer.status === 'ACTIVE' && (
            <Link className="btn" prefetch={false} href="/table-reservations?new=1">
              Забронировать стол
            </Link>
          )}
          {canEdit && (
            <CustomerMarks
              scopeKey={shell.scopeKey ?? ''}
              customer={{ id: customer.id, name, isVip: customer.isVip, birthDate: customer.birthDate }}
            />
          )}
        </>
      }
    >
      <Tabs
        label="Разделы карточки клиента"
        panels={[
          { id: 'customer-overview', label: 'Обзор', content: overview },
          {
            id: 'customer-visits',
            label: 'История броней',
            count: detail.visits.length,
            content: <VisitHistory visits={detail.visits} truncated={detail.historyTruncated} branches={branches} />,
          },
        ]}
      />
    </Page>
  );
}

export const loadFoodCustomer = (id: string) => foodApi.customer(id);
