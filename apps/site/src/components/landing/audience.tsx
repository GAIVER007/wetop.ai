import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';

/*
 * «Три направления. Одна платформа» (по снимку владельца): карточка с иконкой, списком возможностей
 * слева и иллюстрацией справа, внизу кнопка «Для гостиниц →» (регистрация с предвыбранным
 * направлением, `?vertical=`). Фото со снимка заменены рисунками на SVG: §19.9 запрещает стоки,
 * а кредитов на генерацию своих фото нет; при появлении фото меняется один блок `VerticalArt`.
 */
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
            const invite = new URL(registerLink().href);
            if (!hospitality) invite.searchParams.set('vertical', card.id);
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
                  <VerticalArt id={card.id} />
                </div>
                <a className="btn btn--secondary verticals__action" href={invite.href} data-auth="register">
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
                {card.id === 'FOOD_SERVICE' ? (
                  <div className="verticals__segments">
                    <Link href="/restaurants/">{t.restaurants.homeCardLink}</Link>
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

/** Иллюстрация направления: рисунок на SVG в фирменных тонах (цвета токенами через currentColor и var). */
function VerticalArt({ id }: { id: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE' }) {
  return (
    <span className="verticals__art" aria-hidden="true">
      <svg viewBox="0 0 120 96" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {id === 'HOSPITALITY' ? (
          <>
            {/* кровать */}
            <path d="M14 70V34" />
            <path d="M14 54h92v16" />
            <path d="M14 46h18a10 10 0 0 1 10 10v-2" />
            <rect x="20" y="38" width="20" height="9" rx="4.5" />
            <path d="M42 54h64a0 0 0 0 1 0 0v0a12 12 0 0 0-12-12H42Z" />
            <path d="M14 70v6M106 70v6" />
            <path d="M78 20l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L69 27l6-1z" opacity="0.5" strokeWidth="2" />
          </>
        ) : id === 'BEAUTY' ? (
          <>
            {/* зеркало и кресло */}
            <ellipse cx="44" cy="34" rx="20" ry="24" />
            <path d="M44 58v16M32 78h24" />
            <path d="M84 48a10 10 0 0 1 10 10v8H74v-8a10 10 0 0 1 10-10Z" />
            <path d="M84 66v10M76 80h16" />
            <path d="M38 28c2-4 8-6 12-4" opacity="0.5" strokeWidth="2" />
          </>
        ) : (
          <>
            {/* стол и бокалы */}
            <path d="M16 56h88" />
            <path d="M28 56v22M92 56v22" />
            <path d="M52 30c0 8 4 12 8 12s8-4 8-12l-1-8H53Z" />
            <path d="M60 42v12M52 56h16" strokeWidth="2" />
            <circle cx="34" cy="44" r="7" opacity="0.6" strokeWidth="2" />
            <circle cx="88" cy="44" r="7" opacity="0.6" strokeWidth="2" />
          </>
        )}
      </svg>
    </span>
  );
}
