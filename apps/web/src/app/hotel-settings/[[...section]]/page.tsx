import Link from 'next/link';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { financeApi } from '../../../lib/api';
import { hotelApi } from '../../../lib/hotel-api';
import { Page } from '../../../components/page';
import { Icon } from '../../../components/icon';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { RefreshButton } from '../../../components/refresh-button';
import { Badge, Fact, Grid, Panel } from '../../../components/ui';
import { ServicesCatalog, CancellationPolicies } from '../catalogs';
import { HotelSettingsForm } from '../settings-form';
import { currentMe } from '../../../lib/desk-shell';

const tabs = [
  { view: '', href: '/hotel-settings', label: 'Общие' },
  { view: 'services', href: '/hotel-settings/services', label: 'Услуги' },
  { view: 'penalties', href: '/hotel-settings/penalties', label: 'Правила отмены' },
] as const;
const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

export default async function HotelSettingsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const view = section[0] ?? '';
  if (view === 'description') redirect('/hotel-settings');
  if (view === 'check-in') redirect('/hotel-settings#stay-settings');
  if (view === 'photos' || view === 'amenities') redirect('/connections#channex-connection');
  const tab = tabs.find((item) => item.view === view);
  if (!tab) notFound();
  return (
    <Page
      title={view ? tab.label : 'Настройки гостиницы'}
      subtitle={
        view === 'services'
          ? 'Каталог услуг для счёта гостя.'
          : view === 'penalties'
            ? 'Политика отмены каждого тарифного плана.'
            : 'Сведения об объекте и работа стойки.'
      }
      actions={<RefreshButton />}
      crumbs={view ? <Link href="/hotel-settings">Настройки гостиницы</Link> : undefined}
    >
      <nav className="settings-tabs" aria-label="Настройки гостиницы">
        {tabs.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={item.view === view ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Suspense
        key={view}
        fallback={
          <Panel data-testid="settings-loading" role="status">
            Читаем настройки объекта…
          </Panel>
        }
      >
        {view === 'services' ? <Services /> : <StoredSettings view={view} />}
      </Suspense>
    </Page>
  );
}

/** Правит «Общие» владелец организации (ТЗ ux-retention п. 3.1); не ответил вход — только просмотр */
async function isOwner(): Promise<boolean> {
  const me = await settle(currentMe());
  return me.ok && me.value.user?.role === 'OWNER';
}

async function StoredSettings({ view }: { view: string }) {
  const loaded = await settle(hotelApi.settings());
  if (!loaded.ok) return <LoadError testId="settings-error" {...loadErrorProps(loaded.error)} />;
  const { property: p, ratePlans } = loaded.value;
  if (view === 'penalties')
    return (
      <>
        <CancellationPolicies plans={ratePlans} />
        <p className="settings-note">
          Сохранённые правила тарифов. Начисленный штраф — в счёте конкретной брони.
        </p>
        <Link href="/rates" className="btn btn--secondary">
          Открыть тарифы
        </Link>
      </>
    );
  const owner = await isOwner();
  return (
    <div className="settings-overview">
      <Panel className="settings-property" data-testid="stored-property">
        <div className="settings-section-heading">
          <span className="settings-mark">
            <Icon name="inventory" />
          </span>
          <div>
            <h2>{p.name}</h2>
            <p>Сведения гостиницы в PMS</p>
          </div>
          {!owner && <Badge>Только просмотр</Badge>}
        </div>
        {owner ? (
          <HotelSettingsForm property={p} />
        ) : (
          <>
            <dl className="settings-facts">
              <div>
                <dt>Название</dt>
                <dd>{p.name}</dd>
              </div>
              <div>
                <dt>Юридическое название</dt>
                <dd>{p.legalName || '—'}</dd>
              </div>
              <div>
                <dt>Адрес в PMS</dt>
                <dd>{p.address || '—'}</dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>{p.phone || '—'}</dd>
              </div>
              <div>
                <dt>Почта</dt>
                <dd>{p.email || '—'}</dd>
              </div>
              <div>
                <dt>Валюта</dt>
                <dd>{p.currency}</dd>
              </div>
              <div>
                <dt>Часовой пояс</dt>
                <dd>{p.timezone}</dd>
              </div>
            </dl>
            <p className="settings-note">
              Используются на стойке, в счетах и отчётах. Сведения меняет владелец организации.
            </p>
          </>
        )}
      </Panel>
      <Panel id="stay-settings" data-testid="stay-settings" className="settings-stay">
        <div className="settings-section-heading">
          <span className="settings-mark">
            <Icon name="clock" />
          </span>
          <div>
            <h2>Заезд и выезд</h2>
            <p>По времени гостиницы</p>
          </div>
        </div>
        <Grid min={120} className="settings-times">
          <Fact label="Заезд с" value={p.checkInTime} />
          <Fact label="Выезд до" value={p.checkOutTime} />
        </Grid>
        <p className="settings-note">
          {owner
            ? 'Меняются в сведениях гостиницы выше.'
            : 'Расчётные часы меняет владелец организации.'}
        </p>
        <Link href="/today" className="btn btn--secondary">
          Заезды и выезды сегодня
        </Link>
      </Panel>
    </div>
  );
}

async function Services() {
  const loaded = await settle(Promise.all([financeApi.services(), hotelApi.settings()]));
  if (!loaded.ok) return <LoadError testId="services-error" {...loadErrorProps(loaded.error)} />;
  const [services, settings] = loaded.value;
  return (
    <>
      <ServicesCatalog services={services} currency={settings.property.currency} />
      <Panel className="settings-service-help" data-testid="service-hint">
        <Icon name="receipt" />
        <div>
          <h2>Начислить услугу гостю</h2>
          <p>Откройте бронь, вкладку «Счета», и выберите услугу.</p>
        </div>
        <Link className="btn btn--secondary" href="/guests">
          Найти проживающего гостя
        </Link>
      </Panel>
      <p className="settings-note">
        Каталог доступен только для просмотра. Добавление услуг и изменение цен пока недоступны.
      </p>
    </>
  );
}
