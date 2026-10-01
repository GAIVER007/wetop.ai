import './branches.css';
import { Suspense } from 'react';
import { BranchOverview } from './overview';
import { todayAt, isIsoDate } from '@pms/domain';
import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { Page } from '../../components/page';
import { Panel, Stack } from '../../components/ui';
import { branchesApi } from '../../lib/api';
import { BranchForm } from './form';
import { selectBranch } from './actions';
export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { organization, items, canCreate } = await branchesApi.list();
  const today = todayAt(items[0]?.timezone ?? 'UTC');
  const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : today;
  const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : from;
  return (
    <Page className="branches-page" width="full" title="Организация и филиалы" subtitle={organization.name}>
      <Stack>
        <form className="branches-period">
          <label>
            С даты
            <input className="inp" type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            По дату
            <input className="inp" type="date" name="to" defaultValue={to} required min={from} />
          </label>
          <button className="btn" type="submit">
            Показать
          </button>
        </form>
        <Suspense fallback={<p role="status">Считаем показатели филиалов…</p>}>
          <BranchOverview from={from} to={to} />
        </Suspense>
        <Panel>
          <h2>{organization.name}</h2>
          <details><summary>Реквизиты организации</summary><p className="muted">ID: {organization.id}</p></details>
          <p>Один аккаунт, отдельный номерной фонд и настройки каждого филиала.</p>
        </Panel>
        <div
          className="branches-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}
        >
          {items.map((item) => (
            <Panel key={item.id}>
              <h2>{item.name}</h2>
              <p>{item.address || 'Адрес пока не указан'}</p>
              <p>
                {item._count.inventoryUnits} номеров и коек · {item._count.accommodationTypes}{' '}
                категорий
              </p>
              <p>
                {item.currency} · {item.timezone}
              </p>
              <p className="muted" style={{ overflowWrap: 'anywhere' }}>
                <small>ID филиала: {item.locationId}</small>
              </p>
              <form action={selectBranch}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn" type="submit">
                  {item._count.inventoryUnits ? 'Открыть филиал' : 'Настроить номера'}
                </button>
              </form>
            </Panel>
          ))}
        </div>
        {canCreate && (
          <Panel>
            <details>
              <summary>Добавить филиал</summary>
              <BranchForm id={randomUUID()} />
            </details>
          </Panel>
        )}
        <Panel>
          <h2>Доступ и подписка WETOP</h2>
          <p>
            Доступ организации:{' '}
            {organization.status === 'ACTIVE'
              ? 'работа разрешена'
              : organization.status === 'READ_ONLY'
                ? 'только просмотр'
                : organization.status === 'TRIAL'
                  ? 'пробный период'
                  : 'приостановлен'}
            .
          </p>
          <p>
            Статус доступа не является подтверждением оплаты. Оплата Core подтверждается главным
            администратором вручную; расширения подключаются отдельно.
          </p>
          <Link href="/today">Вернуться на Главную выбранного филиала</Link>
        </Panel>
      </Stack>
    </Page>
  );
}
