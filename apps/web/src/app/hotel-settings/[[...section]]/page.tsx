import Link from 'next/link';
import { notFound } from 'next/navigation';
import { financeApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { hotelApi, type HotelContent } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { SectionCards } from '../../../components/section-cards';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import {
  Alert,
  Badge,
  EmptyState,
  Fact,
  Grid,
  Notice,
  Panel,
  Stat,
  Stats,
  Table,
} from '../../../components/ui';

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );
/** Пустое значение — «—», а не фраза вместо значения (§14) */
const orDash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '—' : v;

export default async function HotelSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ refresh?: string }>;
}) {
  const { section = [] } = await params;
  const refresh = (await searchParams).refresh === '1';
  const view = section[0];
  const path = `/hotel-settings${section.length ? `/${section.join('/')}` : ''}`;
  const item = navigationItems.find((item) => item.href === path);
  if (!item) notFound();
  return (
    <Page
      title={item.label}
      crumbs={section.length ? <Link href="/hotel-settings">Настройка гостиницы</Link> : undefined}
    >
      {!section.length && <SectionCards items={item.children ?? []} />}
      {['check-in', 'description', 'penalties'].includes(section[0] ?? '') && (
        <StoredSettings view={section[0]!} />
      )}
      {section[0] === 'services' && <Services />}
      {(view === 'description' || view === 'photos' || view === 'amenities') && (
        <ChannexContent view={view} refresh={refresh} />
      )}
    </Page>
  );
}

const ENVIRONMENT: Record<HotelContent['environment'], string> = {
  staging: 'Channex (тестовый объект staging)',
  production: 'Channex',
  custom: 'Channex (своя установка)',
};
/** Коды правил объекта из примеров hotel-policy-collection.md; незнакомый код показывается как есть */
const POLICY: Record<string, string> = {
  allowed: 'можно',
  not_allowed: 'нельзя',
  no_smoking: 'не курят',
  wifi: 'Wi-Fi',
  on_site: 'на территории',
  none: 'нет',
};
const policy = (code: string | null) => (code ? (POLICY[code] ?? code) : '—');
const almatyTime = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * Описание, фото и удобства читаются из Channex (ADR-033); меняются в кабинете Channex.
 * D4 (план владельца 19.09): отказ чтения — `LoadError` с повтором, а не общий экран; строка источника без « · »;
 * пустые значения — «—», пустые фото — `EmptyState` с причиной.
 */
async function ChannexContent({
  view,
  refresh,
}: {
  view: 'description' | 'photos' | 'amenities';
  refresh: boolean;
}) {
  const loaded = await settle(hotelApi.content(refresh));
  if (!loaded.ok) return <LoadError testId="content-load-error" {...loadErrorProps(loaded.e)} />;
  const c = loaded.r;
  const source = (
    <p className="note" data-testid="content-source">
      Источник: {ENVIRONMENT[c.environment]}, прочитано в{' '}
      <time dateTime={c.checkedAt}>{almatyTime(c.checkedAt)}</time> по Алматы. Изменить можно в
      кабинете Channex. <Link href="?refresh=1">Прочитать заново</Link>
    </p>
  );
  if (c.state !== 'READY')
    return (
      <>
        <Alert tone="warning" boxed data-testid="content-error">
          {c.message}
        </Alert>
        {source}
      </>
    );
  const p = c.property;
  return (
    <>
      {view === 'description' && (
        <Panel title="Описание для гостей (из Channex)">
          {p?.description ? (
            <p className="content-text" data-testid="content-description">
              {p.description}
            </p>
          ) : (
            <p>Описание в Channex не заполнено.</p>
          )}
          {p?.importantInformation && <Notice>{p.importantInformation}</Notice>}
          <Grid min={220}>
            <Fact label="Телефон" value={orDash(p?.phone)} />
            <Fact label="Почта" value={orDash(p?.email)} />
            <Fact label="Сайт" value={orDash(p?.website)} />
            <Fact
              label="Адрес в Channex"
              value={orDash([p?.address, p?.city, p?.country].filter(Boolean).join(', '))}
            />
          </Grid>
        </Panel>
      )}
      {view === 'photos' &&
        (c.photos.length ? (
          <Grid min={220} className="photo-grid" data-testid="content-photos">
            {c.photos.map((photo) => (
              <figure key={photo.url} className="photo-card">
                {/* Снимки лежат на CDN Channex; оптимизатор Next для внешнего хоста не настраиваем */}
                <img src={photo.url} alt={photo.description ?? 'Фото объекта'} loading="lazy" />
                <figcaption>
                  {photo.description ?? 'Без подписи'}
                  {photo.forRoomType ? ', категория номера' : ''}
                </figcaption>
              </figure>
            ))}
          </Grid>
        ) : (
          <EmptyState data-testid="content-photos-empty" title="В Channex нет фотографий объекта">
            Фото загружаются в кабинете Channex и оттуда уходят на сайты каналов; здесь они появятся
            после следующего чтения.
          </EmptyState>
        ))}
      {view === 'amenities' && (
        <>
          <Panel title="Удобства объекта">
            {c.facilities.length ? (
              <ul className="facility-list" data-testid="content-facilities">
                {c.facilities.map((f) => (
                  <li key={f.title}>
                    {f.title}
                    {f.category && <span className="cell-sub"> ({f.category})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Удобства в Channex не отмечены.</p>
            )}
            <p className="note">Названия — из справочника удобств Channex.</p>
          </Panel>
          {c.policy && (
            <Panel title="Правила объекта">
              <Grid min={200}>
                <Fact label="Заезд с" value={orDash(c.policy.checkInTime)} />
                <Fact label="Выезд до" value={orDash(c.policy.checkOutTime)} />
                <Fact label="Гостей максимум" value={orDash(c.policy.maxGuests)} />
                <Fact label="Интернет" value={policy(c.policy.internet)} />
                <Fact label="Парковка" value={policy(c.policy.parking)} />
                <Fact label="Животные" value={policy(c.policy.pets)} />
                <Fact label="Курение" value={policy(c.policy.smoking)} />
              </Grid>
            </Panel>
          )}
        </>
      )}
      {source}
    </>
  );
}
const penaltyNames: Record<string, string> = {
  NONE: 'Без штрафа',
  FIRST_NIGHT: 'Стоимость первой ночи',
  FULL_STAY: 'Стоимость всего проживания',
};
async function StoredSettings({ view }: { view: string }) {
  const loaded = await settle(hotelApi.settings());
  if (!loaded.ok) return <LoadError testId="settings-error" {...loadErrorProps(loaded.e)} />;
  const { property: p, ratePlans } = loaded.r;
  return (
    <>
      {view === 'check-in' && (
        <>
          <Stats>
            <Stat label="Заезд с" value={p.checkInTime} />
            <Stat label="Выезд до" value={p.checkOutTime} />
            <Stat label="Часовой пояс" value={p.timezone} size="compact" />
          </Stats>
          <Panel title="Операции стойки">
            <Link className="btn btn--secondary" href="/today">
              Заезды и выезды сегодня
            </Link>
          </Panel>
        </>
      )}
      {view === 'description' && (
        <Panel title="Сведения об объекте в PMS" data-testid="stored-property">
          <p className="note">
            Здесь — то, что знает PMS: название, адрес, валюта, часовой пояс. Описание для гостей,
            контакты и адрес ниже приходят из Channex и могут отличаться — их меняют в кабинете
            Channex.
          </p>
          <Grid min={250}>
            <Fact label="Название" value={p.name} />
            <Fact label="Юридическое название" value={orDash(p.legalName)} />
            <Fact label="Адрес в PMS" value={orDash(p.address)} />
            <Fact label="Валюта" value={p.currency} />
            <Fact label="Часовой пояс" value={p.timezone} />
          </Grid>
          {/* На этом экране два адреса: здесь — тот, что хранит PMS, ниже — тот, что показывают
              каналы. Подписи называют источник, иначе при расхождении непонятно, какой менять. */}
          <p className="note">
            Эти сведения хранит PMS: их видят стойка, счета и отчёты. Ниже — то же от Channex, для
            гостей на сайтах каналов; оно меняется в кабинете Channex.
          </p>
        </Panel>
      )}
      {view === 'penalties' && (
        <>
          <Table data-testid="rate-plans-table">
            <thead>
              <tr>
                <th>Тарифный план</th>
                <th>При отмене</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((r) => (
                <tr key={r.code}>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="cell-sub">
                      {r.code}, {r.currency}
                    </div>
                  </td>
                  <td>{penaltyNames[r.cancellationPenalty] ?? r.cancellationPenalty}</td>
                  <td>
                    <Badge tone={r.active ? 'ok' : 'neutral'}>
                      {r.active ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!ratePlans.length && (
                <tr>
                  <td colSpan={3} className="empty-state" data-testid="rate-plans-empty">
                    Тарифных планов ещё нет: они приходят из Exely при импорте фонда, вместе с
                    политикой отмены. Пока их нет, цены задавать нечему.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <p className="note">
            Показана сохранённая политика отмены тарифа. Начисленные штрафы проверяйте в финансовой
            карточке конкретной брони.
          </p>
        </>
      )}
      <p className="note">Только просмотр. Редактирование пока недоступно.</p>
    </>
  );
}
async function Services() {
  const loaded = await settle(Promise.all([financeApi.services(), hotelApi.settings()]));
  if (!loaded.ok) return <LoadError testId="services-error" {...loadErrorProps(loaded.e)} />;
  const [services, settings] = loaded.r;
  return (
    <>
      <Table data-testid="services-table">
        <thead>
          <tr>
            <th>Услуга</th>
            <th>Группа</th>
            <th className="num">Цена</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.code}>
              <td>
                <strong>{s.nameRu}</strong>
                <div className="cell-sub">
                  {s.code}
                  {s.nameKz ? `, ${s.nameKz}` : ''}
                </div>
              </td>
              <td>{s.group ?? 'Без группы'}</td>
              <td className="num">{formatMoney(s.priceMinor, settings.property.currency)}</td>
            </tr>
          ))}
          {!services.length && (
            <tr>
              <td colSpan={3} className="empty-state" data-testid="services-empty">
                Услуг ещё нет: каталог приходит из справочника Exely при импорте. Пока он пуст,
                начислить на счёт можно только проживание.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <Panel title="Как начислить услугу" data-testid="service-hint">
        <p>
          Откройте бронь гостя, вкладка «Счета», выберите услугу из каталога. Начисление попадёт в
          счёт этой брони.
        </p>
        <Link className="btn btn--secondary" href="/guests">
          Найти проживающего гостя
        </Link>
      </Panel>
      <p className="note">Добавление услуг и изменение цен пока недоступны.</p>
    </>
  );
}
