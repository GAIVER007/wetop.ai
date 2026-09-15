import Link from 'next/link';
import { notFound } from 'next/navigation';
import { financeApi, formatMinor } from '../../../lib/api';
import { hotelApi, type HotelContent } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { SectionCards } from '../../../components/section-cards';
import {
  Alert,
  Badge,
  Fact,
  Grid,
  Notice,
  Panel,
  Stat,
  Stats,
  Table,
} from '../../../components/ui';

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
const policy = (code: string | null) => (code ? (POLICY[code] ?? code) : 'Не указано');
const almatyTime = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/** Описание, фото и удобства читаются из Channex (ADR-033); меняются в кабинете Channex */
async function ChannexContent({
  view,
  refresh,
}: {
  view: 'description' | 'photos' | 'amenities';
  refresh: boolean;
}) {
  const c = await hotelApi.content(refresh);
  const source = (
    <p className="note" data-testid="content-source">
      Источник: {ENVIRONMENT[c.environment]} · прочитано в {almatyTime(c.checkedAt)} по Алматы ·{' '}
      <Link href="?refresh=1" className="link-underline">
        прочитать заново
      </Link>
      . Изменить можно в кабинете Channex.
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
        <Panel title="Описание для гостей">
          {p?.description ? (
            <p className="content-text" data-testid="content-description">
              {p.description}
            </p>
          ) : (
            <p>Описание в Channex не заполнено.</p>
          )}
          {p?.importantInformation && <Notice>{p.importantInformation}</Notice>}
          <Grid min={220}>
            <Fact label="Телефон" value={p?.phone ?? 'Не указан'} />
            <Fact label="Почта" value={p?.email ?? 'Не указана'} />
            <Fact label="Сайт" value={p?.website ?? 'Не указан'} />
            <Fact
              label="Адрес"
              value={[p?.address, p?.city, p?.country].filter(Boolean).join(', ') || 'Не указан'}
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
                  {photo.forRoomType ? ' · категория номера' : ''}
                </figcaption>
              </figure>
            ))}
          </Grid>
        ) : (
          <p>В Channex нет фотографий объекта.</p>
        ))}
      {view === 'amenities' && (
        <>
          <Panel title="Удобства объекта">
            {c.facilities.length ? (
              <ul className="facility-list" data-testid="content-facilities">
                {c.facilities.map((f) => (
                  <li key={f.title}>
                    {f.title}
                    {f.category && <span className="cell-sub"> · {f.category}</span>}
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
                <Fact label="Заезд с" value={c.policy.checkInTime ?? 'Не указано'} />
                <Fact label="Выезд до" value={c.policy.checkOutTime ?? 'Не указано'} />
                <Fact label="Гостей максимум" value={c.policy.maxGuests ?? 'Не указано'} />
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
  const { property: p, ratePlans } = await hotelApi.settings();
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
        <Panel title="Сведения об объекте">
          <Grid min={250}>
            <Fact label="Название" value={p.name} />
            <Fact label="Юридическое название" value={p.legalName ?? 'Не указано'} />
            <Fact label="Адрес" value={p.address ?? 'Не указан'} />
            <Fact label="Валюта" value={p.currency} />
            <Fact label="Часовой пояс" value={p.timezone} />
          </Grid>
        </Panel>
      )}
      {view === 'penalties' && (
        <>
          <Table>
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
                      {r.code} · {r.currency}
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
                  <td colSpan={3}>Тарифные планы ещё не добавлены.</td>
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
  const [services, settings] = await Promise.all([financeApi.services(), hotelApi.settings()]);
  return (
    <>
      <Table>
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
                  {s.nameKz ? ` · ${s.nameKz}` : ''}
                </div>
              </td>
              <td>{s.group ?? 'Без группы'}</td>
              <td className="num">{formatMinor(s.priceMinor, settings.property.currency)}</td>
            </tr>
          ))}
          {!services.length && (
            <tr>
              <td colSpan={3}>Услуги ещё не добавлены.</td>
            </tr>
          )}
        </tbody>
      </Table>
      <Panel title="Как начислить услугу">
        <p>
          Откройте бронь гостя → «Финансы» → выберите услугу из каталога. Начисление попадёт в счёт
          этой брони.
        </p>
        <Link className="btn btn--secondary" href="/today">
          Найти проживающего гостя
        </Link>
      </Panel>
      <p className="note">Добавление услуг и изменение цен пока недоступны.</p>
    </>
  );
}
