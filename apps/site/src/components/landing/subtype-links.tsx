import Link from 'next/link';
import { getDictionary, type Locale } from '../../i18n';
import { SUBTYPES, subtypesOf, type Direction, type Subtype } from '../../lib/landings';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * Типы бизнеса направления карточками-ссылками (11.10.2026): человек находит страницу про свой формат,
 * поисковик видит связи между лендингами. Блоки главной (`.card`), своего класса нет.
 * На странице типа (14.10.2026): `exclude` убирает ссылку на себя, `withDirection` добавляет карточку
 * родительской страницы направления, чтобы перелинковка была в обе стороны.
 */
/** Сетка по числу карточек: две и четыре в ряд без пустой ячейки */
const GRID: Record<number, number> = { 2: 2, 4: 4 };

/** Карточка родительской страницы направления: словарный ключ и фото. */
const DIRECTION_CARD: Record<
  Direction,
  { parent: 'hotel' | 'salon' | 'restaurant'; photo: string }
> = {
  hotels: { parent: 'hotel', photo: '/photos/hotel.jpg' },
  salons: { parent: 'salon', photo: '/photos/salon-warm.jpg' },
  restaurants: { parent: 'restaurant', photo: '/photos/restaurant.jpg' },
};

export function SubtypeLinks({
  direction,
  title,
  exclude,
  withDirection = false,
  locale = 'ru',
}: {
  direction: Direction;
  title: string;
  exclude?: Subtype;
  withDirection?: boolean;
  /** Язык карточек и ссылок: казахские страницы ссылаются на казахские пары. */
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const prefix = locale === 'kk' ? '/kk' : '';
  const all = subtypesOf(direction);
  // На странице типа показываются три соседних типа по кругу реестра, чтобы блок не разрастался
  // с каталогом, а ссылочный вес расходился по всем страницам направления равномерно.
  const slugs = exclude
    ? Array.from(
        { length: Math.min(3, all.length - 1) },
        (_, i) => all[(all.indexOf(exclude) + 1 + i) % all.length]!,
      )
    : all;
  const own = DIRECTION_CARD[direction];
  const count = slugs.length + (withDirection ? 1 : 0);
  return (
    <section className="section section--tight" aria-labelledby={`${direction}-types-title`}>
      <div className="section-heading section-heading--center">
        <p className="eyebrow">{t.segments.eyebrow}</p>
        <h2 id={`${direction}-types-title`} className="section-heading__title">
          {typo(title)}
        </h2>
      </div>
      <ul className={`card-grid card-grid--${GRID[count] ?? 3}`}>
        {withDirection ? (
          <li className="card glass">
            <img
              className="card__photo"
              src={own.photo}
              alt=""
              loading="lazy"
              width={1184}
              height={864}
            />
            <h3 className="card__title">
              <Link href={`${prefix}/for/${direction}/`}>{t[own.parent].badge}</Link>
            </h3>
            <p className="card__text">{typo(t.segments.directionCards[direction])}</p>
            <span className="link-arrow" aria-hidden="true">
              {t.segments.more}
              <Icon name="arrowRight" size={16} />
            </span>
          </li>
        ) : null}
        {slugs.map((slug) => {
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
                <Link href={`${prefix}/for/${slug}/`}>{item.metaTitle}</Link>
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
