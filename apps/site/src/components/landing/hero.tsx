import { getDictionary } from '../../i18n';
import { DashMock } from './dash-mock';
import { VerticalChips } from './vertical-chips';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';

/*
 * Первый экран по снимку владельца (LAND2 v2, 09.10.2026): заголовок в три строки, две кнопки,
 * чипы направлений и дашборд-мокап справа (сайдбар, четыре метрики, ближайшие заезды, график недели).
 * Мокап — чистый HTML/CSS с вымышленными данными и подписью примера; интерактива в нём нет (§19.9).
 */
const DIRECTION: Record<'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', string> = {
  HOSPITALITY: '/for/hotels/',
  BEAUTY: '/for/salons/',
  FOOD_SERVICE: '/for/restaurants/',
};

export function Hero() {
  const t = getDictionary();
  return (
    <section id="product" className="public-intro" aria-labelledby="hero-title">
      <div className="public-intro__container">
        <div className="public-intro__copy">
          <p className="public-intro__eyebrow">{t.hero.status}</p>
          <h1 id="hero-title">
            {t.hero.title} <span className="public-intro__accent">{t.hero.titleAccent}</span>
          </h1>
          <p className="public-intro__lead">{t.hero.lead}</p>
          <div className="public-intro__actions">
            <a className="public-intro__primary" href={registerLink().href} data-auth="register">
              {t.hero.primary}
              <Icon name="arrowRight" size={18} />
            </a>
            <a className="public-intro__secondary" href="#features">
              {t.hero.secondary}
              <Icon name="arrowDown" size={18} />
            </a>
          </div>
          <VerticalChips
            label={t.intro.availability}
            items={t.intro.cards.map((card) => ({
              id: card.id,
              icon: card.icon,
              title: card.title,
              name: card.name,
              text: card.text,
              href: DIRECTION[card.id],
              more: card.action,
            }))}
          />
          <p className="public-intro__note">{t.hero.note}</p>
        </div>
        <figure className="public-intro__figure">
          <DashMock />
          <figcaption>{t.hero.dash.label}</figcaption>
        </figure>
      </div>
    </section>
  );
}
