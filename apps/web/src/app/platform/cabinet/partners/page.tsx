import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { Badge, EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { platformApi, type PlatformPartners } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import { CabinetShell, centsToInput, usd } from '../shell';
import { FormDialog } from '../form-dialog';
import { PartnerForm, PartnerInviteForm, PartnerPayoutForm } from '../money-forms';
import { percentText } from '../growth-parts';

/**
 * Партнёры WETOP (владелец 30.10.2026, DATA_MODEL §63.1): кто приводит клиентов и под какой процент. По каждому:
 * на пробном (заведено его клиентов), подключено (с оплатой), доход от его клиентов, начислено, выплачено, к выплате.
 * «Выплатить» пишет расход «Партнёрам», он сразу в «Деньгах». Клиента партнёру назначают в карточке клиента.
 */
export default async function PartnersPage() {
  const t = await serverT();
  return (
    <Page width="full" title={t('Партнёры WETOP')}>
      <Suspense fallback={<LoadingState label={t('Загружаем партнёров…')} />}>
        <Partners />
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

async function Partners() {
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
  const clientsOf = (id: string) => view.clients.filter((c) => c.partnerId === id);
  return (
    <CabinetShell active="partners" t={t}>
      <div className="cabinet__head cabinet-money__head">
        <span />
        <div className="cabinet-money__actions">
          <FormDialog label={t('Добавить партнёра')} title={t('Новый партнёр')} testId="partner-add-dialog">
            <PartnerForm partner={null} />
          </FormDialog>
        </div>
      </div>
      <Stats min={180}>
        <Stat label={t('Партнёров')} value={formatInt(tot.partners)} icon={<Icon name="link" />} testId="partners-count" />
        <Stat
          label={t('Клиентов от партнёров')}
          value={formatInt(tot.connected)}
          hint={t('подключено; заведено на пробный {n}', { n: formatInt(tot.trials) })}
          icon={<Icon name="guests" />}
          testId="partners-clients"
        />
        <Stat
          label={t('Доход от их клиентов')}
          value={usd(tot.incomeCents)}
          icon={<Icon name="chart" />}
          tone="success"
          testId="partners-income"
        />
        <Stat
          label={t('К выплате партнёрам')}
          value={usd(tot.dueCents)}
          hint={t('начислено {a}, выплачено {p}', { a: usd(tot.accruedCents), p: usd(tot.paidCents) })}
          icon={<Icon name="money" />}
          tone={tot.dueCents === '0' ? undefined : 'warning'}
          testId="partners-due"
        />
      </Stats>
      <Panel title={t('Партнёры')} data-testid="partners-list" className="cabinet-people">
        {view.partners.length === 0 ? (
          <EmptyState title={t('Партнёров пока нет. Нажмите «Добавить партнёра».')} />
        ) : (
          <Table aria-label={t('Партнёры')} >
            <thead>
              <tr>
                <th>{t('Партнёр')}</th>
                <th className="num">{t('Процент')}</th>
                <th className="num">{t('На пробном')}</th>
                <th className="num">{t('Подключено')}</th>
                <th className="num">{t('Доход')}</th>
                <th className="num">{t('Начислено')}</th>
                <th className="num">{t('Выплачено')}</th>
                <th className="num">{t('К выплате')}</th>
                <th aria-label={t('Действия')} />
              </tr>
            </thead>
            <tbody>
              {view.partners.map((p) => (
                <tr key={p.id} className={p.active ? undefined : 'cabinet__voided'} data-testid="partner-row">
                  <td>
                    <b>{p.name}</b>
                    <div className="cabinet__sub muted">{[p.phone, p.email].filter(Boolean).join(', ')}</div>
                    {clientsOf(p.id).length > 0 && (
                      <div className="cabinet__sub muted">{clientsOf(p.id).map((c) => c.name).join(', ')}</div>
                    )}
                    {!p.active && <Badge tone="neutral">{t('не работает')}</Badge>}
                  </td>
                  <td className="num">{bpText(p.percentBp)}</td>
                  <td className="num">{formatInt(p.trials)}</td>
                  <td className="num">{formatInt(p.connected)}</td>
                  <td className="num">{usd(p.incomeCents)}</td>
                  <td className="num">{usd(p.accruedCents)}</td>
                  <td className="num">{usd(p.paidCents)}</td>
                  <td className="num">
                    <b>{usd(p.dueCents)}</b>
                  </td>
                  <td>
                    <div className="cabinet-money__actions">
                      {p.active && p.dueCents !== '0' && (
                        <FormDialog label={t('Выплатить')} title={t('Выплата: {name}', { name: p.name })} testId="partner-pay-dialog">
                          <PartnerPayoutForm partnerId={p.id} amount={centsToInput(p.dueCents)} today={today} />
                        </FormDialog>
                      )}
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
              ))}
            </tbody>
          </Table>
        )}
        <p className="muted cabinet__sub">
          {t('Клиент по ссылке партнёра становится его сам; вручную клиента назначают в карточке клиента. Начислено: за тариф разово с первой оплаты, с допов процент с первой оплаты допа.')}
        </p>
      </Panel>
    </CabinetShell>
  );
}
