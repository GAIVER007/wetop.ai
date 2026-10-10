import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { Icon } from '../icon';

/*
 * «Три направления. Одна платформа» (по снимку владельца): карточка с иконкой, списком возможностей
 * слева и иллюстрацией справа, внизу кнопка «Для гостиниц →» (регистрация с предвыбранным
 * направлением, `?vertical=`). Фото со снимка заменены рисунками на SVG: §19.9 запрещает стоки,
 * а кредитов на генерацию своих фото нет; при появлении фото меняется один блок `VerticalArt`.
 */
const DIRECTION: Record<'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', string> = {
  HOSPITALITY: '/for/hotels/',
  BEAUTY: '/for/salons/',
  FOOD_SERVICE: '/for/restaurants/',
};

/* Фото направлений сгенерированы через KIE по решению владельца 10.10.2026 (ключ в связке ключей
 * Mac, `security find-generic-password -s KIE_API_KEY`); файлы свои, не стоки, людей и текста нет. */
const PHOTO: Record<'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', string> = {
  HOSPITALITY: '/photos/hotel.jpg',
  BEAUTY: '/photos/salon.jpg',
  FOOD_SERVICE: '/photos/restaurant.jpg',
};

export function Audience() {
  const t = getDictionary();
  return (
    <section id="audience" className="verticals section" aria-labelledby="audience-title">
      <div className="container">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">{t.nav.audience}</p>
          <h2 id="audience-title" className="section-heading__title">
            {t.intro.verticalTitle}
          </h2>
          <p className="section-heading__lead">{t.intro.verticalLead}</p>
        </div>
        <div className="verticals__grid">
          {t.intro.cards.map((card) => {
            const hospitality = card.id === 'HOSPITALITY';
            return (
              <article className="verticals__card" key={card.id}>
                <div className="verticals__head">
                  <span className="icon-tile">
                    <Icon name={card.icon} size={22} />
                  </span>
                  <div>
                    <h3>{card.title}</h3>
                    <p className="verticals__name">{card.name}</p>
                  </div>
                </div>
                <p className="verticals__text">{card.text}</p>
                <div className="verticals__body">
                  <ul className="verticals__capabilities">
                    {card.capabilities.map((item) => (
                      <li key={item}>
                        <Icon name="check" size={15} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <span className="verticals__art verticals__art--photo">
                    <img src={PHOTO[card.id]} alt="" loading="lazy" width={592} height={432} />
                  </span>
                </div>
                <a className="btn btn--secondary verticals__action" href={DIRECTION[card.id]}>
                  {card.action}
                  <Icon name="arrowRight" size={16} />
                </a>
                {hospitality ? (
                  <div className="verticals__segments">
                    {t.audience.items.map((item) => (
                      <Link key={item.segment} href={`/for/${item.segment}/`}>
                        {item.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
