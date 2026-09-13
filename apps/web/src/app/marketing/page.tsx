import Link from 'next/link';
import { analyticsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { SectionCards } from '../../components/section-cards';
import { Badge, Panel, Stat, Stats, Table } from '../../components/ui';

export default async function MarketingPage() {
  const sites = await analyticsApi.sites();
  return (
    <Page
      title="Маркетинг"
      subtitle="Прямые бронирования, сайты гостиницы и эффективность привлечения."
      actions={
        <Link href="/analytics/setup" className="btn">
          Подключить сайт
        </Link>
      }
    >
      <Stats>
        <Stat label="Подключено сайтов" value={sites.length} />
        <Stat
          label="Активных счётчиков"
          value={sites.filter((s) => s.status === 'ACTIVE').length}
        />
        <Stat
          label="Виджет бронирования включён"
          value={sites.filter((s) => s.bookingEnabled).length}
          hint="сайтов с включённой настройкой"
        />
      </Stats>
      <Panel title="Сайты и прямые продажи">
        <Table>
          <thead>
            <tr>
              <th>Сайт</th>
              <th>Счётчик</th>
              <th>Бронирование</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <div className="cell-sub">{s.hosts.join(', ')}</div>
                </td>
                <td>
                  <Badge tone={s.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                    {s.status === 'ACTIVE' ? 'Активен' : 'На паузе'}
                  </Badge>
                </td>
                <td>{s.bookingEnabled ? 'Включено' : 'Выключено'}</td>
                <td>
                  <Link href={`/analytics?site=${encodeURIComponent(s.id)}`}>Аналитика</Link> ·{' '}
                  <Link href="/analytics/setup">Настроить</Link>
                </td>
              </tr>
            ))}
            {!sites.length && (
              <tr>
                <td colSpan={4}>
                  Сайтов пока нет. Подключите сайт для сбора посещений и настройки бронирования.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
      <SectionCards
        items={[
          {
            href: '/analytics',
            label: 'Источники и конверсия сайта',
            icon: 'analytics',
            description: 'Сессии, страницы и бронирования по источникам трафика.',
          },
          {
            href: '/channel-manager',
            label: 'Продажи по каналам',
            icon: 'channels',
            description: 'Сравнение количества и стоимости броней из разных источников.',
          },
          {
            href: '/rooms/promotions',
            label: 'Акции и предложения',
            icon: 'rates',
            description: 'Специальные условия и промокоды.',
            pending: true,
          },
        ]}
      />
      <p className="note">
        Рассылки, рекламные кампании и программа лояльности пока не подключены.
      </p>
    </Page>
  );
}
