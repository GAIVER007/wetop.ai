import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { Suspense } from 'react';
import { can, parseMembershipRole } from '@pms/domain';
import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import { financeApi, paymentMethodsApi, serviceCatalogApi } from '../../../lib/api';
import { hotelApi, type HotelSettings } from '../../../lib/hotel-api';
import { propertyMediaApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { Icon } from '../../../components/icon';
import { LoadError } from '../../../components/load-error';
import { Tabs } from '../../../components/tabs';
import { loadErrorProps } from '../../../lib/load-error';
import { Notice, Panel } from '../../../components/ui';
import { AddServiceButton, ServiceEditor, ServicesCatalog } from '../catalogs';
import { CashCategoriesEditor, PaymentMethodsForm } from '../directories';
import { GeneralSettingsForm, StaySettingsForm } from '../settings-form';
import { PreviewButton } from '../object-preview';
import { ContractBlock, PhotosBlock } from '../media-blocks';
import { SalesSummary, DocumentsSummary } from '../object-summaries';
import { withCardDefaults, formText } from '../card-model';
import { SaveAction, SettingsSave } from '../settings-save';
import { currentMe, deskShell } from '../../../lib/desk-shell';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';
import '../settings.css';

/**
 * «Настройки объекта» (ТЗ «Настройки объекта» v2, срез SET1, ADR-115): один заголовок на шесть вкладок (три прежние,
 * «Продажи и каналы» и «Документы» по верстке владельца, ADR-158, «Справочники» ADR-185). Правила отмены
 * ушли к тарифам — это свойство тарифного плана (SET4); старый адрес ведёт на «Цены и ограничения».
 */
const tabs = [
  { view: '', href: '/hotel-settings', label: msg('Основное') },
  { view: 'stay', href: '/hotel-settings/stay', label: msg('Проживание') },
  { view: 'services', href: '/hotel-settings/services', label: msg('Услуги') },
  { view: 'sales', href: '/hotel-settings/sales', label: msg('Продажи и каналы') },
  { view: 'documents', href: '/hotel-settings/documents', label: msg('Документы') },
  { view: 'directories', href: '/hotel-settings/directories', label: msg('Справочники') },
] as const;
const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

export default async function HotelSettingsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  await requireFeature('/hotel-settings');
  const t = await serverT();
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const view = section[0] ?? '';
  if (view === 'description') redirect('/hotel-settings');
  if (view === 'check-in') redirect('/hotel-settings/stay');
  if (view === 'penalties') redirect('/hotel-settings');
  if (view === 'photos' || view === 'amenities') redirect('/connections#channex-connection');
  if (!tabs.some((item) => item.view === view)) notFound();
  // настройки уже прочитал макет (кэш на одну отрисовку): название объекта в подзаголовке ничего не стоит
  const [loaded, me, { readOnly }, mediaRead] = await Promise.all([
    settle(hotelApi.settings()),
    settle(currentMe()),
    deskShell(),
    // фото и договор объекта (ADR-158): отказ чтения не роняет экран, блоки просто не показываются
    view === '' || view === 'stay' ? settle(propertyMediaApi.list()) : Promise.resolve(null),
  ]);
  const media = mediaRead?.ok ? mediaRead.value : null;
  const previewPhotos = (media?.photos ?? []).flatMap((p) =>
    p.url ? [{ id: p.id, url: p.url, alt: p.alt ?? t('Фото объекта') }] : [],
  );
  // Правят владелец и управляющий — право `settings` (ТЗ ux-retention п. 3.1, ADR-107); администратору раздел закрыт
  // целиком (`AccessGate`). Никто не вошёл или вход не ответил — только просмотр: API без человека сведений не меняет.
  const role = me.ok && me.value.user?.role ? parseMembershipRole(me.value.user.role) : null;
  const owner = role !== null && can(role, 'settings');
  // Правят только вне «только чтения» (ADR-102): иначе поля стоят выключенными, а кнопки сохранения нет вовсе
  // (DESIGN.md §8 — действия, которого нельзя, не рисуем)
  const mayEdit = owner && !readOnly;
  const editable = mayEdit && loaded.ok && view !== 'services';
  const formTab = view === '' || view === 'stay';
  // «Услуги» (SET3): новая услуга — из шапки, как «Сохранить изменения» на других вкладках
  const actions =
    view === 'services' ? (
      mayEdit ? (
        <AddServiceButton />
      ) : undefined
    ) : formTab && loaded.ok ? (
      <>
        <PreviewButton initial={previewValues(loaded.value.property)} photos={previewPhotos} />
        {editable && <SaveAction />}
      </>
    ) : view === 'directories' && editable ? (
      // «Справочники» (ADR-185): способы оплаты сохраняются той же кнопкой шапки, предпросмотра у них нет
      <SaveAction />
    ) : undefined;
  const organization = me.ok ? (me.value.user?.organization?.name ?? null) : null;
  const platformAdmin = me.ok && me.value.user?.platformAdmin === true;
  const propertyName = loaded.ok ? loaded.value.property.name : null;
  const crumbs = (
    <nav aria-label={t('Путь')} className="obj-crumbs">
      <Icon name="hotel" width={16} height={16} />
      {platformAdmin ? <Link href="/platform">{t('Организации')}</Link> : <span>{t('Организации')}</span>}
      {organization && (
        <>
          <Icon name="chevron" width={14} height={14} />
          <span>{organization}</span>
        </>
      )}
      {propertyName && propertyName !== organization && (
        <>
          <Icon name="chevron" width={14} height={14} />
          <span>{propertyName}</span>
        </>
      )}
      <Icon name="chevron" width={14} height={14} />
      <span aria-current="page">{t('Настройки объекта')}</span>
    </nav>
  );
  const capacity = loaded.ok ? (loaded.value.capacity ?? null) : null;
  return (
    <SettingsSave>
      <ServiceEditor currency={loaded.ok ? loaded.value.property.currency : 'KZT'}>
        <Page
          title={t('Настройки объекта')}
          className="object-settings"
          crumbs={crumbs}
          subtitle={t('Здесь вы настраиваете данные филиала, правила проживания, описание и услуги. Информация используется на всех каналах продаж и в коммуникациях с гостями.')}
          actions={actions}
        >
          <Tabs
            label={t('Настройки объекта')}
            items={tabs.map((item) => ({ ...item, label: t(item.label), current: item.view === view }))}
          />
          {view === 'services' ? (
            <Suspense
              fallback={
                <Panel data-testid="settings-loading" role="status">
                  {t('Читаем настройки объекта…')}
                </Panel>
              }
            >
              <Services editable={mayEdit} />
            </Suspense>
          ) : view === 'directories' ? (
            <Suspense
              fallback={
                <Panel data-testid="settings-loading" role="status">
                  {t('Читаем справочники объекта…')}
                </Panel>
              }
            >
              <Directories editable={mayEdit} />
            </Suspense>
          ) : !loaded.ok ? (
            <LoadError testId="settings-error" {...loadErrorProps(loaded.error)} />
          ) : view === 'stay' ? (
            <div data-testid="stay-tab">
              <StaySettingsForm
                property={loaded.value.property}
                editable={editable}
                capacity={capacity}
              />
              {!owner && <Notice tone="muted">{t(OWNER_ONLY)}</Notice>}
            </div>
          ) : view === 'sales' ? (
            <SalesSummary property={withCardDefaults(loaded.value.property)} />
          ) : view === 'documents' ? (
            <DocumentsSummary property={withCardDefaults(loaded.value.property)} owner={owner} />
          ) : (
            <div className="settings-stack" data-testid="stored-property">
              <GeneralSettingsForm
                property={loaded.value.property}
                editable={editable}
                owner={owner}
                capacity={capacity}
                photos={previewPhotos}
                photoSlot={<PhotosBlock media={media} editable={mayEdit} />}
                contractSlot={<ContractBlock media={media} editable={mayEdit} />}
              />
              {!owner && <Notice tone="muted">{t(OWNER_ONLY)}</Notice>}
            </div>
          )}
        </Page>
      </ServiceEditor>
    </SettingsSave>
  );
}

type Property = HotelSettings['property'];
const OWNER_ONLY = msg('Сведения меняют владелец и управляющий.');

/** Значения для предпросмотра, пока форма не открыта: из записи объекта */
function previewValues(p: Property): Record<string, string> {
  const full = withCardDefaults(p);
  return Object.fromEntries(
    (Object.keys(full) as Array<keyof typeof full>).map((k) => [k, formText(full[k])]),
  );
}

async function Services({ editable }: { editable: boolean }) {
  const t = await serverT();
  // весь каталог, с архивными (SET3); выбор услуги в счёте берёт только активные — `/finance/services`
  const loaded = await settle(Promise.all([serviceCatalogApi.list(), hotelApi.settings()]));
  if (!loaded.ok) return <LoadError testId="services-error" {...loadErrorProps(loaded.error)} />;
  const [services, settings] = loaded.value;
  return (
    <>
      <p className="settings-note settings-lead">
        {t('Дополнительные товары и услуги, которые можно добавить в счёт гостя.')}
      </p>
      <ServicesCatalog
        services={services}
        currency={settings.property.currency}
        editable={editable}
      />
      <Panel className="settings-service-help" data-testid="service-hint">
        <Icon name="receipt" />
        <div>
          <h2>{t('Начислить услугу гостю')}</h2>
          <p>{t('Откройте бронь, вкладку «Счета», и выберите услугу.')}</p>
        </div>
        <Link className="btn btn--secondary" href="/guests?state=inhouse">
          {t('Найти проживающего гостя')}
        </Link>
      </Panel>
    </>
  );
}

/** «Справочники» (ADR-185): способы оплаты объекта и статьи кассы; по одному запросу на каждый */
async function Directories({ editable }: { editable: boolean }) {
  const t = await serverT();
  const loaded = await settle(Promise.all([paymentMethodsApi.get(), financeApi.cashCategories()]));
  if (!loaded.ok)
    return <LoadError testId="directories-error" {...loadErrorProps(loaded.error)} />;
  const [methods, categories] = loaded.value;
  return (
    <div className="settings-stack">
      <Panel
        className="settings-block"
        aria-labelledby="settings-payment-methods"
        data-testid="payment-methods"
      >
        <h2 id="settings-payment-methods">{t('Способы оплаты')}</h2>
        <p className="settings-note">
          {t('Какие способы стойка предлагает при приёме денег и в каком порядке.')}
        </p>
        <PaymentMethodsForm stored={methods.methods} editable={editable} />
      </Panel>
      <Panel
        className="settings-block"
        id="cash-categories"
        aria-labelledby="settings-cash-categories"
        data-testid="cash-categories"
      >
        <h2 id="settings-cash-categories">{t('Статьи кассы')}</h2>
        <p className="settings-note">
          {t('Статьи поступлений и расходов кассы. Удаления нет: статья выключается, прошлые операции хранят её.')}
        </p>
        <CashCategoriesEditor categories={categories} editable={editable} />
      </Panel>
      {!editable && <Notice tone="muted">{t(OWNER_ONLY)}</Notice>}
    </div>
  );
}
