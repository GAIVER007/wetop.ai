import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformCabinet, type PlatformGrowth } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import type { Translate } from '../../../../i18n';
import { unstable_rethrow } from 'next/navigation';
import { CabinetShell, dayText, usd } from '../shell';
import { ClientStatus, withUsText } from '../growth-parts';

type Filter = 'all' | 'trial' | 'paying' | 'unpaid' | 'left';
const FILTERS: Filter[] = ['all', 'trial', 'paying', 'unpaid', 'left'];
const FILTER_STATUS: Record<Exclude<Filter, 'all'>, PlatformGrowth['clients'][number]['status']> = {
  trial: 'TRIAL',
  paying: 'ACTIVE',
  unpaid: 'READ_ONLY',
  left: 'SUSPENDED',
};

/**
 * Клиенты WETOP (владелец 29.10.2026, вариант «Б» вкладкой): строка на клиента: статус, «оплачено до», LTV, сколько
 * с нами, вход и работа за 30 дней. Имя клиента ведёт к карточке организации («Доступ») (там пробный, оплата, расширения).
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const filter = (FILTERS as string[]).includes(String(q['show'])) ? (q['show'] as Filter) : 'all';
  return (
    <Page width="full" title={t('Клиенты WETOP')}>
      <Suspense fallback={<LoadingState label={t('Считаем клиентов…')} />}>
        <Clients filter={filter} />
      </Suspense>
    </Page>
  );
}

async function Clients({ filter }: { filter: Filter }) {
  const t = await serverT();
  let view: PlatformCabinet;
  let growth: PlatformGrowth;
  try {
    [view, growth] = await Promise.all([platformApi.cabinet(), platformApi.growth(new Date().toISOString().slice(0, 7))]);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return <EmptyState title={t('Кабинет компании видит только главный администратор.')} data-testid="cabinet-forbidden" />;
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  const work = new Map(view.clients.map((c) => [c.id, c]));
  const shown = (f: Filter) => growth.clients.filter((c) => (f === 'all' ? c.status !== 'SUSPENDED' : c.status === FILTER_STATUS[f]));
  const rows = shown(filter);
  const now = Date.now();
  const label: Record<Filter, string> = {
    all: t('Все'),
    trial: t('Пробный'),
    paying: t('Платят'),
    unpaid: t('Не оплатили'),
    left: t('Ушли'),
  };
  return (
    <CabinetShell active="clients" t={t} clients={view.totals.clients}>
      <Stats min={180}>
        <Stat
          label={t('Клиенты')}
          value={formatInt(view.totals.clients)}
          hint={t('ушли за месяц: {n}, в прошлом: {p}', {
            n: formatInt(growth.churn?.count ?? 0),
            p: formatInt(growth.churn?.previous ?? 0),
          })}
          icon={<Icon name="guests" />}
          testId="clients-total"
        />
        <Stat
          label={t('Люди у клиентов')}
          value={formatInt(view.totals.people)}
          hint={t('входили за 7 дней: {n}', { n: formatInt(view.totals.activePeople7d) })}
          icon={<Icon name="person" />}
          testId="cabinet-people"
        />
        <Stat label={t('MRR, в месяц')} value={usd(growth.kpi.mrrCents)} icon={<Icon name="chart" />} tone="success" />
        <Stat label={t('Средний LTV')} value={usd(growth.kpi.avgLtvCents)} icon={<Icon name="money" />} />
      </Stats>
      <Panel title={t('Клиенты')} className="cabinet__clients">
        <nav className="cabinet__filters" aria-label={t('Показать')}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === 'all' ? '/platform/cabinet/clients' : `/platform/cabinet/clients?show=${f}`}
              aria-current={f === filter ? 'page' : undefined}
              prefetch={false}
              data-testid={`clients-filter-${f}`}
            >
              {label[f]} <span className="cabinet__count">{formatInt(shown(f).length)}</span>
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <EmptyState title={t('Здесь пока никого нет.')} />
        ) : (
          <Table aria-label={t('Клиенты')} data-testid="cabinet-clients-table">
            <thead>
              <tr>
                <th>{t('Клиент')}</th>
                <th>{t('Статус')}</th>
                <th>{t('В месяц')}</th>
                <th>{t('Оплачено до')}</th>
                <th>{t('LTV')}</th>
                <th>{t('С нами')}</th>
                <th>{t('Входили')}</th>
                <th title={t('Брони и записи за 30 дней')}>{t('За 30 дней')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const w = work.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        className="cabinet__client-name"
                        href={`/platform/cabinet/clients/${c.id}`}
                        prefetch={false}
                        aria-label={t('Карточка клиента: {name}', { name: c.name })}
                      >
                        {c.name}
                      </Link>
                      {w?.owner && <span className="muted cabinet__sub cabinet__client-owner">{w.owner}</span>}
                    </td>
                    <td>
                      <ClientStatus client={c} t={t} />
                    </td>
                    <td>{c.monthlyCents ? usd(c.monthlyCents) : t('нет')}</td>
                    <td>{c.paidUntil ? dayText(c.paidUntil) : t('нет')}</td>
                    <td>{usd(c.ltvCents)}</td>
                    <td>{withUsText(c.daysWithUs, t)}</td>
                    <td>{loginText(w?.lastLoginAt ?? null, now, t)}</td>
                    <td>{formatInt(w?.records30d ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </CabinetShell>
  );
}

function loginText(iso: string | null, now: number, t: Translate): string {
  if (!iso) return t('не входили');
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t('сегодня');
  if (days === 1) return t('вчера');
  return t('{n} дн. назад', { n: formatInt(days) });
}
