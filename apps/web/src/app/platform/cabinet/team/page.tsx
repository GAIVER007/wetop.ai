import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import { CabinetShell, centsToInput, dayText, usd } from '../shell';
import { ExpenseForm, TeamForm } from '../money-forms';
import { FormDialog } from '../form-dialog';
import { NotReady, loadMoney } from '../load-money';

/**
 * Сотрудники компании WETOP (DATA_MODEL §63; владелец 30.10.2026: «раздел сотрудники, там будем добавлять расходы на
 * сотрудников»): кто работает, должность, оклад; «Выплатить» пишет расход по статье «Зарплаты» с именем в заметке,
 * и он сразу в «Деньгах». Выплаты месяца показаны по статье «Зарплаты».
 */
export default async function TeamPage() {
  const t = await serverT();
  return (
    <Page width="full" title={t('Сотрудники WETOP')}>
      <Suspense fallback={<LoadingState label={t('Загружаем сотрудников…')} />}>
        <Team />
      </Suspense>
    </Page>
  );
}

async function Team() {
  const t = await serverT();
  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const { view, error } = await loadMoney(month, t);
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
  const salaries = view.expenses.filter((e) => e.category === 'SALARIES' && !e.voided);
  const paid = salaries.reduce((n, e) => n + BigInt(e.amountCents), 0n);
  const paidTo = (name: string) =>
    salaries.filter((e) => (e.note ?? '').trim() === name.trim()).reduce((n, e) => n + BigInt(e.amountCents), 0n);
  return (
    <CabinetShell active="team" t={t} clients={view.clients.length}>
      <div className="cabinet__head cabinet-money__head">
        <span />
        <div className="cabinet-money__actions">
          <FormDialog label={t('Добавить сотрудника')} title={t('Новый сотрудник')} testId="team-add-dialog">
            <TeamForm member={null} />
          </FormDialog>
        </div>
      </div>
      <Stats min={200}>
        <Stat label={t('Сотрудников')} value={formatInt(active.length)} icon={<Icon name="person" />} testId="team-count" />
        <Stat
          label={t('Оклады в месяц')}
          value={usd(String(payroll))}
          icon={<Icon name="money" />}
          testId="team-payroll"
        />
        <Stat
          label={t('Выплачено в этом месяце')}
          value={usd(String(paid))}
          hint={t('расходы по статье «Зарплаты»')}
          icon={<Icon name="chart" />}
          testId="team-paid"
          href={`/platform/cabinet/money?month=${month}`}
        />
        <Stat
          label={t('Осталось выплатить')}
          value={usd(String(payroll > paid ? payroll - paid : 0n))}
          icon={<Icon name="booking" />}
          testId="team-left"
        />
      </Stats>
      <Panel title={t('Сотрудники')} data-testid="team-list">
        {view.team.length === 0 ? (
          <EmptyState title={t('Сотрудников пока нет. Нажмите «Добавить сотрудника».')} />
        ) : (
          <Table aria-label={t('Сотрудники')}>
            <thead>
              <tr>
                <th>{t('Имя')}</th>
                <th>{t('Должность')}</th>
                <th className="num">{t('Оклад в месяц')}</th>
                <th className="num">{t('Выплачено в месяце')}</th>
                <th aria-label={t('Действия')} />
              </tr>
            </thead>
            <tbody>
              {view.team.map((m) => (
                <tr key={m.id} className={m.active ? undefined : 'cabinet__voided'} data-testid="team-row">
                  <td>
                    <b>{m.name}</b>
                    {m.email && <div className="cabinet__sub muted">{m.email}</div>}
                    {!m.active && <div className="cabinet__sub muted">{t('ушёл')}</div>}
                  </td>
                  <td>{m.role}</td>
                  <td className="num">{usd(m.monthlySalaryCents)}</td>
                  <td className="num">{usd(String(paidTo(m.name)))}</td>
                  <td>
                    <div className="cabinet-money__actions">
                      {m.active && (
                        <FormDialog
                          label={t('Выплатить')}
                          title={t('Выплата: {name}', { name: m.name })}
                          testId="team-pay-dialog"
                        >
                          <ExpenseForm
                            categories={view.categories}
                            today={today}
                            preset={{ category: 'SALARIES', amount: centsToInput(m.monthlySalaryCents), note: m.name }}
                          />
                        </FormDialog>
                      )}
                      <FormDialog label={t('Изменить')} title={m.name} tone="secondary" testId="team-edit-dialog">
                        <TeamForm member={{ ...m, salaryInput: centsToInput(m.monthlySalaryCents) }} />
                      </FormDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {salaries.length > 0 && (
        <Panel title={t('Выплаты этого месяца')} data-testid="team-payouts">
          <Table aria-label={t('Выплаты этого месяца')}>
            <tbody>
              {salaries.map((e) => (
                <tr key={e.id}>
                  <td>{dayText(e.spentOn)}</td>
                  <td>{e.note}</td>
                  <td className="num">{usd(e.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </CabinetShell>
  );
}
