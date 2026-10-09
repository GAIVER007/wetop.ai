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
          <FinalArt />
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

/** Здание со снимка — рисунок на SVG в фирменных тонах (§19.9: вместо фото и стоков). */
function FinalArt() {
  return (
    <span className="final-card__art" aria-hidden="true">
      <svg viewBox="0 0 140 110" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M30 104V34l28-14v84" />
        <path d="M58 104V44h44v60" />
        <path d="M14 104h116" />
        <path d="M40 44h8M40 58h8M40 72h8M40 86h8" strokeWidth="2" />
        <path d="M68 56h8M84 56h8M68 70h8M84 70h8M68 84h8M84 84h8" strokeWidth="2" />
        <path d="M112 104V64l14 8v32" opacity="0.6" />
        <circle cx="120" cy="30" r="9" opacity="0.5" strokeWidth="2" />
      </svg>
    </span>
  );
}
