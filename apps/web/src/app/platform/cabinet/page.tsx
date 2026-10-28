import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { RefreshButton } from '../../../components/refresh-button';
import { Badge, EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { ApiError, platformApi, type PlatformCabinet } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatInt } from '../../../lib/dashboard-format';
import { PLATFORM_VERTICAL_LABEL } from '../../../lib/platform';
import { serverT } from '../../../i18n/server';
import type { Translate } from '../../../i18n';
import { unstable_rethrow } from 'next/navigation';
import './cabinet.css';

/**
 * Кабинет компании WETOP (владелец 28.10.2026, вариант «Г»): меню слева, путь клиента, клиенты и сроки. WETOP
 * компания, организации на платформе её клиенты. Срез 1 без денег: подписки, оплаты, расходы и команда
 * компании придут срезом 2 со своими таблицами. Только главному администратору.
 */
export default async function CabinetPage() {
  const t = await serverT();
  return (
    <Page width="full" title={t('Кабинет WETOP')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем клиентов…')} />}>
        <Cabinet />
      </Suspense>
    </Page>
  );
}

async function Cabinet() {
  const t = await serverT();
  let view: PlatformCabinet;
  try {
    view = await platformApi.cabinet();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title={t('Раздел главного администратора платформы')}
          data-testid="cabinet-forbidden"
        >
          {t('Кабинет компании видит только главный администратор.')}
        </EmptyState>
      );
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  const now = Date.now();
  return (
    <div className="cabinet" data-testid="cabinet">
      <div className="cabinet__side">
        <nav className="cabinet__menu" aria-label={t('Кабинет WETOP')}>
          <Link
            className="cabinet__link"
            aria-current="page"
            href="/platform/cabinet"
            prefetch={false}
          >
            <Icon name="today" />
            {t('Главная')}
          </Link>
          <Link className="cabinet__link" href="/platform" prefetch={false}>
            <Icon name="guests" />
            {t('Клиенты')}
            <span className="cabinet__count">{formatInt(view.totals.clients)}</span>
          </Link>
          <Link className="cabinet__link" href="/platform/support" prefetch={false}>
            <Icon name="chat" />
            {t('Поддержка')}
          </Link>
        </nav>
        <Panel title={t('Сроки')} className="cabinet__deadlines" data-testid="cabinet-deadlines">
          {view.deadlines.length === 0 ? (
            <EmptyState title={t('Сроков нет: все клиенты платят.')} />
          ) : (
            <ul className="cabinet__list">
              {view.deadlines.map((d) => (
                <li key={d.id}>
                  <Link
                    className="cabinet__deadline"
                    href={`/platform?org=${d.id}#organization`}
                    prefetch={false}
                  >
                    <span className="cabinet__deadline-name">{d.name}</span>
                    <Badge tone={d.kind === 'unpaid' || d.daysLeft === 0 ? 'danger' : 'warn'}>
                      {d.kind === 'unpaid'
                        ? t('ждёт оплаты')
                        : d.daysLeft === 0
                          ? t('пробный закончился')
                          : t('пробный, {n} дн.', { n: formatInt(d.daysLeft ?? 0) })}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="cabinet__main">
        <Stats min={200}>
          <Stat
            label={t('Клиенты')}
            value={formatInt(view.totals.clients)}
            hint={t('платят {paying}, пробный {trial}', {
              paying: formatInt(view.funnel.paying),
              trial: formatInt(view.funnel.trial),
            })}
            icon={<Icon name="guests" />}
            testId="cabinet-clients"
          />
          <Stat
            label={t('Люди у клиентов')}
            value={formatInt(view.totals.people)}
            hint={t('входили за 7 дней: {n}', { n: formatInt(view.totals.activePeople7d) })}
            icon={<Icon name="person" />}
            testId="cabinet-people"
          />
          <Stat
            label={t('Брони и записи за 30 дней')}
            value={formatInt(view.clients.reduce((n, c) => n + c.records30d, 0))}
            hint={t('всё, что клиенты внесли в WETOP')}
            icon={<Icon name="booking" />}
            testId="cabinet-records"
          />
        </Stats>

        <Panel title={t('Путь клиента')}>
          <ol className="cabinet__funnel" data-testid="cabinet-funnel">
            <Step label={t('Регистраций за 30 дней')} value={view.funnel.registered30d} />
            <Step label={t('Работают')} hint={t('входили за 7 дней')} value={view.funnel.working} />
            <Step label={t('Пробный период')} value={view.funnel.trial} />
            <Step label={t('Платят')} value={view.funnel.paying} tone="ok" />
            <Step
              label={t('Ушли')}
              hint={t('архив или без оплаты')}
              value={view.funnel.left}
              tone="danger"
            />
          </ol>
        </Panel>

        <Panel title={t('Клиенты')} className="cabinet__clients">
          {view.clients.length === 0 ? (
            <EmptyState title={t('Клиентов пока нет. Они появятся после регистрации на сайте.')} />
          ) : (
            <Table aria-label={t('Клиенты')} data-testid="cabinet-clients-table">
              <thead>
                <tr>
                  <th>{t('Клиент')}</th>
                  <th>{t('Вид')}</th>
                  <th>{t('Филиалы')}</th>
                  <th>{t('Люди')}</th>
                  <th>{t('За 30 дней')}</th>
                  <th>{t('Входили')}</th>
                  <th>{t('Состояние')}</th>
                </tr>
              </thead>
              <tbody>
                {view.clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/platform?org=${c.id}#organization`} prefetch={false}>
                        {c.name}
                      </Link>
                      {c.owner && <div className="muted cabinet__sub">{c.owner}</div>}
                    </td>
                    <td>
                      {c.verticals.map((v) => t(PLATFORM_VERTICAL_LABEL[v])).join(', ') || t('нет')}
                    </td>
                    <td>{formatInt(c.locations)}</td>
                    <td>{formatInt(c.members)}</td>
                    <td>{formatInt(c.records30d)}</td>
                    <td>{loginText(c.lastLoginAt, now, t)}</td>
                    <td>
                      <StatusBadge client={c} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Step({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint?: string;
  value: number;
  tone?: 'ok' | 'danger';
}) {
  return (
    <li className="cabinet__step" data-tone={tone}>
      <b className="cabinet__step-value">{formatInt(value)}</b>
      <span>{label}</span>
      {hint && <span className="muted cabinet__sub">{hint}</span>}
    </li>
  );
}

function StatusBadge({ client, t }: { client: PlatformCabinet['clients'][number]; t: Translate }) {
  if (client.status === 'ACTIVE') return <Badge tone="ok">{t('платит')}</Badge>;
  if (client.status === 'READ_ONLY') return <Badge tone="danger">{t('ждёт оплаты')}</Badge>;
  return (
    <Badge tone="warn">
      {client.trialDaysLeft === 0
        ? t('пробный закончился')
        : t('пробный, {n} дн.', { n: formatInt(client.trialDaysLeft ?? 0) })}
    </Badge>
  );
}

function loginText(iso: string | null, now: number, t: Translate): string {
  if (!iso) return t('не входили');
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t('сегодня');
  if (days === 1) return t('вчера');
  return t('{n} дн. назад', { n: formatInt(days) });
}
