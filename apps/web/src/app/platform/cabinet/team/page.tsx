import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import { CabinetShell, centsToInput, usd } from '../shell';
import { TeamForm } from '../money-forms';
import { NotReady, loadMoney } from '../load-money';

/** Команда компании WETOP (DATA_MODEL §63): кто работает, должность и зарплата в долларах */
export default async function TeamPage() {
  const t = await serverT();
  return (
    <Page width="full" title={t('Команда WETOP')}>
      <Suspense fallback={<LoadingState label={t('Загружаем команду…')} />}>
        <Team />
      </Suspense>
    </Page>
  );
}

async function Team() {
  const t = await serverT();
  const { view, error } = await loadMoney(new Date().toISOString().slice(0, 7), t);
  if (!view)
    return (
      <CabinetShell active="team" t={t}>
        {error}
      </CabinetShell>
    );
  if (!view.ready)
    return (
      <CabinetShell active="team" t={t}>
        <NotReady t={t} />
      </CabinetShell>
    );
  const active = view.team.filter((m) => m.active);
  const payroll = active.reduce((n, m) => n + BigInt(m.monthlySalaryCents ?? '0'), 0n);
  return (
    <CabinetShell
      active="team"
      t={t}
      clients={view.clients.length}
      side={
        <Panel title={t('Добавить в команду')}>
          <TeamForm member={null} />
        </Panel>
      }
    >
      <Stats min={200}>
        <Stat
          label={t('В команде')}
          value={formatInt(active.length)}
          icon={<Icon name="person" />}
          testId="team-count"
        />
        <Stat
          label={t('Зарплаты в месяц')}
          value={usd(String(payroll))}
          icon={<Icon name="money" />}
          testId="team-payroll"
        />
      </Stats>
      <Panel title={t('Команда WETOP')} data-testid="team-list">
        {view.team.length === 0 ? (
          <EmptyState title={t('В команде пока никого. Добавьте первого сотрудника.')} />
        ) : (
          <Table aria-label={t('Команда WETOP')}>
            <thead>
              <tr>
                <th>{t('Имя')}</th>
                <th>{t('Должность')}</th>
                <th>{t('Зарплата в месяц')}</th>
                <th>{t('Изменить')}</th>
              </tr>
            </thead>
            <tbody>
              {view.team.map((m) => (
                <tr key={m.id} className={m.active ? undefined : 'cabinet__voided'}>
                  <td>
                    <b>{m.name}</b>
                    {m.email && <div className="cabinet__sub muted">{m.email}</div>}
                    {!m.active && <div className="cabinet__sub muted">{t('ушёл')}</div>}
                  </td>
                  <td>{m.role}</td>
                  <td>{usd(m.monthlySalaryCents)}</td>
                  <td>
                    <details className="cabinet__plan">
                      <summary>{t('Изменить')}</summary>
                      <TeamForm
                        member={{ ...m, salaryInput: centsToInput(m.monthlySalaryCents) }}
                      />
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </CabinetShell>
  );
}
