import { getDictionary } from '../../i18n';
import { contactLinks, registerLink, siteUrl } from '../../lib/site';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Частые вопросы» слева и карточка призыва справа (по снимку владельца). FAQ — нативные details,
 * работают без JavaScript. В карточке призыва чисел клиентов и обещаний результата нет (§19.9);
 * контакты — только заполненные в site.config.ts, разделителя « · » не бывает (правило главной).
 */
export function FAQ() {
  const t = getDictionary();
  const email = contactLinks().find((contact) => contact.kind === 'email');
  const host = new URL(siteUrl()).host;
  return (
    <section id="faq" className="section section--band faq" aria-labelledby="faq-title">
      <div className="container faq__layout">
        <div>
          <SectionHeading id="faq-title" eyebrow={t.faq.eyebrow} title={t.faq.title} />
          <div className="faq__list">
            {t.faq.items.map((item) => (
              <details key={item.q}>
                <summary>
                  <span>{typo(item.q)}</span>
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{typo(item.a)}</p>
              </details>
            ))}
          </div>
        </div>
        <aside id="get-started" className="final-card glass glass--strong" aria-labelledby="final-title">
          <p className="eyebrow">{t.final.eyebrow}</p>
          <h2 id="final-title" className="final-card__title">
            {typo(t.final.title)}
          </h2>
          <p className="final-card__text">{typo(t.final.text)}</p>
          <span className="final-card__badge" aria-hidden="true">
            <Icon name="chart" size={16} />
            <span>
              {t.final.badgeTop}
              <br />
              {t.final.badgeBottom}
            </span>
          </span>
          <span className="final-card__art final-card__art--photo">
            <img src="/photos/building.jpg" alt="" loading="lazy" width={592} height={432} />
          </span>
          <div className="final-card__actions">
            <a className="btn btn--primary" href={registerLink().href} data-auth="register">
              {t.nav.register}
              <Icon name="arrowRight" size={16} />
            </a>
            {email ? (
              <a className="btn btn--secondary" href={email.href}>
                {t.final.contact}
              </a>
            ) : null}
          </div>
          <p className="final-card__contacts">
            {t.final.contactsLabel} {email ? <a href={email.href}>{email.label}</a> : null} {host}
          </p>
        </aside>
      </div>
    </section>
  );
}
