import './branches.css';
import { Suspense } from 'react';
import { BranchOverview } from './overview';
import { todayAt, isIsoDate } from '@pms/domain';
import { randomUUID } from 'node:crypto';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Panel, Stack } from '../../components/ui';
import { branchesApi } from '../../lib/api';
import { BranchForm } from './form';
import { selectBranch } from './actions';
import { unstable_rethrow } from 'next/navigation';
export async function BranchWorkspace({
  query,
  createLabel = 'Добавить филиал',
}: {
  query: Record<string, string | string[] | undefined>;
  createLabel?: string;
}) {
  const loaded = await branchesApi.list().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return <LoadError testId="branches-load-error" {...loadErrorProps(loaded.error)} />;
  const { organization, items, canCreate } = loaded.value;
  const today = todayAt(items[0]?.timezone ?? 'UTC');
  const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : today;
  const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : from;
  return (
    <section className="branches-workspace" aria-label="Объекты и филиалы">
      <Stack>
        <Panel>
          <h2>{organization.name}</h2>
          <details>
            <summary>Реквизиты организации</summary>
            <p className="muted">ID: {organization.id}</p>
          </details>
          <p>Один аккаунт, отдельный номерной фонд и настройки каждого филиала.</p>
        </Panel>
        {canCreate && (
          <Panel>
            <details>
              <summary className="branch-create-toggle">{createLabel}</summary>
              <BranchForm id={randomUUID()} />
            </details>
          </Panel>
        )}
        <div
          className="branches-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}
        >
          {items.map((item) => (
            <Panel key={item.id}>
              <h2>{item.name}</h2>
              <p>{item.address || 'Адрес пока не указан'}</p>
              <p>
                {item._count.inventoryUnits} номеров и коек, {item._count.accommodationTypes}{' '}
                категорий
              </p>
              <p>
                Валюта {item.currency}, часовой пояс {item.timezone}
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
      </Stack>
    </section>
  );
}
