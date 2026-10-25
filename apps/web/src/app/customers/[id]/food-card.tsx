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
import type { Translate } from '../../../i18n';
import { serverT } from '../../../i18n/server';

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

function VisitHistory({
  visits,
  truncated,
  branches,
  t,
}: {
  visits: Visit[];
  truncated: boolean;
  branches: boolean;
  t: Translate;
}) {
  if (visits.length === 0)
    return (
      <EmptyState icon={<Icon name="booking" />} title={t('Броней пока нет')}>
        {t('Первая появится после брони стола для этого гостя.')}
      </EmptyState>
    );
  return (
    <>
      {truncated && <p className="muted">{t('Показаны последние 100 броней.')}</p>}
      <Table className="beauty-customer-history" data-testid="food-customer-history">
        <thead>
          <tr>
            <th>{t('Дата и время')}</th>
            {branches && <th>{t('Филиал')}</th>}
            <th>{t('Стол')}</th>
            <th>{t('Гостей')}</th>
            <th>{t('Статус')}</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => (
            <tr key={visit.id}>
              <td data-label={t('Дата и время')}>
                <time dateTime={visit.startsAt}>{visitDateTime(visit)}</time>
              </td>
              {branches && <td data-label={t('Филиал')}>{visit.location.name}</td>}
              <td data-label={t('Стол')}>{visit.table ? `${visit.table.areaName}, ${tableTitle(visit.table.name)}` : t('Без стола')}</td>
              <td data-label={t('Гостей')}>{visit.partySize}</td>
              <td data-label={t('Статус')}>
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
  const t = await serverT();
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
        {customer.phone ? <a href={`tel:${customer.phone}`}>{formatPhone(customer.phone)}</a> : <span>{t('Телефон не указан')}</span>}
        {customer.email && <span>{customer.email}</span>}
        {visits >= 2 ? <Badge tone="info">{t('Постоянный гость')}</Badge> : <Badge tone="neutral">{t('Новый')}</Badge>}
        {customer.isVip && <Badge tone="warn">VIP</Badge>}
        <span>
          {t('Визитов: {n}', { n: count })}
          {detail.visits.length > visits &&
            t(', всего {count}', { count: pluralRu(detail.visits.length, [t('бронь'), t('брони'), t('броней')]) })}
        </span>
      </p>
      {customer.notes && (
        <>
          <SectionTitle>{t('Заметки')}</SectionTitle>
          <p className="beauty-customer-notes">{customer.notes}</p>
        </>
      )}
      <SectionTitle>{t('Последние брони')}</SectionTitle>
      <VisitHistory visits={detail.visits.slice(0, 3)} truncated={false} branches={branches} t={t} />
    </>
  );
  return (
    <Page
      className="beauty-page"
      width="wide"
      crumbs={<BackCrumb href="/customers">{t('Клиенты')}</BackCrumb>}
      title={name}
      actions={
        <>
          {canBook && customer.status === 'ACTIVE' && (
            <Link className="btn" prefetch={false} href="/table-reservations?new=1">
              {t('Забронировать стол')}
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
        label={t('Разделы карточки клиента')}
        panels={[
          { id: 'customer-overview', label: t('Обзор'), content: overview },
          {
            id: 'customer-visits',
            label: t('История броней'),
            count: detail.visits.length,
            content: <VisitHistory visits={detail.visits} truncated={detail.historyTruncated} branches={branches} t={t} />,
          },
        ]}
      />
    </Page>
  );
}

export const loadFoodCustomer = (id: string) => foodApi.customer(id);
