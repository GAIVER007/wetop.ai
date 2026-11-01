import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../../components/page';
import { LoadError } from '../../../../../components/load-error';
import { Badge, EmptyState, LoadingState, Panel, Table } from '../../../../../components/ui';
import { ApiError, platformApi, type PlatformClientCard, type PlatformGrowth, type PlatformPartners } from '../../../../../lib/api';
import { formatInt } from '../../../../../lib/dashboard-format';
import { ClientPartnerForm } from '../../money-forms';
import { loadErrorProps } from '../../../../../lib/load-error';
import { serverT } from '../../../../../i18n/server';
import { msg, type Translate } from '../../../../../i18n';
import { CabinetShell, dayText } from '../../shell';
import { AccessForm } from '../../access-form';

/**
 * Карточка клиента кабинета руководителя (план 2026-10-29-owner-cabinet-full.md, срез 3; владелец 29.10.2026:
 * «прорабатывай остальные экраны»): сверху статус и доступ (оплата, только чтение, продлить пробный), ниже люди,
 * филиалы и журнал действий. Название, ИИ-продавец, конструктор сайта и архив остаются в «Организации».
 */
export default async function ClientCardPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, serverT()]);
  return (
    <Page width="full" title={t('Клиент')}>
      <Suspense fallback={<LoadingState label={t('Загружаем клиента…')} />}>
        <Card id={id} />
      </Suspense>
    </Page>
  );
}

const ACTION: Record<string, string> = {
  'organization.created': msg('Зарегистрирован'),
  'organization.status_changed': msg('Смена статуса'),
  'organization.trial_extended': msg('Продлён пробный'),
  'organization.renamed': msg('Новое название'),
  'organization.archived': msg('В архив'),
  'organization.restored': msg('Из архива'),
  'organization.locale.changed': msg('Язык организации'),
  'platform.payment.added': msg('Оплата'),
  'platform.subscription.saved': msg('Подписка'),
  'extension.updated': msg('ИИ-продавец'),
};

const VERTICAL: Record<PlatformClientCard['locations'][number]['vertical'], string> = {
  HOSPITALITY: msg('Гостиница'),
  BEAUTY: msg('Салон'),
  FOOD_SERVICE: msg('Ресторан'),
};

function statusBadge(c: PlatformClientCard, t: Translate) {
  if (c.status === 'ACTIVE') return <Badge tone="ok">{t('платит')}</Badge>;
  if (c.status === 'READ_ONLY') return <Badge tone="danger">{t('только чтение')}</Badge>;
  if (c.status === 'SUSPENDED') return <Badge tone="neutral">{t('приостановлен')}</Badge>;
  const ended = !c.trialEndsAt || new Date(c.trialEndsAt).getTime() <= Date.now();
  return (
    <Badge tone="warn">
      {ended ? t('пробный закончился') : t('пробный до {day}', { day: dayText(c.trialEndsAt) })}
    </Badge>
  );
}

function statusWord(s: string | null, t: Translate): string {
  if (s === 'ACTIVE') return t('платит');
  if (s === 'READ_ONLY') return t('только чтение');
  if (s === 'TRIAL') return t('пробный');
  if (s === 'SUSPENDED') return t('приостановлен');
  return '';
}

async function Card({ id }: { id: string }) {
  const t = await serverT();
  let c: PlatformClientCard;
  // партнёры для «чей клиент»; до миграции 172 или при сбое просто без выбора партнёра
  const partners = platformApi.partners().catch(() => ({ ready: false as const }));
  // «Клиенты» C (30.10.2026): дни работы на пробном и за 7 дней из расчёта роста; сбой: блок без этих цифр
  const growth = platformApi.growth(new Date().toISOString().slice(0, 7)).catch(() => null);
  try {
    c = await platformApi.clientCard(id);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return <EmptyState title={t('Кабинет компании видит только главный администратор.')} data-testid="cabinet-forbidden" />;
    if (error instanceof ApiError && (error.status === 404 || error.status === 400))
      return <EmptyState title={t('Такого клиента нет.')} data-testid="client-missing" />;
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  return (
    <CabinetShell active="clients" t={t} className="cabinet-card-page">
      <Panel className="cabinet__client-head" data-testid="client-card">
        <div className="cabinet__client-title">
          <Link className="cabinet__back" href="/platform/cabinet/clients" prefetch={false}>
            {t('Все клиенты')}
          </Link>
          <h2>{c.name}</h2>
          {statusBadge(c, t)}
          <span className="muted">{t('с нами с {day}', { day: dayText(c.createdAt) })}</span>
          <Link className="cabinet__more" href={`/platform?org=${c.id}#organization`} prefetch={false}>
            {t('Название, расширения, архив')}
          </Link>
        </div>
        {(() => {
          const owner = c.members.find((m) => m.owner) ?? c.members[0];
          return owner ? (
            <a
              className="btn btn--primary cabinet__write"
              href={`mailto:${owner.email}?subject=${encodeURIComponent(t('WETOP: как у вас дела?'))}`}
              data-testid="client-write"
            >
              {t('Написать')}
            </a>
          ) : null;
        })()}
        <AccessForm organizationId={c.id} status={c.status} />
        <ClientPartner organizationId={c.id} partners={await partners} t={t} />
      </Panel>
      <TrialWork card={c} client={(await growth)?.clients.find((x) => x.id === c.id) ?? null} t={t} />
      <div className="cabinet__pair">
        <Panel title={t('Люди: {n}', { n: c.members.length })}>
          {c.members.length === 0 ? (
            <EmptyState title={t('Людей пока нет.')} />
          ) : (
            <Table aria-label={t('Люди')} data-testid="client-members">
              <tbody>
                {c.members.map((m) => (
                  <tr key={m.email}>
                    <td>
                      {m.name ?? m.email}
                      {m.name && <span className="muted cabinet__sub">{m.email}</span>}
                    </td>
                    <td>{m.owner ? t('владелец') : t('сотрудник')}</td>
                    <td>{m.lastLoginAt ? t('вход {day}', { day: dayText(m.lastLoginAt) }) : t('не входили')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Panel title={t('Филиалы: {n}', { n: c.locations.length })}>
          {c.locations.length === 0 ? (
            <EmptyState title={t('Филиалов пока нет.')} />
          ) : (
            <Table aria-label={t('Филиалы')} data-testid="client-locations">
              <tbody>
                {c.locations.map((l, i) => (
                  <tr key={`${l.business}-${l.name}-${i}`}>
                    <td>{l.name}</td>
                    <td>{l.business}</td>
                    <td>{t(VERTICAL[l.vertical])}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
      <Panel title={t('Журнал действий')} className="cabinet__journal">
        {c.journal.length === 0 ? (
          <EmptyState title={t('Действий пока нет.')} />
        ) : (
          <Table aria-label={t('Журнал действий')} data-testid="client-journal">
            <thead>
              <tr>
                <th>{t('Когда')}</th>
                <th>{t('Что')}</th>
                <th>{t('Подробно')}</th>
                <th>{t('Кто')}</th>
              </tr>
            </thead>
            <tbody>
              {c.journal.map((j, i) => (
                <tr key={`${j.at}-${i}`}>
                  <td>{dayText(j.at)}</td>
                  <td>{ACTION[j.action] ? t(ACTION[j.action]!) : j.action}</td>
                  <td>{[statusWord(j.status, t), j.note].filter(Boolean).join(', ')}</td>
                  <td>{j.by ?? t('система')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </CabinetShell>
  );
}

/** Чей клиент (DATA_MODEL §63.1): партнёр, который привёл клиента; выбор только действующих партнёров */
function ClientPartner({
  organizationId,
  partners,
  t,
}: {
  organizationId: string;
  partners: PlatformPartners;
  t: Translate;
}) {
  if (!partners.ready) return null;
  const current = partners.clients.find((x) => x.organizationId === organizationId)?.partnerId ?? null;
  const choices = partners.partners.filter((p) => p.active || p.id === current).map((p) => ({ id: p.id, name: p.name }));
  if (choices.length === 0) return <p className="muted cabinet__sub">{t('Партнёров пока нет: их добавляют в «Партнёры WETOP».')}</p>;
  return <ClientPartnerForm organizationId={organizationId} partners={choices} current={current} />;
}

/**
 * «Что сделал на пробном» (владелец 30.10.2026, «Клиенты» C): дни работы в системе за пробный и за последние 7 дней,
 * сколько людей входили, филиалы; «под риском», если работал меньше 3 дней из 7. Только у пробного и недавно платящего.
 */
function TrialWork({
  card,
  client,
  t,
}: {
  card: PlatformClientCard;
  client: PlatformGrowth['clients'][number] | null;
  t: Translate;
}) {
  const logged = card.members.filter((m) => m.lastLoginAt).length;
  const days = (n: number | null | undefined) => (n == null ? t('нет данных') : formatInt(n));
  return (
    <Panel title={t('Что сделал на пробном')} data-testid="client-trial-work">
      <dl className="cabinet__trial-work">
        <div>
          <dt>{t('Дней работы на пробном')}</dt>
          <dd data-testid="client-trial-days">{days(client?.trialActiveDays)}</dd>
        </div>
        <div>
          <dt>{t('Работа за 7 дней')}</dt>
          <dd>
            {client?.activeDays7 == null ? t('нет данных') : t('{n} из 7', { n: formatInt(client.activeDays7) })}
          </dd>
        </div>
        <div>
          <dt>{t('Входили люди')}</dt>
          <dd>{t('{n} из {all}', { n: formatInt(logged), all: formatInt(card.members.length) })}</dd>
        </div>
        <div>
          <dt>{t('Филиалы')}</dt>
          <dd>{formatInt(card.locations.length)}</dd>
        </div>
        {client?.atRisk && (
          <div>
            <dt>{t('Внимание')}</dt>
            <dd>
              <Badge tone="danger" data-testid="client-card-risk">
                {t('под риском')}
              </Badge>
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}
