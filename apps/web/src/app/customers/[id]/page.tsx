import { notFound } from 'next/navigation';
import { BackCrumb, Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Badge, EmptyState, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { CustomerMarks } from '../../food/customer-marks';
import { markBeautyCustomer } from '../actions';
import { beautyApi, type BeautyCustomerBonuses, type BeautyCustomerDetail } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { formatMoney } from '../../../lib/money';
import { mayAccess } from '../../../lib/navigation';
import { notFoundOn404 } from '../../../lib/page-error';
import { requireVertical } from '../../../lib/vertical-guard';
import '../../beauty/beauty.css';

type Visit = BeautyCustomerDetail['visits'][number];

const visitDateTime = (visit: Visit) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: visit.location.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(visit.startsAt));

function VisitHistory({ visits, truncated }: { visits: Visit[]; truncated: boolean }) {
  if (visits.length === 0) {
    return (
      <EmptyState icon={<Icon name="booking" />} title="Визитов пока нет">
        Первое появится после создания записи для этого клиента.
      </EmptyState>
    );
  }
  return (
    <>
      {truncated && <p className="muted">Показаны последние 100 визитов.</p>}
      <Table className="beauty-customer-history">
        <thead>
          <tr>
            <th>Дата и время</th>
            <th>Услуги</th>
            <th>Специалисты</th>
            <th>Статус</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => {
            const services =
              visit.lines.length > 0
                ? visit.lines.map((line) => line.service.name)
                : [visit.service.name];
            const masters =
              visit.lines.length > 0
                ? [...new Set(visit.lines.map((line) => line.employee.name))]
                : [visit.employee.name];
            return (
              <tr key={visit.id}>
                <td data-label="Дата и время">
                  <time dateTime={visit.startsAt}>{visitDateTime(visit)}</time>
                </td>
                <td data-label="Услуги">{services.join(', ')}</td>
                <td data-label="Специалисты">{masters.join(', ')}</td>
                <td data-label="Статус">
                  <StatusBadge kind="beauty" value={visit.status} />
                </td>
                <td data-label="Сумма">{formatMoney(visit.priceMinor, visit.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

const BONUS_KIND: Record<BeautyCustomerBonuses['entries'][number]['kind'], string> = {
  ACCRUAL: 'Начислено',
  REDEEM: 'Оплата бонусами',
  REVERSAL: 'Возврат',
  ADJUSTMENT: 'Ручная правка',
};

const entryDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

/** Бонусы клиента (решение 21.10.2026 §2): баланс и история движений */
function BonusHistory({ bonuses }: { bonuses: BeautyCustomerBonuses }) {
  return (
    <>
      <p className="beauty-bonus-balance" data-testid="customer-bonus-balance">
        <span className="muted">Баланс</span>
        <strong>{formatMoney(bonuses.balanceMinor, bonuses.currency)}</strong>
      </p>
      {!bonuses.program.enabled && (
        <p className="muted beauty-loyalty-hint">Бонусная программа выключена в настройках салона.</p>
      )}
      {bonuses.entries.length === 0 ? (
        <p className="muted beauty-loyalty-hint">Движений бонусов пока нет.</p>
      ) : (
        <Table className="beauty-customer-history">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Что</th>
              <th>Сумма</th>
              <th>Причина</th>
            </tr>
          </thead>
          <tbody>
            {bonuses.entries.map((entry) => (
              <tr key={entry.id}>
                <td data-label="Дата">
                  <time dateTime={entry.createdAt}>{entryDate(entry.createdAt)}</time>
                </td>
                <td data-label="Что">{BONUS_KIND[entry.kind]}</td>
                <td data-label="Сумма">
                  {entry.amountMinor.startsWith('-') ? '' : '+'}
                  {formatMoney(entry.amountMinor, entry.currency)}
                </td>
                <td data-label="Причина">{entry.reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default async function BeautyCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireVertical(['BEAUTY']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let detail: BeautyCustomerDetail;
  try {
    detail = await beautyApi.customer(id);
  } catch (error) {
    notFoundOn404(error);
  }
  const shell = await deskShell();
  // бонусы не ломают карточку: при сбое блока просто нет
  const bonuses = await beautyApi.customerBonuses(id).catch(() => null);
  const customer = detail.customer;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
  const canEdit = !shell.readOnly && mayAccess(shell.access, 'desk');
  const overview = (
    <>
      <dl className="beauty-customer-head">
        <div>
          <dt>Телефон</dt>
          <dd>
            {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : 'Не указан'}
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{customer.email ?? 'Не указан'}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>
            <Badge tone={customer.status === 'ACTIVE' ? 'ok' : 'neutral'}>
              {customer.status === 'ACTIVE' ? 'Активен' : 'В архиве'}
            </Badge>
          </dd>
        </div>
        {bonuses && (
          <div>
            <dt>Бонусы</dt>
            <dd data-testid="customer-bonus-head">{formatMoney(bonuses.balanceMinor, bonuses.currency)}</dd>
          </div>
        )}
        <div>
          <dt>Визитов</dt>
          <dd>
            {detail.visits.length}
            {detail.historyTruncated ? '+' : ''}
          </dd>
        </div>
      </dl>
      {customer.notes && (
        <>
          <SectionTitle>Заметки</SectionTitle>
          <p className="beauty-customer-notes">{customer.notes}</p>
        </>
      )}
      <SectionTitle>Последние визиты</SectionTitle>
      <VisitHistory visits={detail.visits.slice(0, 3)} truncated={false} />
    </>
  );
  return (
    <Page
      className="beauty-page"
      width="wide"
      crumbs={<BackCrumb href="/customers">Клиенты</BackCrumb>}
      title={name}
      actions={
        canEdit ? (
          <CustomerMarks
            scopeKey={shell.scopeKey ?? ''}
            customer={{
              id: customer.id,
              name,
              isVip: customer.isVip,
              birthDate: customer.birthDate,
            }}
            save={markBeautyCustomer}
          />
        ) : undefined
      }
    >
      <Tabs
        label="Разделы карточки клиента"
        panels={[
          { id: 'customer-overview', label: 'Обзор', content: overview },
          {
            id: 'customer-visits',
            label: 'История визитов',
            count: detail.visits.length,
            content: <VisitHistory visits={detail.visits} truncated={detail.historyTruncated} />,
          },
          ...(bonuses
            ? [{ id: 'customer-bonuses', label: 'Бонусы', count: bonuses.entries.length, content: <BonusHistory bonuses={bonuses} /> }]
            : []),
        ]}
      />
    </Page>
  );
}
