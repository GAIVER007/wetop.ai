import Link from 'next/link';
import styles from './audience-segments.module.css';
import { getDictionary } from '../../i18n';
import { subtypesOf } from '../../lib/landings';
import { Icon } from '../icon';

/*
 * «Три направления. Одна платформа»: фото направления сверху карточки во всю ширину (пометка владельца
 * 13.10.2026: мелкие картинки сбоку выглядели бедно), иконка и название, список возможностей, кнопка
 * на страницу направления и под ней типы бизнеса направления из общего списка лендингов.
 */
const DIRECTION = {
  HOSPITALITY: 'hotels',
  BEAUTY: 'salons',
  FOOD_SERVICE: 'restaurants',
} as const;

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
            const direction = DIRECTION[card.id];
            return (
              <article className="verticals__card" key={card.id}>
                <img
                  className="verticals__photo"
                  src={PHOTO[card.id]}
                  alt=""
                  width={1184}
                  height={864}
                  loading="lazy"
                  decoding="async"
                />
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
                <ul className="verticals__capabilities">
                  {card.capabilities.map((item) => (
                    <li key={item}>
                      <Icon name="check" size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a className="btn btn--secondary verticals__action" href={`/for/${direction}/`}>
                  {card.action}
                  <Icon name="arrowRight" size={16} />
                </a>
                {/* Типы бизнеса направления из общего списка лендингов (lib/landings.ts) */}
                <div className={`verticals__segments ${styles.segments}`}>
                  {subtypesOf(direction).map((slug) => (
                    <Link key={slug} href={`/for/${slug}/`}>
                      {t.segments.items[slug].metaTitle}
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
