import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { contactLinks, registerLink } from '../../lib/site';
import { Icon } from '../icon';

/*
 * «Для кого» (LAND2): три компактные карточки направлений: иконка, сегменты, текст, возможности
 * чипами и ссылка-стрелка вместо крупной кнопки в каждой. Регистрация с предвыбранным направлением
 * (`?vertical=`) и «Обсудить подключение» на почту сохраняются; меток зрелости на карточках нет.
 */
export function Audience() {
  const t = getDictionary();
  const email = contactLinks().find((contact) => contact.kind === 'email');
  return (
    <section id="audience" className="verticals section" aria-labelledby="audience-title">
      <div className="container">
        <div className="section-heading">
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
                <div className="verticals__top">
                  <Icon name={card.icon} size={24} />
                </div>
                <p className="verticals__name">{card.name}</p>
                <h3>{card.title}</h3>
                <p className="verticals__text">{card.text}</p>
                <ul className="verticals__capabilities">
                  {card.capabilities.map((item) => (
                    <li key={item}>
                      <Icon name="check" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="verticals__actions">
                  <a className="link-arrow" href={invite.href} data-auth="register">
                    {t.nav.register}
                    <Icon name="arrowRight" size={16} />
                  </a>
                  {!hospitality && email ? (
                    <a className="verticals__invitation" href={email.href}>
                      {t.intro.contactAction}
                    </a>
                  ) : null}
                </div>
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
