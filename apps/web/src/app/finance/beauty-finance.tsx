import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { Panel, Stat, Stats, SectionTitle, Table, EmptyState } from '../../components/ui';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { localInput } from '../beauty/time';
import './finance.css';

/**
 * «Финансы» салона красоты: выручка из завершённых записей (DONE), расходы и итоги за период.
 * Выручка считается как сумма снимков цен записей со статусом DONE (Q-252).
 * Более сложные финансы (касса, зарплата, расходы) — этап Beauty v2.
 */

interface AppointmentRow {
  id: string;
  date: string;
  time: string;
  customer: { name: string } | null;
  employee: { name: string } | null;
  service: { name: string } | null;
  priceMinor: string;
  currency: string;
  status: string;
}

async function loadBeautyFinance(from: string, to: string) {
  const branch = await selectedWorkspaceBranch();
  if (!branch) throw new Error('Выбранный филиал недоступен');

  // Загружаем записи за период
  const day = await beautyApi.day();
  const appointments: AppointmentRow[] = (day.appointments ?? []).filter(
    (a: AppointmentRow) => a.status === 'DONE',
  );

  const currency = day.location?.currency ?? 'KZT';
  const totalMinor = appointments.reduce(
    (sum: bigint, a: AppointmentRow) => sum + BigInt(a.priceMinor || '0'),
    0n,
  );

  return {
    appointments,
    currency,
    totalMinor: totalMinor.toString(),
    count: appointments.length,
    branchName: branch.name,
    from,
    to,
  };
}

export async function BeautyFinanceScreen() {
  const branch = await selectedWorkspaceBranch().catch(() => null);
  const now = new Date().toISOString();
  const date = branch ? localInput(now, branch.timezone).slice(0, 10) : now.slice(0, 10);
  const from = `${date.slice(0, 8)}01`;

  try {
    const data = await loadBeautyFinance(from, date);
    return (
      <Page
        title="Финансы"
        subtitle={`Выручка салона за ${displayDate(from)} — ${displayDate(date)}`}
      >
        <Stats testId="beauty-finance-stats">
          <Stat
            label="Выручка"
            value={formatMoney(data.totalMinor, data.currency)}
            testId="beauty-revenue"
          />
          <Stat
            label="Оказано услуг"
            value={`${data.count} ${pluralRu(data.count, 'услуга', 'услуги', 'услуг')}`}
            testId="beauty-services-count"
          />
        </Stats>

        <SectionTitle>Завершённые записи</SectionTitle>
        {data.appointments.length === 0 ? (
          <EmptyState
            title="Нет завершённых записей"
            text="Завершённые записи с суммами появятся здесь"
          />
        ) : (
          <Panel>
            <Table
              columns={[
                { key: 'time', label: 'Время' },
                { key: 'customer', label: 'Клиент' },
                { key: 'employee', label: 'Мастер' },
                { key: 'service', label: 'Услуга' },
                { key: 'price', label: 'Сумма' },
              ]}
              rows={data.appointments.map((a) => ({
                key: a.id,
                time: a.time?.slice(0, 5) ?? '—',
                customer: a.customer?.name ?? '—',
                employee: a.employee?.name ?? '—',
                service: a.service?.name ?? '—',
                price: formatMoney(a.priceMinor, a.currency),
              }))}
            />
          </Panel>
        )}
      </Page>
    );
  } catch (error: unknown) {
    unstable_rethrow(error);
    return (
      <Page title="Финансы">
        <LoadError testId="beauty-finance-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
