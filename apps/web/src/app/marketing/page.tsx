import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import './marketing.css';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Badge, Grid, SectionTitle, Stack } from '../../components/ui';

/**
 * Хаб «Маркетинг» (MKT2, ADR-149, plans/mkt2-marketing-hub-2026-10-06.md): первая точка входа в маркетинг WETOP.
 * Рабочий продукт пока один, «Сайт и SEO», и он открывает существующий раздел `/website` (адреса не менялись).
 * Будущие продукты показаны статично: без ссылок, статусов «подключено» и чисел. Своих запросов к API у страницы нет:
 * проверка права (`settings`) общая, `AccessGate` по реестру меню, а направление (с MKT3 только Hospitality) берётся
 * из общего `/auth/me` оболочки через `requireVertical`.
 */
const SITE_CAPABILITIES = ['Сайт объекта', 'Онлайн-бронирование', 'Аналитика посещений', 'SEO'];

const SOON: Array<{ title: string; text: string; icon: IconName }> = [
  { title: 'Реклама', text: 'Запуск и анализ рекламных кампаний.', icon: 'channels' },
  { title: 'Контент', text: 'Контент для сайта и социальных сетей.', icon: 'journal' },
  { title: 'Репутация', text: 'Отзывы и присутствие компании в интернете.', icon: 'chat' },
];

export default async function MarketingPage() {
  await requireVertical(['HOSPITALITY']);
  return (
    <Page
      title="Маркетинг"
      subtitle="Привлекайте гостей, развивайте сайт и управляйте продвижением из WETOP."
    >
      <Stack>
        <section
          className="panel panel--lg marketing-product"
          aria-labelledby="marketing-site-title"
          data-testid="marketing-site"
        >
          <div className="marketing-product__head">
            <span className="marketing-product__icon" aria-hidden="true">
              <Icon name="analytics" />
            </span>
            <div className="marketing-product__title">
              <h2 id="marketing-site-title">Сайт и SEO</h2>
              <Badge tone="ok" data-testid="marketing-site-status">
                Доступно
              </Badge>
            </div>
          </div>
          <p className="marketing-product__text">
            Создайте сайт гостиницы, подключите бронирование, аналитику и подготовьте его к
            поисковым системам.
          </p>
          <ul className="marketing-product__caps">
            {SITE_CAPABILITIES.map((cap) => (
              <li key={cap}>
                <Icon name="check" width={16} aria-hidden="true" />
                {cap}
              </li>
            ))}
          </ul>
          <div className="marketing-product__foot">
            <Link className="btn" href="/website">
              Открыть
            </Link>
            <Link className="btn btn--secondary" href="/marketing/site/editor">
              Редактор
            </Link>
            <Link className="btn btn--secondary" href="/marketing/site">
              Публикация
            </Link>
            <Link className="btn btn--secondary" href="/marketing/site/assets">
              Изображения
            </Link>
            <span className="marketing-product__next">ИИ-конструктор: скоро</span>
          </div>
        </section>
        <section aria-labelledby="marketing-soon-title" data-testid="marketing-soon">
          <SectionTitle id="marketing-soon-title">Скоро</SectionTitle>
          <Grid min={240}>
            {SOON.map((product) => (
              <div
                key={product.title}
                className="panel marketing-soon"
                data-testid="marketing-soon-card"
              >
                <div className="marketing-soon__head">
                  <span className="marketing-soon__icon" aria-hidden="true">
                    <Icon name={product.icon} />
                  </span>
                  <h3>{product.title}</h3>
                  <Badge>Скоро</Badge>
                </div>
                <p>{product.text}</p>
              </div>
            ))}
          </Grid>
        </section>
      </Stack>
    </Page>
  );
}
