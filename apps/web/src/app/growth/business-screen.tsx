import Link from 'next/link';
import { Page } from '../../components/page';
import { Panel } from '../../components/ui';
import '../food/food.css';
import '../food/restaurant.css';

type BusinessVertical = 'BEAUTY' | 'FOOD_SERVICE';
export function BusinessGrowthScreen({
  vertical,
  mode,
}: {
  vertical: BusinessVertical;
  mode: 'sales' | 'marketing';
}) {
  const restaurant = vertical === 'FOOD_SERVICE';
  const sales = mode === 'sales';
  const cards = sales
    ? [
        {
          title: restaurant ? 'Заказы' : 'Записи',
          href: restaurant ? '/orders' : '/appointments',
          text: restaurant
            ? 'Открытые заказы, состав и статус обслуживания.'
            : 'Записи клиентов и состояние визитов.',
        },
        {
          title: restaurant ? 'Меню и цены' : 'Услуги и цены',
          href: restaurant ? '/menu' : '/services',
          text: 'Каталог и действующие цены вашего бизнеса.',
        },
        { title: 'Клиенты', href: '/customers', text: 'Клиенты и история обращений.' },
        {
          title: 'Аналитика продаж',
          href: '/management/analytics',
          text: 'Показатели выбранного филиала за период.',
        },
      ]
    : [
        {
          title: 'Реклама',
          href: '/marketing/ads',
          text: 'Кампании и рекламные материалы. Подключение рекламных кабинетов пока недоступно.',
        },
        {
          title: 'Контент',
          href: '/marketing/content',
          text: 'Рабочий экран контента. Генерация и публикация пока недоступны.',
        },
        { title: 'Клиенты', href: '/customers', text: 'Клиентская база вашего бизнеса.' },
        {
          title: 'Результаты',
          href: '/management/analytics',
          text: 'Показатели филиала. Атрибуция заявок рекламе пока не подключена.',
        },
      ];
  return (
    <Page
      className={restaurant ? 'restaurant-page' : ''}
      title={sales ? 'Продажи' : 'Маркетинг'}
      subtitle={restaurant ? 'Кафе и ресторан' : 'Салон и студия'}
    >
      <div className="food-catalog-grid" data-testid={`business-${mode}`}>
        {cards.map((card) => (
          <Panel key={card.href} title={card.title}>
            <p>{card.text}</p>
            <Link className="btn btn--secondary" href={card.href}>
              Открыть
            </Link>
          </Panel>
        ))}
      </div>
      {!sales && (
        <p className="muted">
          Конструктор сайта и SEO пока поддерживают гостиничный объект. Для этого направления они
          ещё не подключены.
        </p>
      )}
    </Page>
  );
}
