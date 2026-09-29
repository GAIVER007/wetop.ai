import Link from 'next/link';
import { Suspense } from 'react';
import { can, parseMembershipRole } from '@pms/domain';
import { notFound, redirect } from 'next/navigation';
import { serviceCatalogApi } from '../../../lib/api';
import { hotelApi, type HotelSettings } from '../../../lib/hotel-api';
import { Page } from '../../../components/page';
import { Icon } from '../../../components/icon';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { Notice, Panel } from '../../../components/ui';
import { AddServiceButton, ServiceEditor, ServicesCatalog } from '../catalogs';
import {
  GeneralSettingsForm,
  RegionalSettings,
  StayNote,
  StaySettingsForm,
} from '../settings-form';
import { SaveAction, SettingsSave } from '../settings-save';
import { currentMe, deskShell } from '../../../lib/desk-shell';

/**
 * «Настройки объекта» (ТЗ «Настройки объекта» v2, срез SET1, ADR-115): один заголовок на три вкладки. Правила отмены
 * ушли к тарифам — это свойство тарифного плана (SET4); старый адрес ведёт на «Цены и ограничения».
 */
const tabs = [
  { view: '', href: '/hotel-settings', label: 'Основное' },
  { view: 'stay', href: '/hotel-settings/stay', label: 'Проживание' },
  { view: 'services', href: '/hotel-settings/services', label: 'Услуги' },
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
  if (view === 'check-in') redirect('/hotel-settings/stay');
  if (view === 'penalties') redirect('/rates/plans');
  if (view === 'photos' || view === 'amenities') redirect('/connections#channex-connection');
  if (!tabs.some((item) => item.view === view)) notFound();
  // настройки уже прочитал макет (кэш на одну отрисовку): название объекта в подзаголовке ничего не стоит
  const [loaded, me, { readOnly }] = await Promise.all([
    settle(hotelApi.settings()),
    settle(currentMe()),
    deskShell(),
  ]);
  // Правят владелец и управляющий — право `settings` (ТЗ ux-retention п. 3.1, ADR-107); администратору раздел закрыт
  // целиком (`AccessGate`). Никто не вошёл или вход не ответил — только просмотр: API без человека сведений не меняет.
  const role = me.ok && me.value.user?.role ? parseMembershipRole(me.value.user.role) : null;
  const owner = role !== null && can(role, 'settings');
  // Правят только вне «только чтения» (ADR-102): иначе сведения
  // фактами, а кнопки сохранения нет вовсе (DESIGN.md §8 — действия, которого нельзя, не рисуем)
  const mayEdit = owner && !readOnly;
  const editable = mayEdit && loaded.ok && view !== 'services';
  // «Услуги» (SET3): новая услуга — из шапки, как «Сохранить изменения» на других вкладках
  const actions =
    view === 'services' ? (
      mayEdit ? (
        <AddServiceButton />
      ) : undefined
    ) : editable ? (
      <SaveAction />
    ) : undefined;
  return (
    <SettingsSave>
      <ServiceEditor currency={loaded.ok ? loaded.value.property.currency : 'KZT'}>
        <Page
          title="Настройки объекта"
          subtitle={loaded.ok ? loaded.value.property.name : undefined}
          actions={actions}
        >
          <nav className="settings-tabs" aria-label="Настройки объекта">
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
          {view === 'services' ? (
            <Suspense
              fallback={
                <Panel data-testid="settings-loading" role="status">
                  Читаем настройки объекта…
                </Panel>
              }
            >
              <Services editable={mayEdit} />
            </Suspense>
          ) : !loaded.ok ? (
            <LoadError testId="settings-error" {...loadErrorProps(loaded.error)} />
          ) : view === 'stay' ? (
            <StaySettings property={loaded.value.property} editable={editable} owner={owner} />
          ) : (
            <GeneralSettings property={loaded.value.property} editable={editable} owner={owner} />
          )}
        </Page>
      </ServiceEditor>
    </SettingsSave>
  );
}

type Property = HotelSettings['property'];
const OWNER_ONLY = 'Сведения меняют владелец и управляющий.';

function Facts({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="settings-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function GeneralSettings({
  property: p,
  editable,
  owner,
}: {
  property: Property;
  editable: boolean;
  owner: boolean;
}) {
  if (editable)
    return (
      <div className="settings-stack" data-testid="stored-property">
        <GeneralSettingsForm property={p} />
      </div>
    );
  return (
    <div className="settings-stack" data-testid="stored-property">
      <Panel className="settings-block" aria-labelledby="settings-main">
        <h2 id="settings-main">Основная информация</h2>
        <Facts
          rows={[
            ['Название объекта', p.name],
            ['Телефон', p.phone],
            ['Почта', p.email],
            ['Адрес', p.address],
          ]}
        />
      </Panel>
      <RegionalSettings property={p} />
      <Panel className="settings-block" aria-labelledby="settings-legal">
        <h2 id="settings-legal">Юридическое лицо</h2>
        {/* ИИН/БИН у ИП — ИИН человека: сотруднику экран его не показывает (как и до SET1) */}
        <Facts
          rows={[
            ['Юридическое название', p.legalName],
            ...(owner ? [['ИИН/БИН', p.bin] as [string, string | null | undefined]] : []),
          ]}
        />
      </Panel>
      {!owner && <Notice tone="muted">{OWNER_ONLY}</Notice>}
    </div>
  );
}

function StaySettings({
  property: p,
  editable,
  owner,
}: {
  property: Property;
  editable: boolean;
  owner: boolean;
}) {
  if (editable)
    return (
      <div className="settings-stack">
        <StaySettingsForm property={p} />
      </div>
    );
  return (
    <div className="settings-stack">
      <Panel className="settings-block" aria-labelledby="settings-stay" data-testid="stay-settings">
        <h2 id="settings-stay">Заезд и выезд</h2>
        <Facts
          rows={[
            ['Заезд с', p.checkInTime],
            ['Выезд до', p.checkOutTime],
          ]}
        />
        <StayNote timezone={p.timezone} />
      </Panel>
      {!owner && <Notice tone="muted">{OWNER_ONLY}</Notice>}
    </div>
  );
}

async function Services({ editable }: { editable: boolean }) {
  // весь каталог, с архивными (SET3); выбор услуги в счёте берёт только активные — `/finance/services`
  const loaded = await settle(Promise.all([serviceCatalogApi.list(), hotelApi.settings()]));
  if (!loaded.ok) return <LoadError testId="services-error" {...loadErrorProps(loaded.error)} />;
  const [services, settings] = loaded.value;
  return (
    <>
      <p className="settings-note settings-lead">
        Дополнительные товары и услуги, которые можно добавить в счёт гостя.
      </p>
      <ServicesCatalog
        services={services}
        currency={settings.property.currency}
        editable={editable}
      />
      <Panel className="settings-service-help" data-testid="service-hint">
        <Icon name="receipt" />
        <div>
          <h2>Начислить услугу гостю</h2>
          <p>Откройте бронь, вкладку «Счета», и выберите услугу.</p>
        </div>
        <Link className="btn btn--secondary" href="/guests?state=inhouse">
          Найти проживающего гостя
        </Link>
      </Panel>
    </>
  );
}
