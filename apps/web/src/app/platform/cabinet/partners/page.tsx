import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { Badge, EmptyState, Input, LoadingState, Panel, Table } from '../../../../components/ui';
import { platformApi, type PlatformPartners } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import { CabinetShell, centsToInput, usd } from '../shell';
import { FormDialog } from '../form-dialog';
import { PartnerClientsForm, PartnerCreateInviteForm, PartnerForm, PartnerInviteForm, PartnerPayoutForm, VoidButton } from '../money-forms';
import { percentText } from '../growth-parts';

/**
 * Партнёры WETOP, вариант A (владелец 01.11.2026, «давай а»): итоги в один ряд, поиск и фильтры «стекло», таблица
 * партнёров одной строкой с «Выплатить», справа последние выплаты с отменой и «Как считается». Всё в один экран.
 * «Выплатить» пишет расход «Партнёрам», он сразу в «Деньгах»; отмена выплаты возвращает долг партнёру.
 * Клиента партнёру назначают здесь («Клиенты») или в карточке клиента. DATA_MODEL §63.1, §63.2.
 */
export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await serverT();
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
  return (
    <Page width="full" title={t('Партнёры WETOP')}>
      <Suspense fallback={<LoadingState label={t('Загружаем партнёров…')} />}>
        <Partners show={one(q['show'])} search={one(q['q']).trim()} />
      </Suspense>
    </Page>
  );
}

/** Сотые доли процента в «20%» или «12,5%» */
const bpText = (bp: number) => percentText(Math.floor(bp / 10));
/** Сотые доли процента в значение поля: 1250 в «12.5» */
const bpInput = (bp: number) => {
  const rest = bp % 100;
  return `${Math.floor(bp / 100)}${rest ? `.${String(rest).padStart(2, '0').replace(/0$/, '')}` : ''}`;
};
const FILTERS = ['active', 'due', 'all'] as const;
type Filter = (typeof FILTERS)[number];
/** «28.10» из «2026-10-28» */
const shortDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

async function Partners({ show, search }: { show: string; search: string }) {
  const t = await serverT();
  const today = new Date().toISOString().slice(0, 10);
  let view: PlatformPartners;
  try {
    view = await platformApi.partners();
  } catch (error) {
    unstable_rethrow(error);
    return (
      <CabinetShell active="partners" t={t}>
        <LoadError testId="partners-error" {...loadErrorProps(error)} />
      </CabinetShell>
    );
  }
  if (!view.ready)
    return (
      <CabinetShell active="partners" t={t}>
        <EmptyState title={t('Партнёры ещё не подключены: сервер обновится сам.')} />
      </CabinetShell>
    );
  const tot = view.totals;
  const filter: Filter = (FILTERS as readonly string[]).includes(show) ? (show as Filter) : 'active';
  const clientsOf = (id: string) => view.clients.filter((c) => c.partnerId === id);
  const needle = search.toLocaleLowerCase('ru');
  const byFilter = (f: Filter) =>
    view.partners.filter((p) => (f === 'all' ? true : f === 'active' ? p.active : p.active && p.dueCents !== '0'));
  const rows = byFilter(filter).filter(
    (p) =>
      !needle ||
      [p.name, p.phone ?? '', p.email ?? '', ...clientsOf(p.id).map((c) => c.name)].some((s) => s.toLocaleLowerCase('ru').includes(needle)),
  );
  const payouts = (view.payouts ?? []).slice(0, 8);
  const dueCount = view.partners.filter((p) => p.active && p.dueCents !== '0').length;
  const href = (f: Filter) => {
    const u = new URLSearchParams();
    if (f !== 'active') u.set('show', f);
    if (search) u.set('q', search);
    const s = u.toString();
    return `/platform/cabinet/partners${s ? `?${s}` : ''}`;
  };
  const label: Record<Filter, string> = { active: t('Работают'), due: t('К выплате'), all: t('Все') };
  return (
    <CabinetShell active="partners" t={t}>
      <div className="partners-a">
        <div className="partners-a__bar">
          <form className="partners-a__search" action="/platform/cabinet/partners" role="search" data-testid="partners-search">
            {filter !== 'active' && <input type="hidden" name="show" value={filter} />}
            <label className="sr-only" htmlFor="partners-q">
              {t('Поиск партнёра')}
            </label>
            <Input id="partners-q" name="q" type="search" defaultValue={search} placeholder={t('Поиск: имя, телефон, клиент')} />
          </form>
          <nav className="partners-a__filters" aria-label={t('Показать')}>
            {FILTERS.map((f) => (
              <Link key={f} href={href(f)} aria-current={f === filter ? 'page' : undefined} prefetch={false} data-testid={`partners-filter-${f}`}>
                {label[f]} <span className="cabinet__count">{formatInt(byFilter(f).length)}</span>
              </Link>
            ))}
          </nav>
          {/* ТЗ 01.11.2026: партнёр и ссылка приглашения одним окном */}
          <FormDialog label={t('Пригласить партнёра')} title={t('Пригласить партнёра')} testId="partner-create-invite-dialog">
            <PartnerCreateInviteForm />
          </FormDialog>
          <FormDialog label={t('Добавить партнёра')} title={t('Новый партнёр')} tone="secondary" testId="partner-add-dialog">
            <PartnerForm partner={null} />
          </FormDialog>
        </div>
        <dl className="partners-a__kpis">
          <div data-testid="partners-count">
            <dt>{t('Партнёров')}</dt>
            <dd>{formatInt(tot.partners)}</dd>
            <span className="muted">{t('работают {n}', { n: formatInt(view.partners.filter((p) => p.active).length) })}</span>
          </div>
          <div data-testid="partners-clients">
            <dt>{t('Клиентов привели')}</dt>
            <dd>{formatInt(tot.connected)}</dd>
            <span className="muted">{t('ещё на пробном {n}', { n: formatInt(tot.trials) })}</span>
          </div>
          <div data-tone="success">
            <dt>{t('Доход от их клиентов')}</dt>
            <dd data-testid="partners-income">{usd(tot.incomeCents)}</dd>
            <span className="muted">{t('за всё время')}</span>
          </div>
          <div>
            <dt>{t('Начислено')}</dt>
            <dd data-testid="partners-accrued">{usd(tot.accruedCents)}</dd>
            <span className="muted">{t('выплачено {p}', { p: usd(tot.paidCents) })}</span>
          </div>
          <div data-tone={tot.dueCents === '0' ? undefined : 'warning'}>
            <dt>{t('К выплате')}</dt>
            <dd data-testid="partners-due">{usd(tot.dueCents)}</dd>
            <span className="muted">{t('партнёров: {n}', { n: formatInt(dueCount) })}</span>
          </div>
        </dl>
        <div className="partners-a__grid">
          <Panel title={t('Партнёры')} data-testid="partners-list" className="cabinet-people partners-a__list">
            {view.partners.length === 0 ? (
              <EmptyState title={t('Партнёров пока нет. Нажмите «Добавить партнёра».')} />
            ) : rows.length === 0 ? (
              <EmptyState title={t('Никого не нашли. Измените поиск или фильтр.')} />
            ) : (
              <Table aria-label={t('Партнёры')}>
                <thead>
                  <tr>
                    <th>{t('Партнёр')}</th>
                    <th className="num">%</th>
                    <th className="num">{t('Клиентов')}</th>
                    <th className="num">{t('Доход')}</th>
                    <th className="num">{t('Начислено')}</th>
                    <th className="num">{t('К выплате')}</th>
                    <th aria-label={t('Действия')} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const mine = clientsOf(p.id);
                    return (
                      <tr key={p.id} className={p.active ? undefined : 'cabinet__voided'} data-testid="partner-row">
                        <td className="partners-a__who">
                          <b>{p.name}</b>
                          {!p.active && <Badge tone="neutral">{t('не работает')}</Badge>}
                          <span className="muted">{[p.phone, p.email].filter(Boolean).join(', ') || t('без контактов')}</span>
                        </td>
                        <td className="num">{bpText(p.percentBp)}</td>
                        <td className="num" title={mine.map((c) => c.name).join(', ')}>
                          {formatInt(p.connected)}
                          <span className="muted"> / {formatInt(p.trials)}</span>
                        </td>
                        <td className="num">{usd(p.incomeCents)}</td>
                        <td className="num">{usd(p.accruedCents)}</td>
                        <td className="num" data-due={p.dueCents === '0' ? undefined : ''}>
                          <b>{usd(p.dueCents)}</b>
                        </td>
                        <td>
                          <div className="cabinet-money__actions partners-a__actions">
                            {p.active && p.dueCents !== '0' && (
                              <FormDialog label={t('Выплатить')} title={t('Выплата: {name}', { name: p.name })} testId="partner-pay-dialog">
                                <PartnerPayoutForm partnerId={p.id} amount={centsToInput(p.dueCents)} today={today} />
                              </FormDialog>
                            )}
                            <FormDialog label={t('Клиенты')} title={t('Клиенты партнёра: {name}', { name: p.name })} tone="secondary" testId="partner-clients-dialog">
                              <PartnerClientsForm
                                partnerId={p.id}
                                mine={mine.map((c) => ({ id: c.organizationId, name: c.name }))}
                                free={(view.allClients ?? []).filter((c) => !view.clients.some((l) => l.organizationId === c.id))}
                              />
                            </FormDialog>
                            {p.active && (
                              <FormDialog label={t('Пригласить')} title={t('Кабинет партнёра: {name}', { name: p.name })} tone="secondary" testId="partner-invite-dialog">
                                <PartnerInviteForm partnerId={p.id} />
                              </FormDialog>
                            )}
                            <FormDialog label={t('Изменить')} title={p.name} tone="secondary" testId="partner-edit-dialog">
                              <PartnerForm
                                partner={{ id: p.id, name: p.name, phone: p.phone, email: p.email, percentInput: bpInput(p.percentBp), active: p.active }}
                              />
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
          <div className="partners-a__side">
            <Panel title={t('Выплаты партнёрам')} data-testid="partners-payouts">
              {payouts.length === 0 ? (
                <EmptyState title={t('Выплат пока нет.')} />
              ) : (
                <ul className="partners-a__payouts">
                  {payouts.map((x) => (
                    <li key={x.id} data-voided={x.voided ? '' : undefined} data-testid="partner-payout-row">
                      <span className="muted">{shortDay(x.spentOn)}</span>
                      <span className="partners-a__payee">
                        {x.partnerName}
                        {x.note && <span className="muted">{x.note}</span>}
                      </span>
                      <b className="num">{usd(x.amountCents)}</b>
                      {x.voided ? <Badge tone="neutral">{t('отменена')}</Badge> : <VoidButton id={x.id} kind="expense" />}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={t('Как считается')}>
              <p className="muted cabinet__note">
                {t('Тариф: разовая выплата с первого чека клиента. Доп: процент партнёра с первого чека. Повторные оплаты партнёру не начисляются.')}
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </CabinetShell>
  );
}
