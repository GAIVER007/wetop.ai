import Link from 'next/link';
import { notFound } from 'next/navigation';
import { financeApi, formatMinor } from '../../../lib/api';
import { hotelApi } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { FeaturePending, SectionCards } from '../../../components/section-cards';
import { Badge, Fact, Grid, Panel, Stat, Stats, Table } from '../../../components/ui';

export default async function HotelSettingsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const path = `/hotel-settings${section.length ? `/${section.join('/')}` : ''}`;
  const item = navigationItems.find((item) => item.href === path);
  if (!item) notFound();
  return (
    <Page
      title={item.label}
      subtitle={item.description}
      crumbs={section.length ? <Link href="/hotel-settings">Настройка гостиницы</Link> : undefined}
    >
      {!section.length && <SectionCards items={item.children ?? []} />}
      {['check-in', 'description', 'penalties'].includes(section[0] ?? '') && (
        <StoredSettings view={section[0]!} />
      )}
      {section[0] === 'services' && <Services />}
      {section[0] === 'photos' && (
        <FeaturePending
          icon="inventory"
          text="Загрузка фотографий пока недоступна. Здесь будут фотографии гостиницы и категорий номеров: обложка, порядок снимков и подписи."
        />
      )}
      {section[0] === 'amenities' && (
        <FeaturePending
          icon="check"
          text="Редактирование удобств пока недоступно. Здесь будет оснащение объекта, отдельных категорий и общих зон."
        />
      )}
    </Page>
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
            <p>
              Откройте список дня, чтобы зарегистрировать заезд, оформить выезд или найти гостя.
            </p>
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
      <p className="note">
        Данные доступны для просмотра. Изменение{' '}
        {view === 'description'
          ? 'описания и реквизитов'
          : view === 'penalties'
            ? 'политики штрафов'
            : 'расчётного часа'}{' '}
        в интерфейсе ещё не подключено.
      </p>
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
      <p className="note">
        Каталог доступен для просмотра и начислений в брони. Добавление услуг и изменение их цен
        пока не подключены.
      </p>
    </>
  );
}
