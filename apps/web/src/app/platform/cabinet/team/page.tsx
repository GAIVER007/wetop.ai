import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { Badge, EmptyState, LoadingState, Panel, Table } from '../../../../components/ui';
import { KpiStrip } from '../kpi-strip';
import { formatInt } from '../../../../lib/dashboard-format';
import { msg } from '../../../../i18n';
import { serverT } from '../../../../i18n/server';
import { CabinetShell, centsToInput, dayText, usd } from '../shell';
import { ExpenseForm, TeamForm } from '../money-forms';
import { FormDialog } from '../form-dialog';
import { NotReady, loadMoney } from '../load-money';

/**
 * Команда WETOP (DATA_MODEL §63; владелец 30.10.2026): люди (ФИО, телефон, почта, зарплата) и цифровые сотрудники
 * (имя и зарплата). «Выплатить» пишет расход по статье «Зарплаты» с именем в заметке, он сразу в «Деньгах».
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const t = await serverT();
  const asked = (await searchParams).show;
  const show: TeamFilter = asked === 'people' || asked === 'digital' || asked === 'left' ? asked : 'active';
  return (
    <Page width="full" title={t('Команда WETOP')}>
      <Suspense fallback={<LoadingState label={t('Загружаем команду…')} />}>
        <Team show={show} />
      </Suspense>
    </Page>
  );
}

type TeamFilter = 'active' | 'people' | 'digital' | 'left';

async function Team({ show }: { show: TeamFilter }) {
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
  const left = payroll > paid ? payroll - paid : 0n;
  const people = active.filter((m) => m.kind !== 'DIGITAL');
  const digital = active.filter((m) => m.kind === 'DIGITAL');
  const byFilter = (f: TeamFilter) =>
    f === 'people' ? people : f === 'digital' ? digital : f === 'left' ? view.team.filter((m) => !m.active) : active;
  const rows = byFilter(show);
  return (
    <CabinetShell active="team" t={t} clients={view.clients.length}>
      {/* «Команда WETOP» (владелец 01.11.2026): полоса цифр как «Сайт wetop.ai», фильтры «стекло», строка на человека */}
      <KpiStrip
        testId="team-strip"
        items={[
          {
            id: 'count',
            label: t('В команде'),
            value: formatInt(active.length),
            hint: t('людей {p}, цифровых {d}', { p: formatInt(people.length), d: formatInt(digital.length) }),
          },
          { id: 'payroll', label: t('Оклады в месяц'), value: usd(String(payroll)) },
          { id: 'paid', label: t('Выплачено за месяц'), value: usd(String(paid)), tone: paid > 0n ? 'success' : undefined, href: `/platform/cabinet/money?tab=expenses&month=${month}` },
          { id: 'left', label: t('Осталось выплатить'), value: usd(String(left)), tone: left > 0n ? 'warning' : undefined },
        ]}
      />
      <div className="team-a__bar">
        <nav className="glass-tabs" aria-label={t('Показать')}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === 'active' ? '/platform/cabinet/team' : `/platform/cabinet/team?show=${f}`}
              aria-current={f === show ? 'page' : undefined}
              prefetch={false}
              data-testid={`team-filter-${f}`}
            >
              {t(FILTER_LABEL[f])} <span className="cabinet__count">{formatInt(byFilter(f).length)}</span>
            </Link>
          ))}
        </nav>
        <div className="cabinet-money__actions">
          <FormDialog label={t('Добавить сотрудника')} title={t('Новый сотрудник')} testId="team-add-dialog">
            <TeamForm member={null} kind="PERSON" />
          </FormDialog>
          <FormDialog label={t('Добавить цифрового сотрудника')} title={t('Цифровой сотрудник')} tone="secondary" testId="team-add-digital-dialog">
            <TeamForm member={null} kind="DIGITAL" />
          </FormDialog>
        </div>
      </div>
      <Panel title={t('Команда WETOP')} data-testid="team-list" className="cabinet-people">
        {rows.length === 0 ? (
          <EmptyState title={view.team.length === 0 ? t('В команде пока никого. Нажмите «Добавить сотрудника».') : t('Здесь пока никого.')} />
        ) : (
          <Table aria-label={t('Команда WETOP')} className="team-a__table">
            <thead>
              <tr>
                <th>{t('Сотрудник')}</th>
                <th>{t('Должность')}</th>
                <th className="num">{t('Оклад')}</th>
                <th className="num">{t('Выплачено')}</th>
                <th className="num">{t('Осталось')}</th>
                <th aria-label={t('Действия')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const got = paidTo(m.name);
                const salary = BigInt(m.monthlySalaryCents ?? '0');
                const rest = m.active && salary > got ? salary - got : 0n;
                return (
                  <tr key={m.id} className={m.active ? undefined : 'cabinet__voided'} data-testid="team-row">
                    <td>
                      <span className="team-a__who">
                        <span className="team-a__avatar" aria-hidden="true">{initials(m.name)}</span>
                        <span>
                          <b>{m.name}</b>
                          {(m.phone || m.email) && <span className="team-a__contact">{m.phone ?? m.email}</span>}
                        </span>
                      </span>
                    </td>
                    <td>
                      {m.kind === 'DIGITAL' ? <Badge tone="info">{t('цифровой сотрудник')}</Badge> : m.role || ''}
                      {!m.active && <Badge tone="neutral">{t('ушёл')}</Badge>}
                    </td>
                    <td className="num">{usd(m.monthlySalaryCents)}</td>
                    <td className="num">{usd(String(got))}</td>
                    <td className="num" data-testid="team-row-left">
                      {rest > 0n ? <b>{usd(String(rest))}</b> : m.active && salary > 0n ? <Badge tone="ok">{t('выплачено')}</Badge> : ''}
                    </td>
                    <td>
                      <div className="cabinet-money__actions">
                        {m.active && (
                          <FormDialog label={t('Выплатить')} title={t('Выплата: {name}', { name: m.name })} size="sm" testId="team-pay-dialog">
                            <ExpenseForm
                              categories={view.categories}
                              today={today}
                              preset={{ category: 'SALARIES', amount: centsToInput(rest > 0n ? String(rest) : m.monthlySalaryCents), note: m.name }}
                            />
                          </FormDialog>
                        )}
                        <FormDialog label={t('Изменить')} title={m.name} tone="secondary" size="sm" testId="team-edit-dialog">
                          <TeamForm member={{ ...m, salaryInput: centsToInput(m.monthlySalaryCents) }} />
                        </FormDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
      {salaries.length > 0 && (
        <Panel title={t('Выплаты этого месяца')} data-testid="team-payouts">
          <Table aria-label={t('Выплаты этого месяца')} className="team-a__table">
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

const FILTERS: TeamFilter[] = ['active', 'people', 'digital', 'left'];
const FILTER_LABEL: Record<TeamFilter, string> = {
  active: msg('Работают'),
  people: msg('Люди'),
  digital: msg('Цифровые'),
  left: msg('Ушли'),
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
