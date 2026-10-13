import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon, type IconName } from '../../components/icon';
import { MarketingHub } from '../marketing/hub';
import '../sales/sales.css';
import './growth.css';

type BusinessVertical = 'BEAUTY' | 'FOOD_SERVICE';
export function BusinessGrowthScreen({
  vertical,
  mode,
}: {
  vertical: BusinessVertical;
  mode: 'sales' | 'marketing';
}) {
  if (mode === 'marketing') return <MarketingHub vertical={vertical} />;
  const restaurant = vertical === 'FOOD_SERVICE';
  const metrics: { label: string; icon: IconName; reason: string }[] = [
    { label: 'Конкурентов в отслеживании', icon: 'channels', reason: 'Мониторинг готовится' },
    { label: 'Средняя загрузка рынка', icon: 'analytics', reason: 'Нет данных рынка' },
    { label: 'Ваша загрузка vs рынок', icon: 'board', reason: 'Нет данных сравнения' },
    { label: 'Активных диалогов', icon: 'chat', reason: 'Продавец не подключён' },
    {
      label: restaurant ? 'Конверсия в заказ' : 'Конверсия в запись',
      icon: 'booking',
      reason: 'Атрибуция не подключена',
    },
    { label: 'Лидов сегодня', icon: 'guests', reason: 'Нет источника лидов' },
  ];
  return (
    <Page title="Продажи" subtitle="Инструменты роста, анализа рынка и ИИ-продаж в одном разделе.">
      <div className="sales-hub growth-hub" data-testid="business-sales">
        <div className="growth-kpis" data-testid="sales-kpis">
          {metrics.map((m) => (
            <section className="panel growth-kpi" key={m.label}>
              <div className="growth-kpi__head">
                <span className="growth-icon">
                  <Icon name={m.icon} aria-hidden="true" />
                </span>
                <h2>{m.label}</h2>
              </div>
              <strong className="growth-kpi__value">Нет данных</strong>
              <p>{m.reason}</p>
            </section>
          ))}
        </div>
        <div className="sales-trio">
          <section className="panel sales-card">
            <div className="sales-card__head">
              <span className="sales-card__icon">
                <Icon name="analytics" aria-hidden="true" />
              </span>
              <div>
                <h2>Анализ конкурентов</h2>
                <p>Сравнение рынка, цен и загрузки вашего бизнеса.</p>
              </div>
            </div>
            <ul className="sales-card__checks">
              {['Мониторинг конкурентов', 'Сравнение цен и спроса', 'Рекомендации по росту'].map(
                (t) => (
                  <li key={t}>
                    <Icon name="check" width={16} aria-hidden="true" />
                    {t}
                  </li>
                ),
              )}
            </ul>
            <p className="sales-card__note">Для этого направления модуль пока недоступен.</p>
            <div className="sales-card__foot">
              <button className="btn" disabled>
                Скоро <Icon name="arrow" width={16} aria-hidden="true" />
              </button>
            </div>
          </section>
          <section className="panel sales-card">
            <div className="sales-card__head">
              <span className="sales-card__icon sales-card__icon--seller">
                <Icon name="chat" aria-hidden="true" />
              </span>
              <div>
                <h2>ИИ-продавец</h2>
                <p>Диалоги, обращения и помощь клиентам.</p>
              </div>
            </div>
            <ul className="sales-card__checks">
              {[
                'Подключение каналов',
                'Ответы на вопросы клиентов',
                restaurant ? 'Помощь с заказами' : 'Помощь с записью',
              ].map((t) => (
                <li key={t}>
                  <Icon name="check" width={16} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="sales-card__note">Подключение продавца к этому направлению готовится.</p>
            <div className="sales-card__foot">
              <button className="btn" disabled>
                Скоро <Icon name="arrow" width={16} aria-hidden="true" />
              </button>
            </div>
          </section>
          <section className="panel sales-card">
            <div className="sales-card__head">
              <span className="sales-card__icon sales-card__icon--tip">
                <Icon name="info" aria-hidden="true" />
              </span>
              <div>
                <h2>Рабочие инструменты</h2>
                <p>Каталог, клиенты и результаты филиала.</p>
              </div>
            </div>
            <nav className="growth-links" aria-label="Инструменты продаж">
              <Link href={restaurant ? '/orders' : '/appointments'}>
                <Icon name="booking" aria-hidden="true" />
                {restaurant ? 'Заказы' : 'Записи'}
                <Icon name="arrow" width={16} aria-hidden="true" />
              </Link>
              <Link href={restaurant ? '/menu' : '/services'}>
                <Icon name="rates" aria-hidden="true" />
                {restaurant ? 'Меню и цены' : 'Услуги и цены'}
                <Icon name="arrow" width={16} aria-hidden="true" />
              </Link>
              <Link href="/customers">
                <Icon name="guests" aria-hidden="true" />
                Клиенты
                <Icon name="arrow" width={16} aria-hidden="true" />
              </Link>
            </nav>
            <div className="sales-card__foot">
              <Link className="btn btn--secondary" href="/management/analytics">
                Открыть аналитику <Icon name="arrow" width={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
