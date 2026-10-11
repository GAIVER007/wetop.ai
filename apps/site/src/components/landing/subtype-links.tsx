import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { SUBTYPES, subtypesOf, type Direction } from '../../lib/landings';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * Типы бизнеса направления карточками-ссылками (11.10.2026): человек находит страницу про свой формат,
 * поисковик видит связи между лендингами. Блоки главной (`.card`), своего класса нет.
 */
export function SubtypeLinks({ direction, title }: { direction: Direction; title: string }) {
  const t = getDictionary();
  return (
    <section className="section section--tight" aria-labelledby={`${direction}-types-title`}>
      <div className="section-heading section-heading--center">
        <p className="eyebrow">{t.segments.eyebrow}</p>
        <h2 id={`${direction}-types-title`} className="section-heading__title">
          {typo(title)}
        </h2>
      </div>
      <ul className="card-grid card-grid--3">
        {subtypesOf(direction).map((slug) => {
          const item = t.segments.items[slug];
          return (
            <li key={slug} className="card glass">
              <img
                className="card__photo"
                src={SUBTYPES[slug].photo}
                alt=""
                loading="lazy"
                width={1184}
                height={864}
              />
              <h3 className="card__title">
                <Link href={`/for/${slug}/`}>{item.metaTitle}</Link>
              </h3>
              <p className="card__text">{typo(item.description)}</p>
              <span className="link-arrow" aria-hidden="true">
                {t.segments.more}
                <Icon name="arrowRight" size={16} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
